/**
 * 录入/编辑表单的 Zod 校验 schema，供 react-hook-form + @hookform/resolvers 使用。
 * 与 IVocabularyEntryFormData 对齐，提交时再过滤空项。
 */
import { z } from "zod";

const partOfSpeechMeaningSchema = z.object({
  partOfSpeech: z.string(),
  meanings: z.array(z.string()),
});

const collocationItemSchema = z.object({
  phrase: z.string(),
  meaning: z.string(),
});

const morphemeItemSchema = z.object({
  text: z.string(),
  meanings: z.array(z.string()),
});

export const entryFormSchema = z.object({
  word: z.string().min(1, "请输入单词"),
  phonetic: z.string(),
  mnemonic: z.string(),
  meanings: z.array(partOfSpeechMeaningSchema),
  collocations: z.array(collocationItemSchema),
  prefixIds: z.array(z.number()),
  suffixIds: z.array(z.number()),
  rootId: z.number().nullable(),
  categoryId: z.number().nullable(),
  aiFilledPrefixes: z.array(morphemeItemSchema).optional(),
  aiFilledSuffixes: z.array(morphemeItemSchema).optional(),
  aiFilledRoot: morphemeItemSchema.nullable().optional(),
});

export type EntryFormValues = z.infer<typeof entryFormSchema>;
