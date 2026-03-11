"use server";

import { db } from "@/modules/db/client";
import type {
  ICollocationItem,
  IMorphemeItem,
  IPartOfSpeechMeaning,
  IVocabularyAiFillResult,
  IVocabularyEntryFormData,
  VocabularyBatchParseResultInferred,
} from "@/modules/vocabulary/core";
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
} from "@/modules/vocabulary/core";
import { getErrorMessage } from "@/utils/error";
import { devError, devLog, devWarn } from "@/utils/logger";
import { normalizeWord } from "@/utils/string";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { DEFAULT_AI_MODEL } from "./constants";
import { createVocabularyEntry, updateVocabularyEntry } from "./crud";
import { hasValidMeanings, parseMeaningsJson } from "./helpers";
import type { IVocabularyAiConfig } from "./types";

const VOCABULARY_AI_FILL_STALE_RUNNING_MS = 5 * 60 * 1000; // 5 分钟

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

/** 执行一批 AI 回填：读 settings、取 PENDING、调 LLM、写库并更新 Task（供定时任务与 API 复用） */
export async function runVocabularyAiFillBatch(): Promise<void> {
  let taskIds: number[] = [];
  let runningsSet = false;

  try {
    const settings = await db.vocabularyAiSettings.findFirst({
      orderBy: { id: "asc" },
    });
    if (!settings) {
      devLog("[词汇 AI 回填] 无 VocabularyAiSettings，跳过本轮");
      return;
    }
    if (!settings.accessToken?.trim()) {
      devLog("[词汇 AI 回填] 未配置 accessToken，跳过本轮");
      return;
    }

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
      devLog("[词汇 AI 回填] 已将", reset.count, "条超时 RUNNING 重置为 PENDING");
    }

    const pending = await db.vocabularyAiFillTask.findMany({
      where: { status: "PENDING" },
      orderBy: { id: "asc" },
      take: VOCABULARY_BATCH_FILL_SIZE,
    });
    if (pending.length === 0) return;

    taskIds = pending.map((t) => t.id);
    await db.vocabularyAiFillTask.updateMany({
      where: { id: { in: taskIds } },
      data: { status: "RUNNING", updatedAt: new Date() },
    });
    runningsSet = true;

    const words = pending.map((t) => t.word);
    const wordLowers = [...new Set(words.map((w) => normalizeWord(w)))];
    const existingEntries = await db.vocabularyEntry.findMany({
      where: { wordLower: { in: wordLowers } },
      select: { id: true, wordLower: true, meanings: true },
    });
    const entryByWordLower = new Map(
      existingEntries.map((e) => [e.wordLower, e]),
    );
    const existingMeaningsByWord: Record<string, IPartOfSpeechMeaning[]> = {};
    for (const w of wordLowers) {
      const entry = entryByWordLower.get(w);
      if (!entry?.meanings) continue;
      const parsed = parseMeaningsJson(entry.meanings);
      if (hasValidMeanings(parsed)) existingMeaningsByWord[w] = parsed;
    }

    const opts = {
      baseUrl: settings.baseUrl || undefined,
      accessToken: settings.accessToken,
      model: settings.model || undefined,
      existingMeaningsByWord,
    };
    devLog("[词汇 AI 回填] 开始填充", words.length, "个单词");
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
      const wordLower = normalizeWord(data.word);
      const existing = entryByWordLower.get(wordLower) ?? null;
      if (existing) {
        const preserveMeanings = hasValidMeanings(
          parseMeaningsJson(existing.meanings),
        );
        const updateResult = await updateVocabularyEntry(existing.id, data, {
          preserveCategoryIfSet: true,
          preserveMeaningsIfSet: preserveMeanings,
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
    const message = getErrorMessage(e, "本批异常");
    devError("[词汇 AI 回填] 本批异常:", message);
    await db.vocabularyAiFillTask
      .updateMany({
        where: { id: { in: taskIds }, status: "RUNNING" },
        data: {
          status: "FAILED",
          error: message,
          updatedAt: new Date(),
        },
      })
      .catch((err) => devError("[词汇 AI 回填] updateMany failed", err));
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

  devLog(
    "[词汇 AI] 请求:",
    JSON.stringify({ baseURL: baseUrl, model }, null, 2),
  );

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

    const message = completion.choices?.[0]?.message;
    const raw = (message as { parsed?: unknown })?.parsed;
    const content = (message as { content?: string | null })?.content;

    if (raw == null) {
      if (typeof content === "string" && content.trim()) {
        const parsed = JSON.parse(content) as unknown;
        const result = safeParseVocabularyAiFillResult(parsed);
        if (result.success) {
          return result.data as IVocabularyAiFillResult;
        }
        devWarn("[词汇 AI] 校验失败:", result.error.message);
        return {
          error: `返回格式校验失败: ${result.error.message}`,
        };
      }
      return { error: "接口返回为空" };
    }

    const result = safeParseVocabularyAiFillResult(raw);
    if (result.success) {
      return result.data as IVocabularyAiFillResult;
    }
    devWarn("[词汇 AI] 校验失败:", result.error.message);
    return {
      error: `返回格式校验失败: ${result.error.message}`,
    };
  } catch (e) {
    return { error: `请求失败: ${getErrorMessage(e, "未知错误")}` };
  }
}

/** 将 API 返回的批量条目中 undefined 规范为 null，以通过严格 schema */
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

/** 将批量解析的 entries 转为 IVocabularyEntryFormData[] */
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

    return trimmed.length > 0 ? trimmed : { error: "未识别到单词" };
  } catch (e) {
    return { error: `请求失败: ${getErrorMessage(e, "未知错误")}` };
  }
}

