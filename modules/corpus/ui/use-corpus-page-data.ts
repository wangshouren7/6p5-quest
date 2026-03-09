"use client";

import {
    getMasteredWordSet,
    getUserWordStatsForWords,
    setWordMastered,
} from "@/modules/corpus/actions";
import { normalizeWord } from "@/utils/string";
import { useRequest } from "ahooks";
import { useCallback, useMemo } from "react";
import type { WordItem } from "../core/types";
import type { WordStat } from "./word-grid";

type WordItemWithId = WordItem & { id: number };

export interface UseCorpusPageDataOptions {
  displayList: WordItemWithId[];
  userId: number;
}

export interface UseCorpusPageDataReturn {
  masteredSet: Set<string>;
  wordStats: Map<number, WordStat> | undefined;
  handleToggleMastered: (word: string) => Promise<void>;
  runMastered: () => void;
  runWordStats: () => void;
}

export function useCorpusPageData({
  displayList,
  userId,
}: UseCorpusPageDataOptions): UseCorpusPageDataReturn {
  const wordIds = useMemo(
    () => displayList.map((w) => w.id).filter((id): id is number => id != null),
    [displayList],
  );
  const wordIdsKey = wordIds.join(",");

  const { data: wordStatsArray, run: runWordStats } = useRequest(
    () => getUserWordStatsForWords(userId, wordIds),
    { ready: wordIds.length > 0, refreshDeps: [wordIdsKey] },
  );
  const wordStats = useMemo(() => {
    if (!wordStatsArray?.length) return undefined;
    const m = new Map<number, WordStat>();
    wordStatsArray.forEach((s) =>
      m.set(s.wordId, {
        totalCount: s.totalCount,
        correctCount: s.correctCount,
        mastered: s.mastered,
      }),
    );
    return m;
  }, [wordStatsArray]);

  const { data: masteredWords = [], run: runMastered } = useRequest(
    () => getMasteredWordSet(userId),
    { refreshDeps: [] },
  );
  const masteredSet = useMemo(() => new Set(masteredWords), [masteredWords]);

  const handleToggleMastered = useCallback(
    async (word: string) => {
      const item = displayList.find(
        (w) => normalizeWord(w.word) === normalizeWord(word),
      );
      if (item?.id == null) return;
      const current = masteredSet.has(normalizeWord(word));
      await setWordMastered(userId, item.id, !current);
      runMastered();
      runWordStats();
    },
    [displayList, masteredSet, userId, runMastered, runWordStats],
  );

  return {
    masteredSet,
    wordStats,
    handleToggleMastered,
    runMastered,
    runWordStats,
  };
}
