/**
 * AI 补全返回结构的 Zod 与 JSON Schema 定义
 * - 用于 OpenAI structured output（response_format + zodResponseFormat）
 * - 校验并解析 API 返回，保证类型安全
 */
import { z } from "zod";

/** 词性 + 释义（单条） */
const partOfSpeechMeaningSchema = z.object({
  partOfSpeech: z
    .string()
    .describe(
      "词性，仅允许：n.[C]、n.[U]、n.[C/U]、vi.、vt.、adj.、adv. 等，禁止单独使用 n. 或 v.",
    ),
  meanings: z.array(z.string()).describe("中文释义列表"),
});

/** 语素（前缀/后缀/词根）：text + 释义数组 */
const morphemeItemSchema = z.object({
  text: z.string().describe("语素文本，如 un, ly, port"),
  meanings: z.array(z.string()).describe("中文释义列表"),
});

/** 固定搭配：短语 + 中文意思 */
const collocationItemSchema = z.object({
  phrase: z.string().describe("搭配短语，如 pay attention、take place"),
  meaning: z.string().describe("中文意思，如 注意、发生"),
});

/**
 * AI 补全接口返回的完整结构。
 * OpenAI structured output 要求所有字段必填，不可用 .optional()，故用 .nullable() 表示“可为空”。
 */
export const vocabularyAiFillResultSchema = z.object({
  phonetic: z.string().nullable().describe("音标，如 IPA；未知则 null"),
  mnemonic: z
    .string()
    .nullable()
    .describe(
      "记法：用中文写一句如何记忆该词，遵循 MFP（义-形-音），优先结合词根、前缀、后缀拆解记忆，如「hydro 水 + sphere 球 → 水球、地球上的水圈」；无合适记法则 null",
    ),
  partOfSpeechMeanings: z
    .array(partOfSpeechMeaningSchema)
    .nullable()
    .describe("词性及对应释义；未知则 null"),
  prefixes: z
    .array(morphemeItemSchema)
    .nullable()
    .describe("最核心最原子级的前缀列表；未知则 null"),
  suffixes: z
    .array(morphemeItemSchema)
    .nullable()
    .describe("最核心最原子级的后缀列表；未知则 null"),
  root: morphemeItemSchema
    .nullable()
    .describe("最核心最原子级的词根；无则 null"),
  category: z
    .string()
    .nullable()
    .describe(
      "分类，须为预置 22 个之一：自然地理、植物研究、动物保护、太空探索、学校教育、科技发明、文化历史、语言演化、娱乐运动、物品材料、时尚潮流、饮食健康、建筑场所、交通旅行、国家政府、社会经济、法律法规、沙场争锋、社会角色、行为动作、身心健康、时间日期；未知则 null",
    ),
  collocations: z
    .array(collocationItemSchema)
    .nullable()
    .describe(
      "固定搭配：数组，每项 { phrase: 英文短语, meaning: 中文意思 }，如 [{ phrase: 'pay attention', meaning: '注意' }]；无则 null 或空数组",
    ),
});

export type VocabularyAiFillResultInferred = z.infer<
  typeof vocabularyAiFillResultSchema
>;

/** 校验并解析未知数据为 AI 补全结果（用于手动 JSON 解析后的二次校验） */
export function parseVocabularyAiFillResult(
  raw: unknown,
): VocabularyAiFillResultInferred {
  return vocabularyAiFillResultSchema.parse(raw);
}

/** 安全解析：校验失败时返回 null 并将错误交给调用方 */
export function safeParseVocabularyAiFillResult(
  raw: unknown,
):
  | { success: true; data: VocabularyAiFillResultInferred }
  | { success: false; error: z.ZodError } {
  const result = vocabularyAiFillResultSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// --- 仅提取单词（第一步：轻量响应）---

/** 仅提取单词列表，无释义等大 JSON */
export const vocabularyWordsOnlySchema = z.object({
  words: z
    .array(z.string())
    .describe("从文本中识别出的英文单词或词组列表，仅单词，无其他字段"),
});

export type VocabularyWordsOnlyInferred = z.infer<
  typeof vocabularyWordsOnlySchema
>;

export function safeParseVocabularyWordsOnly(
  raw: unknown,
):
  | { success: true; data: VocabularyWordsOnlyInferred }
  | { success: false; error: z.ZodError } {
  const result = vocabularyWordsOnlySchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}

// --- 批量解析（从粘贴文本抽取单词列表）---

/**
 * 单条批量解析结果：与 vocabularyAiFillResultSchema 结构一致，仅多 word 字段。
 * 与「添加单词」单条 AI 补全使用同一套字段定义，便于 prompt 与表单一致。
 */
const vocabularyBatchParseItemSchema = z.object({
  word: z.string().describe("英文单词或词组，如 atmosphere, El Nino"),
  phonetic: z.string().nullable().describe("音标，如 IPA；未知则 null"),
  mnemonic: z
    .string()
    .nullable()
    .describe(
      "记法：用中文写一句如何记忆该词，遵循 MFP（义-形-音），优先结合词根、前缀、后缀拆解记忆，如「hydro 水 + sphere 球 → 水球、地球上的水圈」；无合适记法则 null",
    ),
  partOfSpeechMeanings: z
    .array(partOfSpeechMeaningSchema)
    .nullable()
    .describe("词性及对应释义；未知则 null"),
  prefixes: z
    .array(morphemeItemSchema)
    .nullable()
    .describe("最核心最原子级的前缀列表；未知则 null"),
  suffixes: z
    .array(morphemeItemSchema)
    .nullable()
    .describe("最核心最原子级的后缀列表；未知则 null"),
  root: morphemeItemSchema
    .nullable()
    .describe("最核心最原子级的词根；无则 null"),
  category: z
    .string()
    .nullable()
    .describe(
      "分类，须为预置 22 个之一：自然地理、植物研究、动物保护、太空探索、学校教育、科技发明、文化历史、语言演化、娱乐运动、物品材料、时尚潮流、饮食健康、建筑场所、交通旅行、国家政府、社会经济、法律法规、沙场争锋、社会角色、行为动作、身心健康、时间日期；未知则 null",
    ),
  collocations: z
    .array(collocationItemSchema)
    .nullable()
    .describe(
      "固定搭配：数组，每项 { phrase: 英文短语, meaning: 中文意思 }；无则 null 或空数组",
    ),
});

/** 批量解析接口返回：单词列表 */
export const vocabularyBatchParseResultSchema = z.object({
  entries: z
    .array(vocabularyBatchParseItemSchema)
    .describe("从文本中识别出的单词列表，每项含 word、词性、释义等"),
});

export type VocabularyBatchParseResultInferred = z.infer<
  typeof vocabularyBatchParseResultSchema
>;

export function safeParseVocabularyBatchParseResult(
  raw: unknown,
):
  | { success: true; data: VocabularyBatchParseResultInferred }
  | { success: false; error: z.ZodError } {
  const result = vocabularyBatchParseResultSchema.safeParse(raw);
  if (result.success) return { success: true, data: result.data };
  return { success: false, error: result.error };
}
