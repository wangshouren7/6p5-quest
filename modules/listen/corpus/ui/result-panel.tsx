"use client";

import {
  getMasteredWordSet,
  setWordMastered,
  updateUserWordStats,
} from "@/modules/listen/actions";
import { useRequest } from "ahooks";
import { useObservable } from "rcrx";
import { useEffect, useMemo, useRef } from "react";
import { RESULT_GRID_COLS, USER_ID } from "../core/constants";
import { computeResult } from "../core/result";
import { useCorpus } from "./context";
import { WordCard } from "./word-card";

function normalizeWord(w: string): string {
  return w.trim().toLowerCase();
}

export function ResultPanel() {
  const corpus = useCorpus();
  const words = useObservable(corpus.data.words$) ?? [];
  const userAnswers = useObservable(corpus.data.userAnswers$) ?? [];
  const accuracy = useObservable(corpus.data.accuracy$);
  const controls = useObservable(corpus.controls.value$);
  const rate = controls?.rate ?? 1;
  const submittedRef = useRef(false);

  const result = useMemo(
    () =>
      words.length > 0
        ? computeResult(words, userAnswers)
        : {
            correctCount: 0,
            wrongIndices: [] as number[],
            wrongWordStrings: [] as string[],
          },
    [words, userAnswers],
  );
  const { correctCount } = result;

  useEffect(() => {
    if (accuracy == null) {
      submittedRef.current = false;
      return;
    }
    if (words.length === 0) return;
    const { practiceMode } = corpus.getLastTestMeta();
    if (practiceMode) return;
    if (submittedRef.current) return;
    submittedRef.current = true;
    const items = words
      .map((w, i) => ({
        wordId: w.id,
        correct:
          w.word.trim().toLowerCase() ===
          (userAnswers[i] ?? "").trim().toLowerCase(),
        userInput: (userAnswers[i] ?? "").trim() || undefined,
      }))
      .filter((x): x is typeof x & { wordId: number } => x.wordId != null);
    updateUserWordStats(USER_ID, items).catch((err) =>
      console.error("updateUserWordStats failed:", err),
    );
  }, [accuracy, words, userAnswers, corpus]);

  const {
    rate: savedRate,
    shuffle: savedShuffle,
    practiceMode,
  } = corpus.getLastTestMeta();

  const { data: masteredWords = [], run: runMastered } = useRequest(
    () => getMasteredWordSet(USER_ID),
    { refreshDeps: [] },
  );
  const masteredSet = useMemo(() => new Set(masteredWords), [masteredWords]);
  const handleToggleMastered = async (
    wordId: number,
    currentMastered: boolean,
  ) => {
    await setWordMastered(USER_ID, wordId, !currentMastered);
    runMastered();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border border-base-300 bg-base-200 p-4">
        <p className="text-lg font-medium">
          正确率：{accuracy != null ? `${accuracy.toFixed(1)}%` : "—"}
        </p>
        <p className="text-sm text-base-content/70">
          {correctCount} / {words.length} 正确
        </p>
        <p className="text-sm text-base-content/60 mt-1">
          语速：{savedRate.toFixed(1)}x · 乱序：{savedShuffle ? "是" : "否"}
          {practiceMode && " · 本次为练习，未计入历史"}
        </p>
      </div>

      <div className="grid grid-cols-4 border border-base-300">
        {words.map((w, index) => {
          const { word, phonetic, meaning, audioUrl, id } = w;
          const rowIndex = Math.floor(index / RESULT_GRID_COLS);
          const isStripeRow = rowIndex % 2 === 0;
          const userAnswer = (userAnswers[index] ?? "").trim();
          const isCorrect =
            word.trim().toLowerCase() === userAnswer.toLowerCase();
          const mastered = masteredSet.has(normalizeWord(word));

          return (
            <WordCard
              key={id != null ? `id-${id}` : `${word}-${index}`}
              word={word}
              phonetic={phonetic}
              meaning={meaning}
              audioUrl={audioUrl}
              rate={rate}
              isStripeRow={isStripeRow}
              isWrong={!isCorrect}
              userAnswer={userAnswer}
              mastered={mastered}
              onToggleMastered={
                id != null
                  ? () => handleToggleMastered(id, mastered)
                  : undefined
              }
            />
          );
        })}
      </div>

      <button
        type="button"
        className="btn btn-primary"
        onClick={() => corpus.resetTest()}
      >
        再测一次
      </button>
    </div>
  );
}
