"use server";

import { db } from "@/modules/db/client";
import type { ChapterItem, WordItem } from "@/modules/listen/corpus/core/types";

/** 从 DB 获取章节列表（用于侧栏与选择） */
export async function getChapters(): Promise<ChapterItem[]> {
  const chapters = await db.corpusChapter.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { _count: { select: { tests: true } } },
  });
  return chapters.map((ch) => ({
    id: ch.id,
    title: ch.title,
    testCount: ch._count.tests,
  }));
}

/** 从 DB 获取某章节某测验的单词列表（含 id、audioUrl） */
export async function getWords(
  chapterId: number,
  testId: number,
): Promise<(WordItem & { id: number })[]> {
  const test = await db.corpusTest.findFirst({
    where: { chapterId, testIndex: testId },
    include: {
      words: { orderBy: { index: "asc" } },
    },
  });
  if (!test) return [];
  return test.words.map((w) => ({
    id: w.id,
    word: w.word,
    phonetic: w.phonetic ?? undefined,
    meaning: w.meaning,
    audioUrl: w.audioPath.startsWith("/") ? w.audioPath : `/${w.audioPath}`,
  }));
}

/** 获取指定 wordId 列表在当前用户下的听写统计 */
export async function getUserWordStatsForWords(
  userId: number,
  wordIds: number[],
): Promise<
  Array<{
    wordId: number;
    word: string;
    totalCount: number;
    correctCount: number;
    mastered?: boolean;
  }>
> {
  if (wordIds.length === 0) return [];
  const rows = await db.userCorpusWordStat.findMany({
    where: { userId, wordId: { in: wordIds } },
    include: { word: { select: { word: true } } },
  });
  return rows.map((r) => ({
    wordId: r.wordId,
    word: r.word.word,
    totalCount: r.totalCount,
    correctCount: r.correctCount,
    mastered: r.mastered,
  }));
}

function parseHistoryInputs(raw: string | null): string[] {
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

/** 提交一次听写/练习结果，更新每词统计并追加 historyInputs */
export async function updateUserWordStats(
  userId: number,
  items: { wordId: number; correct: boolean; userInput?: string }[],
) {
  for (const { wordId, correct, userInput } of items) {
    const existing = await db.userCorpusWordStat.findUnique({
      where: { userId_wordId: { userId, wordId } },
    });
    const prevHistory = parseHistoryInputs(existing?.historyInputs ?? null);
    const nextHistory =
      userInput != null ? [...prevHistory, userInput] : prevHistory;

    await db.userCorpusWordStat.upsert({
      where: { userId_wordId: { userId, wordId } },
      create: {
        userId,
        wordId,
        totalCount: 1,
        correctCount: correct ? 1 : 0,
        historyInputs: userInput != null ? JSON.stringify([userInput]) : null,
      },
      update: {
        totalCount: { increment: 1 },
        correctCount: { increment: correct ? 1 : 0 },
        historyInputs:
          nextHistory.length > 0 ? JSON.stringify(nextHistory) : undefined,
      },
    });
  }
}

/** 设置单词的「熟练掌握」状态 */
export async function setWordMastered(
  userId: number,
  wordId: number,
  mastered: boolean,
) {
  await db.userCorpusWordStat.upsert({
    where: { userId_wordId: { userId, wordId } },
    create: { userId, wordId, totalCount: 0, correctCount: 0, mastered },
    update: { mastered },
  });
}

/** 返回当前用户已标记为熟练掌握的单词列表（归一化），用于前端过滤 */
export async function getMasteredWordSet(userId: number): Promise<string[]> {
  const rows = await db.userCorpusWordStat.findMany({
    where: { userId, mastered: true },
    select: { word: { select: { word: true } } },
  });
  return rows.map((r) => r.word.word.trim().toLowerCase());
}

export interface DictationFilter {
  correctRateMin?: number;
  correctRateMax?: number;
  wrongCountMin?: number;
  wrongCountMax?: number;
  chapterIds?: number[];
  testIds?: number[];
  mastered?: boolean;
}

/** 从 DB 枚举所有语料单词（含 chapterId、testId、id），供筛选用 */
async function enumerateCorpusWordsFromDb(): Promise<
  Array<
    WordItem & {
      id: number;
      chapterId: number;
      testId: number;
    }
  >
> {
  const words = await db.corpusWord.findMany({
    orderBy: [
      { test: { chapterId: "asc" } },
      { test: { testIndex: "asc" } },
      { index: "asc" },
    ],
    include: { test: { select: { chapterId: true, testIndex: true } } },
  });
  return words.map((w) => ({
    id: w.id,
    chapterId: w.test.chapterId,
    testId: w.test.testIndex,
    word: w.word,
    phonetic: w.phonetic ?? undefined,
    meaning: w.meaning,
    audioUrl: w.audioPath.startsWith("/") ? w.audioPath : `/${w.audioPath}`,
  }));
}

/** 按条件筛选单词，返回带 id、audioUrl 的 WordItem[]，可跨 test */
export async function getWordsForDictation(
  userId: number,
  filter: DictationFilter,
): Promise<(WordItem & { id: number })[]> {
  const all = await enumerateCorpusWordsFromDb();
  const stats = await db.userCorpusWordStat.findMany({
    where: { userId },
  });
  const statByWordId = new Map(stats.map((s) => [s.wordId, s]));

  const filtered = all.filter((item) => {
    const s = statByWordId.get(item.id);
    const total = s?.totalCount ?? 0;
    const correct = s?.correctCount ?? 0;
    const correctRate = total > 0 ? correct / total : 0;
    const wrongCount = total - correct;

    if (
      filter.chapterIds?.length &&
      !filter.chapterIds.includes(item.chapterId)
    )
      return false;
    if (filter.testIds?.length && !filter.testIds.includes(item.testId))
      return false;
    if (filter.correctRateMin != null && correctRate < filter.correctRateMin)
      return false;
    if (filter.correctRateMax != null && correctRate > filter.correctRateMax)
      return false;
    if (filter.wrongCountMin != null && wrongCount < filter.wrongCountMin)
      return false;
    if (filter.wrongCountMax != null && wrongCount > filter.wrongCountMax)
      return false;
    if (filter.mastered != null) {
      const mastered = s?.mastered ?? false;
      if (mastered !== filter.mastered) return false;
    }
    return true;
  });

  return filtered.map(({ id, word, phonetic, meaning, audioUrl }) => ({
    id,
    word,
    phonetic,
    meaning,
    audioUrl,
  }));
}
