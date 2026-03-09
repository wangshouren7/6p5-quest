"use server";

import { db } from "@/modules/db/client";
import type {
    IMorphemeItem,
    IPartOfSpeechMeaning,
    IVocabularyEntryFormData,
} from "@/modules/vocabulary/core";
import { VOCABULARY_CATEGORIES } from "@/modules/vocabulary/core";
import { normalizeWord } from "@/utils/string";
import {
    normalizeMorphemeText,
    parseCollocationsJson,
    parseMeaningsJson,
    parseMorphemeMeaningsJson,
} from "./helpers";

/** 从 meanings JSON 解析出所有 partOfSpeech，同步到 VocabularyEntryPartOfSpeech */
async function syncEntryPartOfSpeech(
  entryId: number,
  meanings: IPartOfSpeechMeaning[],
) {
  const partOfSpeeches = [
    ...new Set(meanings.map((m) => m.partOfSpeech).filter(Boolean)),
  ];
  await db.vocabularyEntryPartOfSpeech.deleteMany({ where: { entryId } });
  if (partOfSpeeches.length > 0) {
    await db.vocabularyEntryPartOfSpeech.createMany({
      data: partOfSpeeches.map((partOfSpeech) => ({ entryId, partOfSpeech })),
    });
  }
}

/** 创建或获取 Morpheme（按 type + text），若不存在则创建；若已存在则合并新释义（仅追加数据库中不存在的释义） */
async function getOrCreateMorpheme(
  type: "prefix" | "suffix" | "root",
  text: string,
  meanings: string[],
) {
  const normalized = normalizeMorphemeText(text);
  if (!normalized) return null;

  const existing = await db.vocabularyMorpheme.findUnique({
    where: { type_text: { type, text: normalized } },
  });
  if (existing) {
    const existingMeanings = parseMorphemeMeaningsJson(existing.meanings);
    const combined = [...existingMeanings];
    for (const m of meanings) {
      const trimmed = typeof m === "string" ? m.trim() : "";
      if (trimmed && !combined.includes(trimmed)) {
        combined.push(trimmed);
      }
    }
    if (combined.length > existingMeanings.length) {
      await db.vocabularyMorpheme.update({
        where: { id: existing.id },
        data: { meanings: JSON.stringify(combined) },
      });
    }
    return existing.id;
  }

  const created = await db.vocabularyMorpheme.create({
    data: {
      type,
      text: normalized,
      meanings: JSON.stringify(meanings),
    },
  });
  return created.id;
}

/** 将表单中的「AI 待保存」词素解析为 id，并与已有 id 合并（保存时才创建词素） */
async function resolveAiFilledAndMergeIds(
  data: IVocabularyEntryFormData,
): Promise<{
  prefixIds: number[];
  suffixIds: number[];
  rootId: number | null;
}> {
  const prefixIds = [...(data.prefixIds ?? [])];
  const suffixIds = [...(data.suffixIds ?? [])];
  let rootId = data.rootId ?? null;

  for (const p of data.aiFilledPrefixes ?? []) {
    const text = typeof p === "object" && p?.text?.trim() ? p.text.trim() : "";
    if (!text) continue;
    const meanings = Array.isArray(p.meanings)
      ? (p.meanings as string[]).filter((s) => typeof s === "string")
      : [];
    const id = await getOrCreateMorpheme("prefix", text, meanings);
    if (id != null && !prefixIds.includes(id)) prefixIds.push(id);
  }
  for (const s of data.aiFilledSuffixes ?? []) {
    const text = typeof s === "object" && s?.text?.trim() ? s.text.trim() : "";
    if (!text) continue;
    const meanings = Array.isArray(s.meanings)
      ? (s.meanings as string[]).filter((s0) => typeof s0 === "string")
      : [];
    const id = await getOrCreateMorpheme("suffix", text, meanings);
    if (id != null && !suffixIds.includes(id)) suffixIds.push(id);
  }
  if (
    data.aiFilledRoot &&
    typeof data.aiFilledRoot === "object" &&
    data.aiFilledRoot.text?.trim()
  ) {
    const r = data.aiFilledRoot;
    const meanings = Array.isArray(r.meanings)
      ? (r.meanings as string[]).filter((s) => typeof s === "string")
      : [];
    const id = await getOrCreateMorpheme("root", r.text.trim(), meanings);
    if (id != null) rootId = id;
  }
  return { prefixIds, suffixIds, rootId };
}

