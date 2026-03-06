import { getChapters, getWords } from "@/modules/listen/actions";
import type { ChapterItem, WordItem } from "./types";

/** 从 DB 加载章节列表（服务端） */
export const fetchChapters = (): Promise<ChapterItem[]> => getChapters();

/** 从 DB 加载某章节某测验的单词（服务端），返回带 id 的 WordItem */
export async function fetchWords(
  chapterId: number,
  testId: number,
): Promise<(WordItem & { id: number })[]> {
  return getWords(chapterId, testId);
}