/** 分批表单回填：对一批单词（建议 ≤ VOCABULARY_BATCH_FILL_SIZE）请求完整词汇数据 */
export async function aiFillVocabularyBatch(
  words: string[],
  options?: {
    baseUrl?: string;
    accessToken?: string;
    model?: string;
    /** 已有释义的单词（key 为 wordLower），回填时以数据库释义为准且不需返回 meanings */
    existingMeaningsByWord?: Record<string, IPartOfSpeechMeaning[]>;
  },
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
  const existingByWord = options?.existingMeaningsByWord ?? {};
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
partOfSpeech MUST be exactly one of: ${posList}. Do NOT use "n." or "v." alone. For words with clear etymology (e.g. atmosphere, hydrosphere), always fill mnemonic and prefixes/suffixes/root when applicable. Morpheme text: no leading/trailing hyphens. All meanings in Chinese.
If a word is marked with "已有释义" (existing meanings) in the user message: use the given meanings as the source of truth, do not rewrite them; and you do NOT need to return partOfSpeechMeanings for that word (the system will keep the existing meanings; only fill phonetic, mnemonic, category, morphemes, etc.).`;

  const userLines = list.map((w) => {
    const key = normalizeWord(w);
    const existing = existingByWord[key];
    if (existing?.length) {
      const meaningStr = existing
        .map(
          (m) =>
            `${m.partOfSpeech} ${(m.meanings ?? []).filter(Boolean).join("；")}`,
        )
        .join(" | ");
      return `${w.trim()}\t已有释义（请以以下为准，不要改写）：${meaningStr}`;
    }
    return w.trim();
  });
  const userContent = `Return vocabulary data for each of these words, in the same order. One entry per line:\n${userLines.join("\n")}`;

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

    const categories = await db.vocabularyCategory.findMany({
      orderBy: { id: "asc" },
    });
    const categoryByName = new Map(categories.map((c) => [c.name, c.id]));

    const formDataList = mapBatchParseEntriesToFormData(
      parsed.entries,
      categoryByName,
    );
    const byWord = new Map(formDataList.map((d) => [normalizeWord(d.word), d]));
    const ordered = list.map((w) => {
      const key = normalizeWord(w);
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
    return { error: `请求失败: ${getErrorMessage(e, "未知错误")}` };
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
From the user's text, identify each distinct vocabulary item. Auto-detect: if the source text contains part of speech and Chinese definitions for a word, extract them into partOfSpeechMeanings (array of { partOfSpeech, meanings: string[] }, at least one entry; meanings in Chinese). If the source only lists words without definitions, do NOT invent meanings — use a minimal placeholder for partOfSpeechMeanings (e.g. one entry with empty or placeholder meanings).
For each item return: word (the English word or phrase), phonetic (IPA if inferable, else null), mnemonic (short memory tip in Chinese if easy, else null), partOfSpeechMeanings (as above), prefixes/suffixes/root (morpheme arrays or null), category (must be exactly one of: ${categoryList}, or null).
partOfSpeech MUST be exactly one of: ${posList}. Do NOT use "n." or "v." alone; use n.[C], n.[U], n.[C/U], vi., vt., adj., adv., etc.
Ignore line numbers and segment numbers in the text. Extract every vocabulary entry. Preserve multi-word terms (e.g. "El Nino", "carbon dioxide"). Return a JSON object with a single key "entries" whose value is an array of these objects.`;

  const userContent = `Extract all vocabulary entries from the following text. Return JSON with key "entries" (array of objects with word, phonetic, mnemonic, partOfSpeechMeanings, prefixes, suffixes, root, category).\n\n${text}`;

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
    return { error: `请求失败: ${getErrorMessage(e, "未知错误")}` };
  }
}
