"use server";

import { db } from "@/modules/db/client";
import type { VocabularyEntryWhereInput } from "@/modules/db/generated/models/VocabularyEntry";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type {
  ICollocationItem,
  IMorphemeItem,
  IPartOfSpeechMeaning,
  IVocabularyAiFillResult,
  IVocabularyEntryFormData,
  IVocabularyFilter,
  IVocabularyFilterOptions,
  VocabularyBatchParseResultInferred,
} from "./core";
import {
  PARTS_OF_SPEECH,
  safeParseVocabularyAiFillResult,
  safeParseVocabularyBatchParseResult,
  safeParseVocabularyWordsOnly,
  VOCABULARY_BATCH_FILL_SIZE,
  VOCABULARY_CATEGORIES,
  vocabularyAiFillResultSchema,
  vocabularyBatchParseResultSchema,
  vocabularyWordsOnlySchema,
} from "./core";

const DEFAULT_AI_MODEL = "gpt-4o-mini";

function parseMeaningsJson(raw: string | null): IPartOfSpeechMeaning[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a.filter(
      (x): x is IPartOfSpeechMeaning =>
        typeof x === "object" &&
        x != null &&
        "partOfSpeech" in x &&
        "meanings" in x &&
        Array.isArray((x as IPartOfSpeechMeaning).meanings),
    ) as IPartOfSpeechMeaning[];
  } catch {
    return [];
  }
}

function parseCollocationsJson(raw: string | null): ICollocationItem[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a
      .map((x): ICollocationItem | null => {
        if (typeof x === "string" && x.trim() !== "")
          return { phrase: x.trim(), meaning: "" };
        if (
          typeof x === "object" &&
          x != null &&
          "phrase" in x &&
          typeof (x as ICollocationItem).phrase === "string"
        ) {
          const o = x as ICollocationItem;
          return o.phrase.trim() !== ""
            ? {
                phrase: o.phrase.trim(),
                meaning: String(o.meaning ?? "").trim(),
              }
            : null;
        }
        return null;
      })
      .filter((item): item is ICollocationItem => item != null);
  } catch {
    return [];
  }
}

function parseMorphemeMeaningsJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    return Array.isArray(a)
      ? a.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** 词素文本统一格式：去掉首尾的连字符 -，如 hydro- / -sphere -> hydro / sphere */
function normalizeMorphemeText(s: string): string {
  return s.trim().replace(/^-+|-+$/g, "");
}

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

