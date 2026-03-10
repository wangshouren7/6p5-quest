"use client";

import {
    getMasteredWordSet,
    setWordMastered,
    updateUserWordStats,
} from "@/modules/corpus/actions";
import { devError } from "@/utils/logger";
import { normalizeWord } from "@/utils/string";
import { useRequest } from "ahooks";
import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ICorpus, WordItem } from "../core/types";

export interface UseResultPanelStatsOptions {
  words: (WordItem & { id?: number })[];
  userAnswers: string[];
  accuracy: number | null;
  corpus: ICorpus;
  userId: number;
}

export interface UseResultPanelStatsReturn {
  masteredSet: Set<string>;
  handleToggleMastered: (
    wordId: number,
    currentMastered: boolean,
  ) => Promise<void>;
}

export function useResultPanelStats({
  words,
  userAnswers,
  accuracy,
  corpus,
  userId,
}: UseResultPanelStatsOptions): UseResultPanelStatsReturn {
  const submittedTestKeyRef = useRef<string | null>(null);

  const { data: masteredWords = [], run: runMastered } = useRequest(
    () => getMasteredWordSet(userId),
    { refreshDeps: [] },
  );
  const masteredSet = useMemo(() => new Set(masteredWords), [masteredWords]);

  useEffect(() => {
    if (accuracy == null) {
      submittedTestKeyRef.current = null;
      return;
    }
    if (words.length === 0) return;
    const { practiceMode } = corpus.getLastTestMeta();
    if (practiceMode) return;
    const testKey = [
      String(userId),
      accuracy.toFixed(6),
      words
        .map(
          (w, i) =>
            `${w.id ?? `w:${normalizeWord(w.word)}`}:${normalizeWord(userAnswers[i] ?? "")}`,
        )
        .join("|"),
    ].join("::");
    if (submittedTestKeyRef.current === testKey) return;
    submittedTestKeyRef.current = testKey;
    const items = words
      .map((w, i) => ({
        wordId: w.id,
        correct: normalizeWord(w.word) === normalizeWord(userAnswers[i] ?? ""),
        userInput: (userAnswers[i] ?? "").trim() || undefined,
      }))
      .filter((x): x is typeof x & { wordId: number } => x.wordId != null);
    if (items.length === 0) return;
    updateUserWordStats(userId, items).catch((err) => {
      submittedTestKeyRef.current = null;
      devError("updateUserWordStats failed", err);
    });
  }, [accuracy, words, userAnswers, corpus, userId]);

  const handleToggleMastered = useCallback(
    async (wordId: number, currentMastered: boolean) => {
      await setWordMastered(userId, wordId, !currentMastered);
      runMastered();
    },
    [userId, runMastered],
  );

  return {
    masteredSet,
    handleToggleMastered,
  };
}
