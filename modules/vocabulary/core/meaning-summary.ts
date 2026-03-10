import type { IVocabularyEntryListItem } from "./types";

const MEANING_SUMMARY_MAX_LEN = 120;

/**
 * 从单词条目中取首条词性+释义并截断，供背诵/听单词等展示与朗读用。
 */
export function meaningSummary(entry: IVocabularyEntryListItem): string {
  if (!entry.meanings?.length) return "（无释义）";
  const first = entry.meanings[0];
  const text = `${first.partOfSpeech} ${first.meanings.filter(Boolean).join("；")}`;
  return text.length > MEANING_SUMMARY_MAX_LEN
    ? text.slice(0, MEANING_SUMMARY_MAX_LEN) + "…"
    : text;
}