/** 获取筛选选项：词性、前缀、后缀、词根、分类 */
export async function getVocabularyFilterOptions(): Promise<IVocabularyFilterOptions> {
  const [categories, morphemes, posRows] = await Promise.all([
    db.vocabularyCategory.findMany({ orderBy: { id: "asc" } }),
    db.vocabularyMorpheme.findMany({
      orderBy: [{ type: "asc" }, { text: "asc" }],
    }),
    db.vocabularyEntryPartOfSpeech.findMany({
      select: { partOfSpeech: true },
      distinct: ["partOfSpeech"],
    }),
  ]);

  const prefixes = morphemes.filter((m) => m.type === "prefix");
  const suffixes = morphemes.filter((m) => m.type === "suffix");
  const roots = morphemes.filter((m) => m.type === "root");

  return {
    partsOfSpeech: [...new Set(posRows.map((r) => r.partOfSpeech))].sort(),
    prefixes: prefixes.map((m) => ({
      id: m.id,
      text: normalizeMorphemeText(m.text),
      meanings: parseMorphemeMeaningsJson(m.meanings),
    })),
    suffixes: suffixes.map((m) => ({
      id: m.id,
      text: normalizeMorphemeText(m.text),
      meanings: parseMorphemeMeaningsJson(m.meanings),
    })),
    roots: roots.map((m) => ({
      id: m.id,
      text: normalizeMorphemeText(m.text),
      meanings: parseMorphemeMeaningsJson(m.meanings),
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  };
}

/** 按条件筛选单词列表（分页） */
export async function getVocabularyEntries(
  filter: IVocabularyFilter,
  options: { page?: number; pageSize?: number } = {},
): Promise<{
  items: Array<{
    id: number;
    word: string;
    wordLower: string;
    phonetic: string | null;
    mnemonic: string | null;
    categoryId: number | null;
    categoryName: string | null;
    meanings: IPartOfSpeechMeaning[];
    prefixes: IMorphemeItem[];
    suffixes: IMorphemeItem[];
    root: IMorphemeItem | null;
    collocations: ICollocationItem[];
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, options.pageSize ?? 200));

  const where: VocabularyEntryWhereInput = {};

  if (filter.partOfSpeech?.length) {
    where.partsOfSpeech = {
      some: { partOfSpeech: { in: filter.partOfSpeech } },
    };
  }
  if (filter.categoryIds?.length) {
    where.categoryId = { in: filter.categoryIds };
  }
  if (filter.createdAtFrom ?? filter.createdAtTo) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (filter.createdAtFrom) {
      createdAt.gte = new Date(`${filter.createdAtFrom}T00:00:00.000Z`);
    }
    if (filter.createdAtTo) {
      createdAt.lte = new Date(`${filter.createdAtTo}T23:59:59.999Z`);
    }
    where.createdAt = createdAt;
  }
  if (
    filter.prefixIds?.length ||
    filter.suffixIds?.length ||
    filter.rootIds?.length
  ) {
    const and: Array<Record<string, unknown>> = [];
    if (filter.prefixIds?.length) {
      and.push({
        morphemes: {
          some: {
            morphemeId: { in: filter.prefixIds },
            role: "prefix",
          },
        },
      });
    }
    if (filter.suffixIds?.length) {
      and.push({
        morphemes: {
          some: {
            morphemeId: { in: filter.suffixIds },
            role: "suffix",
          },
        },
      });
    }
    if (filter.rootIds?.length) {
      and.push({
        morphemes: {
          some: {
            morphemeId: { in: filter.rootIds },
            role: "root",
          },
        },
      });
    }
    if (and.length) where.AND = and;
  }

  const [items, total] = await Promise.all([
    db.vocabularyEntry.findMany({
      where,
      include: {
        category: { select: { name: true } },
        morphemes: { include: { morpheme: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.vocabularyEntry.count({ where }),
  ]);

  const result = items.map((e) => {
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
  });

  return { items: result, total };
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

/** 创建单词 */
export async function createVocabularyEntry(
  data: IVocabularyEntryFormData,
): Promise<{ id: number } | { error: string }> {
  const wordLower = data.word.trim().toLowerCase();
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

  const wordLower = data.word.trim().toLowerCase();
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

  // 与 create 一致：解析 aiFilledPrefixes / aiFilledSuffixes / aiFilledRoot 并创建词素关联（AI 回填时依赖此处）
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

/** 词汇 AI 配置（供后台回填使用），可选传入以写入 DB */
export type IVocabularyAiConfig = {
  baseUrl?: string;
  accessToken?: string;
  model?: string;
};

/** 将当前 AI 配置同步到 VocabularyAiSettings 表，供后台定时任务读取（页面修改 Leva 后调用） */
export async function upsertVocabularyAiSettings(
  aiConfig: IVocabularyAiConfig,
): Promise<{ ok: true } | { error: string }> {
  const baseUrl =
    typeof aiConfig.baseUrl === "string" && aiConfig.baseUrl.trim()
      ? aiConfig.baseUrl.trim().replace(/\/$/, "")
      : "https://api.openai.com/v1";
  const accessToken =
    typeof aiConfig.accessToken === "string" && aiConfig.accessToken.trim()
      ? aiConfig.accessToken.trim()
      : "";
  const model =
    typeof aiConfig.model === "string" && aiConfig.model.trim()
      ? aiConfig.model.trim()
      : DEFAULT_AI_MODEL;
  const existing = await db.vocabularyAiSettings.findFirst({
    orderBy: { id: "asc" },
  });
  if (existing) {
    await db.vocabularyAiSettings.update({
      where: { id: existing.id },
      data: { baseUrl, accessToken, model, updatedAt: new Date() },
    });
  } else {
    await db.vocabularyAiSettings.create({
      data: { baseUrl, accessToken, model },
    });
  }
  return { ok: true };
}

/** 创建词汇导入任务（一单词一条 Task）；可选写入 AI 配置到 VocabularyAiSettings */
export async function createVocabularyImportTasks(
  words: string[],
  aiConfig?: IVocabularyAiConfig,
): Promise<{ ok: true; count: number } | { error: string }> {
  const list = [
    ...new Set(
      words
        .filter((w) => typeof w === "string" && w.trim().length > 0)
        .map((w) => (w as string).trim()),
    ),
  ];
  if (list.length === 0) return { error: "单词列表为空" };

  if (aiConfig) {
    const baseUrl =
      typeof aiConfig.baseUrl === "string" && aiConfig.baseUrl.trim()
        ? aiConfig.baseUrl.trim().replace(/\/$/, "")
        : "https://api.openai.com/v1";
    const accessToken =
      typeof aiConfig.accessToken === "string" && aiConfig.accessToken.trim()
        ? aiConfig.accessToken.trim()
        : "";
    const model =
      typeof aiConfig.model === "string" && aiConfig.model.trim()
        ? aiConfig.model.trim()
        : DEFAULT_AI_MODEL;
    const existing = await db.vocabularyAiSettings.findFirst({
      orderBy: { id: "asc" },
    });
    if (existing) {
      await db.vocabularyAiSettings.update({
        where: { id: existing.id },
        data: { baseUrl, accessToken, model, updatedAt: new Date() },
      });
    } else {
      await db.vocabularyAiSettings.create({
        data: { baseUrl, accessToken, model },
      });
    }
  }

  await db.vocabularyAiFillTask.createMany({
    data: list.map((word) => ({
      word,
      status: "PENDING",
    })),
  });
  return { ok: true, count: list.length };
}

/** 获取当前 AI 回填任务列表（无过滤，最近 200 条） */
export async function getVocabularyImportTasks(): Promise<{
  tasks: Array<{
    id: number;
    word: string;
    status: string;
    error: string | null;
    createdAt: Date;
  }>;
}> {
  const rows = await db.vocabularyAiFillTask.findMany({
    orderBy: { id: "desc" },
    take: 200,
    select: {
      id: true,
      word: true,
      status: true,
      error: true,
      createdAt: true,
    },
  });
  return {
    tasks: rows.map((r) => ({
      id: r.id,
      word: r.word,
      status: r.status,
      error: r.error,
      createdAt: r.createdAt,
    })),
  };
}

/** 批量创建词条（一键保存）；与 AI 回填 Task 无关 */
export async function createVocabularyEntriesBatch(
  entries: IVocabularyEntryFormData[],
): Promise<{ ok: true; saved: number; errors: string[] } | { error: string }> {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { error: "条目列表为空" };
  }
  const errors: string[] = [];
  let saved = 0;
  for (const data of entries) {
    const result = await createVocabularyEntry(data);
    if ("id" in result) saved++;
    else errors.push(`${data.word?.trim() ?? "?"}: ${result.error}`);
  }
  return { ok: true, saved, errors };
}

/** 按单词列表批量更新分类（用于批量导入后统一设置分类；categoryId 为 null 则清空） */
export async function updateVocabularyEntriesCategoryByWords(
  words: string[],
  categoryId: number | null,
): Promise<{ ok: true; updated: number } | { error: string }> {
  if (!Array.isArray(words) || words.length === 0) {
    return { error: "单词列表为空" };
  }
  const wordLowers = [
    ...new Set(
      words
        .filter((w) => typeof w === "string" && w.trim())
        .map((w) => w.trim().toLowerCase()),
    ),
  ];
  if (wordLowers.length === 0) return { ok: true, updated: 0 };
  const result = await db.vocabularyEntry.updateMany({
    where: { wordLower: { in: wordLowers } },
    data: { categoryId },
  });
  return { ok: true, updated: result.count };
}

/** RUNNING 超过此时长（毫秒）视为进程异常退出，重置为 PENDING 以便重试 */
const VOCABULARY_AI_FILL_STALE_RUNNING_MS = 5 * 60 * 1000; // 5 分钟

/** 执行一批 AI 回填：读 settings、取 PENDING、调 LLM、写库并更新 Task（供定时任务与 API 复用） */
export async function runVocabularyAiFillBatch(): Promise<void> {
  const settings = await db.vocabularyAiSettings.findFirst({
    orderBy: { id: "asc" },
  });
  if (!settings) {
    console.log("[词汇 AI 回填] 无 VocabularyAiSettings，跳过本轮");
    return;
  }
  if (!settings.accessToken?.trim()) {
    console.log("[词汇 AI 回填] 未配置 accessToken，跳过本轮");
    return;
  }

  // 进程挂掉后重启：将长时间未完成的 RUNNING 重置为 PENDING，避免永远卡住
  const staleThreshold = new Date(
    Date.now() - VOCABULARY_AI_FILL_STALE_RUNNING_MS,
  );
  const reset = await db.vocabularyAiFillTask.updateMany({
    where: {
      status: "RUNNING",
      updatedAt: { lt: staleThreshold },
    },
    data: { status: "PENDING", error: null, updatedAt: new Date() },
  });
  if (reset.count > 0) {
    console.log(
      "[词汇 AI 回填] 已将",
      reset.count,
      "条超时 RUNNING 重置为 PENDING",
    );
  }

  const pending = await db.vocabularyAiFillTask.findMany({
    where: { status: "PENDING" },
    orderBy: { id: "asc" },
    take: VOCABULARY_BATCH_FILL_SIZE,
  });
  if (pending.length === 0) return;

  const taskIds = pending.map((t) => t.id);
  await db.vocabularyAiFillTask.updateMany({
    where: { id: { in: taskIds } },
    data: { status: "RUNNING", updatedAt: new Date() },
  });

  const words = pending.map((t) => t.word);
  const opts = {
    baseUrl: settings.baseUrl || undefined,
    accessToken: settings.accessToken,
    model: settings.model || undefined,
  };

  try {
    const result = await aiFillVocabularyBatch(words, opts);
    if ("error" in result) {
      for (const id of taskIds) {
        await db.vocabularyAiFillTask.update({
          where: { id },
          data: {
            status: "FAILED",
            error: result.error,
            updatedAt: new Date(),
          },
        });
      }
      return;
    }

    const formDataList = result as IVocabularyEntryFormData[];
    for (let i = 0; i < pending.length; i++) {
      const task = pending[i];
      const data = formDataList[i];
      if (!data) {
        await db.vocabularyAiFillTask.update({
          where: { id: task.id },
          data: {
            status: "FAILED",
            error: "本批结果缺少对应条目",
            updatedAt: new Date(),
          },
        });
        continue;
      }
      const wordLower = data.word.trim().toLowerCase();
      const existing = await db.vocabularyEntry.findUnique({
        where: { wordLower },
      });
      if (existing) {
        const updateResult = await updateVocabularyEntry(existing.id, data, {
          preserveCategoryIfSet: true,
        });
        if ("ok" in updateResult) {
          await db.vocabularyAiFillTask.update({
            where: { id: task.id },
            data: {
              status: "COMPLETED",
              result: JSON.stringify({ entryId: existing.id }),
              error: null,
              updatedAt: new Date(),
            },
          });
        } else {
          await db.vocabularyAiFillTask.update({
            where: { id: task.id },
            data: {
              status: "FAILED",
              error: updateResult.error ?? "未知错误",
              updatedAt: new Date(),
            },
          });
        }
      } else {
        const createResult = await createVocabularyEntry(data);
        if ("id" in createResult) {
          await db.vocabularyAiFillTask.update({
            where: { id: task.id },
            data: {
              status: "COMPLETED",
              result: JSON.stringify({ entryId: createResult.id }),
              error: null,
              updatedAt: new Date(),
            },
          });
        } else if (createResult.error === "该单词已存在") {
          // 重试场景：词条已在上次写入，进程在写 COMPLETED 前挂了，本次视为成功
          const entry = await db.vocabularyEntry.findUnique({
            where: { wordLower },
            select: { id: true },
          });
          await db.vocabularyAiFillTask.update({
            where: { id: task.id },
            data: {
              status: "COMPLETED",
              result: entry ? JSON.stringify({ entryId: entry.id }) : null,
              error: null,
              updatedAt: new Date(),
            },
          });
        } else {
          await db.vocabularyAiFillTask.update({
            where: { id: task.id },
            data: {
              status: "FAILED",
              error: createResult.error ?? "未知错误",
              updatedAt: new Date(),
            },
          });
        }
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[词汇 AI 回填] 本批异常:", message);
    // 仅将仍为 RUNNING 的任务标为 FAILED，避免覆盖循环中已标为 COMPLETED 的任务
    await db.vocabularyAiFillTask
      .updateMany({
        where: { id: { in: taskIds }, status: "RUNNING" },
        data: {
          status: "FAILED",
          error: message,
          updatedAt: new Date(),
        },
      })
      .catch(() => {});
  }
}

/** AI 补全单词：使用 OpenAI 官方库 + JSON Schema（Zod）规范与校验返回（Server Action） */
export async function aiFillVocabulary(
  word: string,
  options?: { baseUrl?: string; accessToken?: string; model?: string },
): Promise<IVocabularyAiFillResult | { error: string }> {
  const w = typeof word === "string" ? word.trim() : "";
  if (!w) return { error: "单词不能为空" };

  const baseUrl =
    (typeof options?.baseUrl === "string" && options.baseUrl.trim()
      ? options.baseUrl.trim().replace(/\/$/, "")
      : process.env["OPENAI_API_BASE"]) ?? "https://api.openai.com/v1";
  const accessToken =
    (typeof options?.accessToken === "string" && options.accessToken.trim()
      ? options.accessToken.trim()
      : process.env["OPENAI_API_KEY"]) ?? "";
  const model =
    (typeof options?.model === "string" && options.model.trim()
      ? options.model.trim()
      : process.env["OPENAI_MODEL"]) ?? DEFAULT_AI_MODEL;

  if (!accessToken) {
    return {
      error:
        "请设置 API Key：在设置中配置「词汇」下的 API Key，或配置环境变量 OPENAI_API_KEY",
    };
  }

  const categoryList = VOCABULARY_CATEGORIES.join("、");
  const posList = (PARTS_OF_SPEECH as readonly string[]).join(", ");
  const systemPrompt = `You are a helpful assistant that fills vocabulary data for English words.
Given an English word, return a JSON object with: phonetic (IPA), mnemonic (记法), partOfSpeechMeanings (array of { partOfSpeech, meanings }), prefixes/suffixes (array of { text, meanings }), root ({ text, meanings } or null), category (must be exactly one of these 22 strings, no abbreviation: ${categoryList}. e.g. use "自然地理" not "地理"), collocations (array of { phrase: string, meaning: string }: 固定搭配，如 [{ phrase: "pay attention", meaning: "注意" }]; empty array or null if none).
partOfSpeech: MUST be exactly one of: ${posList}. Do NOT use "n." or "v." alone. For nouns use only n.[C], n.[U], or n.[C/U]. For verbs use only vi. or vt.
mnemonic: one short sentence in Chinese on how to remember the word, following MFP (Meaning-Form-Pronunciation). Prefer memory tips based on word roots and affixes (词根词缀), e.g. "hydro 水 + sphere 球 → 水圈、地球" or "trans- 穿过 + port 携带 → 运输". Use null if no good mnemonic.
Morpheme text (prefixes/suffixes/root): do not include leading or trailing hyphens; use "hydro" not "hydro-", "sphere" not "-sphere".
Use empty arrays or omit fields if unknown. All meanings in Chinese.`;

  const userContent = `Fill vocabulary data for the word: "${w}"`;

  const requestPayload = {
    baseURL: baseUrl,
    model,
    messages: [
      { role: "system" as const, content: systemPrompt },
      { role: "user" as const, content: userContent },
    ],
    response_format: "zodResponseFormat(vocabulary_fill)",
    temperature: 0.7,
  };
  console.log("[词汇 AI] 请求:", JSON.stringify(requestPayload, null, 2));

  try {
    const client = new OpenAI({
      apiKey: accessToken,
      baseURL: baseUrl,
    });

    const completion = await client.chat.completions.parse({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: zodResponseFormat(
        vocabularyAiFillResultSchema,
        "vocabulary_fill",
      ),
      temperature: 0.7,
    });

    console.log("[词汇 AI] 已收到 completion，开始打印响应");

    const message = completion.choices?.[0]?.message;
    const raw = (message as { parsed?: unknown })?.parsed;
    const content = (message as { content?: string | null })?.content;

    if (!message) {
      console.log(
        "[词汇 AI] 响应 choices 原始结构:",
        JSON.stringify(completion.choices ?? [], null, 2),
      );
    }

    console.log("[词汇 AI] 响应 meta:", {
      id: completion.id,
      model: completion.model,
      usage: completion.usage,
    });
    console.log(
      "[词汇 AI] 响应 message.content:",
      typeof content === "string" ? content : "(无 content)",
    );
    if (raw != null) {
      console.log(
        "[词汇 AI] 响应 message.parsed:",
        JSON.stringify(raw, null, 2),
      );
    } else {
      console.log("[词汇 AI] 响应 message.parsed: (无 parsed)");
    }

    if (raw == null) {
      if (typeof content === "string" && content.trim()) {
        const parsed = JSON.parse(content) as unknown;
        const result = safeParseVocabularyAiFillResult(parsed);
        if (result.success) {
          console.log(
            "[词汇 AI] 校验通过(从 content 解析):",
            JSON.stringify(result.data, null, 2),
          );
          return result.data as IVocabularyAiFillResult;
        }
        console.warn("[词汇 AI] 校验失败:", result.error.message);
        return {
          error: `返回格式校验失败: ${result.error.message}`,
        };
      }
      return { error: "接口返回为空" };
    }

    const result = safeParseVocabularyAiFillResult(raw);
    if (result.success) {
      console.log("[词汇 AI] 校验通过:", JSON.stringify(result.data, null, 2));
      return result.data as IVocabularyAiFillResult;
    }
    console.warn("[词汇 AI] 校验失败:", result.error.message);
    return {
      error: `返回格式校验失败: ${result.error.message}`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: `请求失败: ${message}` };
  }
}

/** 将 API 返回的批量条目中 undefined 规范为 null，以通过严格 schema（与 vocabularyAiFillResultSchema 一致） */
function normalizeBatchParseRaw(data: unknown): {
  entries: Array<Record<string, unknown>>;
} {
  const obj = data as { entries?: unknown[] };
  if (!obj || !Array.isArray(obj.entries)) return { entries: [] };
  return {
    entries: obj.entries.map((e: unknown) => {
      const o = (e != null && typeof e === "object" ? e : {}) as Record<
        string,
        unknown
      >;
      return {
        word: o.word ?? "",
        phonetic: o.phonetic ?? null,
        mnemonic: o.mnemonic ?? null,
        partOfSpeechMeanings: o.partOfSpeechMeanings ?? null,
        prefixes: o.prefixes ?? null,
        suffixes: o.suffixes ?? null,
        root: o.root ?? null,
        category: o.category ?? null,
        collocations: o.collocations ?? null,
      };
    }),
  };
}

/** 将批量解析的 entries 转为 IVocabularyEntryFormData[]（供 aiParseBatchVocabulary / aiFillVocabularyBatch 复用） */
function mapBatchParseEntriesToFormData(
  entries: VocabularyBatchParseResultInferred["entries"],
  categoryByName: Map<string, number>,
): IVocabularyEntryFormData[] {
  return entries.map((e) => {
    const partOfSpeechMeanings = e.partOfSpeechMeanings ?? [];
    const meanings: IPartOfSpeechMeaning[] =
      partOfSpeechMeanings.length > 0
        ? partOfSpeechMeanings.map((m) => ({
            partOfSpeech: m.partOfSpeech,
            meanings: Array.isArray(m.meanings) ? m.meanings : [""],
          }))
        : [{ partOfSpeech: "n.[C]", meanings: [""] }];
    const categoryId = e.category
      ? (categoryByName.get(e.category) ?? null)
      : null;
    return {
      word: e.word.trim(),
      phonetic: e.phonetic ?? "",
      mnemonic: e.mnemonic ?? "",
      meanings,
      prefixIds: [],
      suffixIds: [],
      rootId: null,
      categoryId,
      aiFilledPrefixes: (e.prefixes ?? []).filter(
        (p): p is IMorphemeItem =>
          typeof p === "object" && p != null && "text" in p && "meanings" in p,
      ) as IMorphemeItem[],
      aiFilledSuffixes: (e.suffixes ?? []).filter(
        (s): s is IMorphemeItem =>
          typeof s === "object" && s != null && "text" in s && "meanings" in s,
      ) as IMorphemeItem[],
      aiFilledRoot:
        e.root && typeof e.root === "object" && "text" in e.root
          ? (e.root as IMorphemeItem)
          : null,
      collocations: (e.collocations ?? [])
        .filter(
          (c): c is ICollocationItem =>
            typeof c === "object" &&
            c != null &&
            typeof (c as ICollocationItem).phrase === "string" &&
            (c as ICollocationItem).phrase.trim() !== "",
        )
        .map((c) => ({
          phrase: (c as ICollocationItem).phrase.trim(),
          meaning: String((c as ICollocationItem).meaning ?? "").trim(),
        })),
    };
  });
}

/** 仅提取单词：从粘贴文本中识别英文单词列表，无释义等（响应小、速度快） */
export async function aiExtractWordsOnly(
  rawText: string,
  options?: { baseUrl?: string; accessToken?: string; model?: string },
): Promise<string[] | { error: string }> {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) return { error: "请输入或粘贴要解析的文本" };

  const baseUrl =
    (typeof options?.baseUrl === "string" && options.baseUrl.trim()
      ? options.baseUrl.trim().replace(/\/$/, "")
      : process.env["OPENAI_API_BASE"]) ?? "https://api.openai.com/v1";
  const accessToken =
    (typeof options?.accessToken === "string" && options.accessToken.trim()
      ? options.accessToken.trim()
      : process.env["OPENAI_API_KEY"]) ?? "";
  const model =
    (typeof options?.model === "string" && options.model.trim()
      ? options.model.trim()
      : process.env["OPENAI_MODEL"]) ?? DEFAULT_AI_MODEL;

  if (!accessToken) {
    return {
      error:
        "请设置 API Key：在设置中配置「词汇」下的 API Key，或配置环境变量 OPENAI_API_KEY",
    };
  }

  const systemPrompt = `You are a helpful assistant. Extract from the user's text a list of English vocabulary words or phrases. Return ONLY a JSON object with one key "words" whose value is an array of strings. No definitions, no part of speech, no other fields. Preserve multi-word terms as single strings (e.g. "El Nino", "carbon dioxide"). Ignore line numbers and segment numbers. Deduplicate: each word appears once.`;

  const userContent = `Extract all English vocabulary words/phrases from this text. Return JSON: { "words": ["word1", "word2", ...] }\n\n${text}`;

  console.log("[词汇 仅提取单词] 请求:", {
    baseUrl,
    model,
    userContentLength: userContent.length,
  });

  try {
    const client = new OpenAI({
      apiKey: accessToken,
      baseURL: baseUrl,
    });

    const completion = await client.chat.completions.parse({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: zodResponseFormat(
        vocabularyWordsOnlySchema,
        "vocabulary_words_only",
      ),
      temperature: 0.2,
    });

    const message = completion.choices?.[0]?.message;
    const raw = (message as { parsed?: unknown })?.parsed;
    const content = (message as { content?: string | null })?.content;

    let words: string[];
    if (raw != null) {
      const result = safeParseVocabularyWordsOnly(raw);
      if (!result.success) {
        return { error: `返回格式校验失败: ${result.error.message}` };
      }
      words = result.data.words;
    } else if (typeof content === "string" && content.trim()) {
      const json = JSON.parse(content) as unknown;
      const result = safeParseVocabularyWordsOnly(json);
      if (!result.success) {
        return { error: `返回格式校验失败: ${result.error.message}` };
      }
      words = result.data.words;
    } else {
      return { error: "接口返回为空" };
    }

    const trimmed = words
      .filter((w) => typeof w === "string" && w.trim().length > 0)
      .map((w) => (w as string).trim());

    console.log("[词汇 仅提取单词] 单词列表:", trimmed);
    return trimmed.length > 0 ? trimmed : { error: "未识别到单词" };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: `请求失败: ${message}` };
  }
}

/** 分批表单回填：对一批单词（建议 ≤ VOCABULARY_BATCH_FILL_SIZE）请求完整词汇数据 */
export async function aiFillVocabularyBatch(
  words: string[],
  options?: { baseUrl?: string; accessToken?: string; model?: string },
): Promise<IVocabularyEntryFormData[] | { error: string }> {
  const list = Array.isArray(words)
    ? (words as string[]).filter((w) => typeof w === "string" && w.trim())
    : [];
  if (list.length === 0) return { error: "单词列表为空" };
  if (list.length > VOCABULARY_BATCH_FILL_SIZE) {
    return {
      error: `单批最多 ${VOCABULARY_BATCH_FILL_SIZE} 个单词，当前 ${list.length} 个`,
    };
  }

  const baseUrl =
    (typeof options?.baseUrl === "string" && options.baseUrl.trim()
      ? options.baseUrl.trim().replace(/\/$/, "")
      : process.env["OPENAI_API_BASE"]) ?? "https://api.openai.com/v1";
  const accessToken =
    (typeof options?.accessToken === "string" && options.accessToken.trim()
      ? options.accessToken.trim()
      : process.env["OPENAI_API_KEY"]) ?? "";
  const model =
    (typeof options?.model === "string" && options.model.trim()
      ? options.model.trim()
      : process.env["OPENAI_MODEL"]) ?? DEFAULT_AI_MODEL;

  if (!accessToken) {
    return {
      error:
        "请设置 API Key：在设置中配置「词汇」下的 API Key，或配置环境变量 OPENAI_API_KEY",
    };
  }

  const categoryList = VOCABULARY_CATEGORIES.join("、");
  const posList = (PARTS_OF_SPEECH as readonly string[]).join(", ");
  const systemPrompt = `You are a helpful assistant that fills vocabulary data for English words.
Given a list of English words, return a JSON object with key "entries": an array of objects, one per word, in the same order as the input list. Each object MUST include all of these fields:
- word (string)
- phonetic (IPA string or null)
- mnemonic (short Chinese memory tip based on roots/affixes, e.g. "hydro 水 + sphere 球 → 水圈"; or null if none)
- partOfSpeechMeanings (array of { partOfSpeech, meanings: string[] }, at least one; meanings in Chinese)
- prefixes (array of { text, meanings: string[] }, e.g. [{ "text": "hydro", "meanings": ["水"] }]; use [] if none, never omit)
- suffixes (array of { text, meanings: string[] }, e.g. [{ "text": "sphere", "meanings": ["球"] }]; use [] if none, never omit)
- root ({ text, meanings: string[] } or null)
- category (exactly one of: ${categoryList}, or null)
- collocations (array of { phrase: string, meaning: string }: 固定搭配，如 [{ phrase: "pay attention", meaning: "注意" }]; use [] if none, never omit)
partOfSpeech MUST be exactly one of: ${posList}. Do NOT use "n." or "v." alone. For words with clear etymology (e.g. atmosphere, hydrosphere), always fill mnemonic and prefixes/suffixes/root when applicable. Morpheme text: no leading/trailing hyphens. All meanings in Chinese.`;

  const wordListStr = list.map((w) => w.trim()).join("\n");
  const userContent = `Return vocabulary data for each of these words, in the same order. One entry per line:\n${wordListStr}`;

  console.log("[词汇 分批回填] 请求:", {
    baseUrl,
    model,
    wordsCount: list.length,
    words: list,
  });

  try {
    const client = new OpenAI({
      apiKey: accessToken,
      baseURL: baseUrl,
    });

    const completion = await client.chat.completions.parse({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: zodResponseFormat(
        vocabularyBatchParseResultSchema,
        "vocabulary_batch_fill",
      ),
      temperature: 0.3,
    });

    const message = completion.choices?.[0]?.message;
    const raw = (message as { parsed?: unknown })?.parsed;
    const content = (message as { content?: string | null })?.content;

    let parsed: VocabularyBatchParseResultInferred;
    if (raw != null) {
      const result = safeParseVocabularyBatchParseResult(
        normalizeBatchParseRaw(raw),
      );
      if (!result.success) {
        return { error: `返回格式校验失败: ${result.error.message}` };
      }
      parsed = result.data;
    } else if (typeof content === "string" && content.trim()) {
      const json = JSON.parse(content) as unknown;
      const result = safeParseVocabularyBatchParseResult(
        normalizeBatchParseRaw(json),
      );
      if (!result.success) {
        return { error: `返回格式校验失败: ${result.error.message}` };
      }
      parsed = result.data;
    } else {
      return { error: "接口返回为空" };
    }

    // 以下为摘要格式（仅用于日志可读），实际 parsed 符合 vocabularyBatchParseItemSchema（partOfSpeechMeanings 数组、prefixes/suffixes/root 为 { text, meanings }）
    const logEntries = parsed.entries.map((e) => ({
      word: e.word,
      phonetic: e.phonetic ?? null,
      mnemonic:
        e.mnemonic != null
          ? String(e.mnemonic).length > 50
            ? `${String(e.mnemonic).slice(0, 50)}…`
            : e.mnemonic
          : null,
      partOfSpeech: e.partOfSpeechMeanings?.[0]?.partOfSpeech,
      meanings: e.partOfSpeechMeanings?.[0]?.meanings?.slice(0, 2),
      prefixes:
        (e.prefixes?.length ?? 0) > 0
          ? (e.prefixes as { text: string }[]).map((p) => p.text)
          : [],
      suffixes:
        (e.suffixes?.length ?? 0) > 0
          ? (e.suffixes as { text: string }[]).map((s) => s.text)
          : [],
      root: e.root ? (e.root as { text: string }).text : null,
      category: e.category ?? null,
      collocations: e.collocations ?? [],
    }));
    console.log(
      "[词汇 分批回填] 本批条目:",
      JSON.stringify(logEntries, null, 2),
    );

    const categories = await db.vocabularyCategory.findMany({
      orderBy: { id: "asc" },
    });
    const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

    const formDataList = mapBatchParseEntriesToFormData(
      parsed.entries,
      categoryByName,
    );
    const byWord = new Map(
      formDataList.map((d) => [d.word.trim().toLowerCase(), d]),
    );
    const ordered = list.map((w) => {
      const key = w.trim().toLowerCase();
      return (
        byWord.get(key) ?? {
          word: w.trim(),
          phonetic: "",
          mnemonic: "",
          meanings: [{ partOfSpeech: "n.[C]", meanings: [""] }],
          prefixIds: [],
          suffixIds: [],
          rootId: null,
          categoryId: null,
          collocations: [],
        }
      );
    });
    return ordered;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: `请求失败: ${message}` };
  }
}

/** 批量解析：从粘贴文本中抽取单词列表（AI 解析），返回可写入表单的 IVocabularyEntryFormData[] */
export async function aiParseBatchVocabulary(
  rawText: string,
  options?: { baseUrl?: string; accessToken?: string; model?: string },
): Promise<IVocabularyEntryFormData[] | { error: string }> {
  const text = typeof rawText === "string" ? rawText.trim() : "";
  if (!text) return { error: "请输入或粘贴要解析的文本" };

  const baseUrl =
    (typeof options?.baseUrl === "string" && options.baseUrl.trim()
      ? options.baseUrl.trim().replace(/\/$/, "")
      : process.env["OPENAI_API_BASE"]) ?? "https://api.openai.com/v1";
  const accessToken =
    (typeof options?.accessToken === "string" && options.accessToken.trim()
      ? options.accessToken.trim()
      : process.env["OPENAI_API_KEY"]) ?? "";
  const model =
    (typeof options?.model === "string" && options.model.trim()
      ? options.model.trim()
      : process.env["OPENAI_MODEL"]) ?? DEFAULT_AI_MODEL;

  if (!accessToken) {
    return {
      error:
        "请设置 API Key：在设置中配置「词汇」下的 API Key，或配置环境变量 OPENAI_API_KEY",
    };
  }

  const categoryList = VOCABULARY_CATEGORIES.join("、");
  const posList = (PARTS_OF_SPEECH as readonly string[]).join(", ");
  const systemPrompt = `You are a helpful assistant that extracts a list of English vocabulary entries from a pasted text (e.g. a word list with numbers, word, part of speech, and Chinese definitions).
From the user's text, identify each distinct vocabulary item. For each item return: word (the English word or phrase), phonetic (IPA if inferable, else null), mnemonic (short memory tip in Chinese if easy, else null), partOfSpeechMeanings (array of { partOfSpeech, meanings: string[] } — at least one entry; meanings in Chinese), prefixes/suffixes/root (morpheme arrays or null), category (must be exactly one of: ${categoryList}, or null).
partOfSpeech MUST be exactly one of: ${posList}. Do NOT use "n." or "v." alone; use n.[C], n.[U], n.[C/U], vi., vt., adj., adv., etc.
Ignore line numbers and segment numbers in the text. Extract every vocabulary entry. Preserve multi-word terms (e.g. "El Nino", "carbon dioxide"). Return a JSON object with a single key "entries" whose value is an array of these objects.`;

  const userContent = `Extract all vocabulary entries from the following text. Return JSON with key "entries" (array of objects with word, phonetic, mnemonic, partOfSpeechMeanings, prefixes, suffixes, root, category).\n\n${text}`;

  console.log("[词汇 批量解析] 请求:", {
    baseUrl,
    model,
    userContentLength: userContent.length,
    userContentPreview:
      userContent.slice(0, 200) + (userContent.length > 200 ? "…" : ""),
  });

  try {
    const client = new OpenAI({
      apiKey: accessToken,
      baseURL: baseUrl,
    });

    const completion = await client.chat.completions.parse({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      response_format: zodResponseFormat(
        vocabularyBatchParseResultSchema,
        "vocabulary_batch_parse",
      ),
      temperature: 0.3,
    });

    const message = completion.choices?.[0]?.message;
    const raw = (message as { parsed?: unknown })?.parsed;
    const content = (message as { content?: string | null })?.content;

    console.log("[词汇 批量解析] 响应 meta:", {
      id: completion.id,
      model: completion.model,
      usage: completion.usage,
    });
    console.log(
      "[词汇 批量解析] 响应 message.parsed:",
      raw != null
        ? `${JSON.stringify(raw).slice(0, 500)}${JSON.stringify(raw).length > 500 ? "…" : ""}`
        : "(无 parsed)",
    );
    if (typeof content === "string") {
      console.log(
        "[词汇 批量解析] 响应 message.content 长度:",
        content.length,
        "预览:",
        content.slice(0, 300) + (content.length > 300 ? "…" : ""),
      );
    }

    let parsed: VocabularyBatchParseResultInferred;
    if (raw != null) {
      const result = safeParseVocabularyBatchParseResult(
        normalizeBatchParseRaw(raw),
      );
      if (!result.success) {
        return { error: `返回格式校验失败: ${result.error.message}` };
      }
      parsed = result.data;
    } else if (typeof content === "string" && content.trim()) {
      const json = JSON.parse(content) as unknown;
      const result = safeParseVocabularyBatchParseResult(
        normalizeBatchParseRaw(json),
      );
      if (!result.success) {
        return { error: `返回格式校验失败: ${result.error.message}` };
      }
      parsed = result.data;
    } else {
      return { error: "接口返回为空" };
    }

    const categories = await db.vocabularyCategory.findMany({
      orderBy: { id: "asc" },
    });
    const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

    const formDataList = mapBatchParseEntriesToFormData(
      parsed.entries,
      categoryByName,
    );
    return formDataList.filter((d) => d.word.length > 0);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { error: `请求失败: ${message}` };
  }
}