/** 根据 id 获取单个单词（含关联） */
export async function getVocabularyEntryById(id: number) {
  const e = await db.vocabularyEntry.findUnique({
    where: { id },
    include: {
      category: { select: { name: true } },
      morphemes: { include: { morpheme: true } },
    },
  });
  if (!e) return null;

  const prefixRels = e.morphemes.filter((r) => r.role === "prefix");
  const suffixRels = e.morphemes.filter((r) => r.role === "suffix");
  const rootRel = e.morphemes.find((r) => r.role === "root");

  return {
    id: e.id,
    word: e.word,
    wordLower: e.wordLower,
    phonetic: e.phonetic,
    mnemonic: e.mnemonic ?? null,
    categoryId: e.categoryId,
    categoryName: e.category?.name ?? null,
    meanings: parseMeaningsJson(e.meanings),
    prefixIds: prefixRels.map((r) => r.morphemeId),
    suffixIds: suffixRels.map((r) => r.morphemeId),
    rootId: rootRel?.morphemeId ?? null,
    prefixes: prefixRels.map((r) => ({
      text: normalizeMorphemeText(r.morpheme.text),
      meanings: parseMorphemeMeaningsJson(r.morpheme.meanings),
    })),
    suffixes: suffixRels.map((r) => ({
      text: normalizeMorphemeText(r.morpheme.text),
      meanings: parseMorphemeMeaningsJson(r.morpheme.meanings),
    })),
    root: rootRel
      ? {
          text: normalizeMorphemeText(rootRel.morpheme.text),
          meanings: parseMorphemeMeaningsJson(rootRel.morpheme.meanings),
        }
      : null,
    collocations: parseCollocationsJson(e.collocations),
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

/** 创建单词 */
export async function createVocabularyEntry(
  data: IVocabularyEntryFormData,
): Promise<{ id: number } | { error: string }> {
  const wordLower = normalizeWord(data.word);
  if (!wordLower) return { error: "单词不能为空" };

  const existing = await db.vocabularyEntry.findUnique({
    where: { wordLower },
  });
  if (existing) return { error: "该单词已存在" };

  const categoryId =
    data.categoryId != null && data.categoryId > 0 ? data.categoryId : null;
  if (data.categoryId != null && data.categoryId > 0) {
    const cat = await db.vocabularyCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!cat) return { error: "无效的分类" };
  }

  const meaningsJson =
    data.meanings?.length > 0
      ? JSON.stringify(
          data.meanings.filter(
            (m) => m.partOfSpeech?.trim() && m.meanings?.length,
          ),
        )
      : null;

  const collocationsJson =
    (data.collocations?.length ?? 0) > 0
      ? JSON.stringify(
          (data.collocations ?? [])
            .filter((c) => typeof c.phrase === "string" && c.phrase.trim())
            .map((c) => ({
              phrase: c.phrase.trim(),
              meaning: String(c.meaning ?? "").trim(),
            })),
        )
      : null;

  const entry = await db.vocabularyEntry.create({
    data: {
      word: data.word.trim(),
      wordLower,
      phonetic: data.phonetic?.trim() || null,
      mnemonic: data.mnemonic?.trim() || null,
      categoryId,
      meanings: meaningsJson,
      collocations: collocationsJson,
    },
  });

  await syncEntryPartOfSpeech(entry.id, parseMeaningsJson(meaningsJson));

  const { prefixIds, suffixIds, rootId } =
    await resolveAiFilledAndMergeIds(data);

  const morphemeInserts: Array<{
    entryId: number;
    morphemeId: number;
    role: "prefix" | "suffix" | "root";
  }> = [];

  for (const id of prefixIds) {
    if (id > 0)
      morphemeInserts.push({
        entryId: entry.id,
        morphemeId: id,
        role: "prefix",
      });
  }
  for (const id of suffixIds) {
    if (id > 0)
      morphemeInserts.push({
        entryId: entry.id,
        morphemeId: id,
        role: "suffix",
      });
  }
  if (rootId != null && rootId > 0) {
    morphemeInserts.push({
      entryId: entry.id,
      morphemeId: rootId,
      role: "root",
    });
  }

  if (morphemeInserts.length > 0) {
    await db.vocabularyEntryMorpheme.createMany({
      data: morphemeInserts,
    });
  }

  return { id: entry.id };
}

/** 更新单词 */
export async function updateVocabularyEntry(
  id: number,
  data: IVocabularyEntryFormData,
  options?: {
    /** AI 回填时传 true：若库中已有分类则不覆盖 */ preserveCategoryIfSet?: boolean;
  },
): Promise<{ ok: true } | { error: string }> {
  const entry = await db.vocabularyEntry.findUnique({ where: { id } });
  if (!entry) return { error: "单词不存在" };

  const wordLower = normalizeWord(data.word);
  if (!wordLower) return { error: "单词不能为空" };

  const duplicate = await db.vocabularyEntry.findFirst({
    where: { wordLower, id: { not: id } },
  });
  if (duplicate) return { error: "该单词已存在" };

  const hasExistingCategory =
    entry.categoryId != null && Number(entry.categoryId) > 0;
  const preserveCategory =
    Boolean(options?.preserveCategoryIfSet) && hasExistingCategory;
  const categoryId = preserveCategory ? entry.categoryId : data.categoryId;
  const meaningsJson =
    data.meanings?.length > 0
      ? JSON.stringify(
          data.meanings.filter(
            (m) => m.partOfSpeech?.trim() && m.meanings?.length,
          ),
        )
      : null;
  const collocationsJson =
    (data.collocations?.length ?? 0) > 0
      ? JSON.stringify(
          (data.collocations ?? [])
            .filter((c) => typeof c.phrase === "string" && c.phrase.trim())
            .map((c) => ({
              phrase: c.phrase.trim(),
              meaning: String(c.meaning ?? "").trim(),
            })),
        )
      : null;

  await db.vocabularyEntry.update({
    where: { id },
    data: {
      word: data.word.trim(),
      wordLower,
      phonetic: data.phonetic?.trim() || null,
      mnemonic: data.mnemonic?.trim() || null,
      categoryId,
      meanings: meaningsJson,
      collocations: collocationsJson,
    },
  });

  await syncEntryPartOfSpeech(id, parseMeaningsJson(meaningsJson));

  await db.vocabularyEntryMorpheme.deleteMany({ where: { entryId: id } });

  const { prefixIds, suffixIds, rootId } =
    await resolveAiFilledAndMergeIds(data);

  const morphemeInserts: Array<{
    entryId: number;
    morphemeId: number;
    role: "prefix" | "suffix" | "root";
  }> = [];
  for (const mid of prefixIds) {
    if (mid > 0)
      morphemeInserts.push({ entryId: id, morphemeId: mid, role: "prefix" });
  }
  for (const mid of suffixIds) {
    if (mid > 0)
      morphemeInserts.push({ entryId: id, morphemeId: mid, role: "suffix" });
  }
  if (rootId != null && rootId > 0) {
    morphemeInserts.push({
      entryId: id,
      morphemeId: rootId,
      role: "root",
    });
  }
  if (morphemeInserts.length > 0) {
    await db.vocabularyEntryMorpheme.createMany({
      data: morphemeInserts,
    });
  }

  return { ok: true };
}

/** 删除单词 */
export async function deleteVocabularyEntry(
  id: number,
): Promise<{ ok: true } | { error: string }> {
  const entry = await db.vocabularyEntry.findUnique({ where: { id } });
  if (!entry) return { error: "单词不存在" };

  await db.vocabularyEntry.delete({ where: { id } });
  return { ok: true };
}

/** 创建语素（供表单「新建前缀/后缀/词根」使用），已存在则返回已有 id 并合并新释义；词素文本会去掉首尾 - */
export async function createVocabularyMorpheme(
  type: "prefix" | "suffix" | "root",
  text: string,
  meanings: string[],
): Promise<{ id: number } | { error: string }> {
  const normalized = normalizeMorphemeText(text);
  if (!normalized) return { error: "文本不能为空" };

  const existing = await db.vocabularyMorpheme.findUnique({
    where: { type_text: { type, text: normalized } },
  });
  if (existing) {
    const existingMeanings = parseMorphemeMeaningsJson(existing.meanings);
    const combined = [...existingMeanings];
    for (const m of meanings) {
      const trimmed = typeof m === "string" ? m.trim() : "";
      if (trimmed && !combined.includes(trimmed)) {
        combined.push(trimmed);
      }
    }
    if (combined.length > existingMeanings.length) {
      await db.vocabularyMorpheme.update({
        where: { id: existing.id },
        data: { meanings: JSON.stringify(combined) },
      });
    }
    return { id: existing.id };
  }

  const created = await db.vocabularyMorpheme.create({
    data: {
      type,
      text: normalized,
      meanings: JSON.stringify(meanings),
    },
  });
  return { id: created.id };
}

/** 根据 AI 补全结果解析/创建语素并返回 id 列表（供前端回填前缀/后缀/词根选择） */
export async function resolveMorphemeIdsFromAiResult(ai: {
  prefixes?: IMorphemeItem[];
  suffixes?: IMorphemeItem[];
  root?: IMorphemeItem | null;
}): Promise<{
  prefixIds: number[];
  suffixIds: number[];
  rootId: number | null;
}> {
  const prefixIds: number[] = [];
  const suffixIds: number[] = [];
  let rootId: number | null = null;

  for (const p of ai.prefixes ?? []) {
    const text = typeof p === "object" && p?.text?.trim() ? p.text.trim() : "";
    if (!text) continue;
    const meanings = Array.isArray(p.meanings)
      ? (p.meanings as string[]).filter((s) => typeof s === "string")
      : [];
    const id = await getOrCreateMorpheme("prefix", text, meanings);
    if (id != null) prefixIds.push(id);
  }
  for (const s of ai.suffixes ?? []) {
    const text = typeof s === "object" && s?.text?.trim() ? s.text.trim() : "";
    if (!text) continue;
    const meanings = Array.isArray(s.meanings)
      ? (s.meanings as string[]).filter((x) => typeof x === "string")
      : [];
    const id = await getOrCreateMorpheme("suffix", text, meanings);
    if (id != null) suffixIds.push(id);
  }
  if (ai.root && typeof ai.root === "object" && ai.root.text?.trim()) {
    const text = ai.root.text.trim();
    const meanings = Array.isArray(ai.root.meanings)
      ? (ai.root.meanings as string[]).filter((x) => typeof x === "string")
      : [];
    const id = await getOrCreateMorpheme("root", text, meanings);
    if (id != null) rootId = id;
  }

  return { prefixIds, suffixIds, rootId };
}

/** 获取所有分类（供下拉） */
export async function getVocabularyCategories() {
  const list = await db.vocabularyCategory.findMany({
    orderBy: { id: "asc" },
  });
  return list.map((c) => ({ id: c.id, name: c.name }));
}

/** 校验分类名是否在预置 22 个中（可选） */
export async function isVocabularyCategoryName(name: string): Promise<boolean> {
  return (VOCABULARY_CATEGORIES as readonly string[]).includes(name);
}
