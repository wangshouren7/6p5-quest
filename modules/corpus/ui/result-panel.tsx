"use client";

import { getGridColsClass } from "@/utils/format";
import { normalizeWord } from "@/utils/string";
import { useObservable } from "rcrx";
import { useMemo } from "react";
import { USER_ID } from "../core/constants";
import { computeResult } from "../core/result";
import { useCorpus } from "./context";
import { useResultPanelStats } from "./use-result-panel-stats";
import { WordCard } from "./word-card";

export function ResultPanel() {
  const corpus = useCorpus();
  const words = useObservable(corpus.data.words$) ?? [];
  const userAnswers = useObservable(corpus.data.userAnswers$) ?? [];
  const accuracy = useObservable(corpus.data.accuracy$);
  const controls = useObservable(corpus.controls.value$);
  const rate = controls?.rate ?? 1;
  const gridCols = controls?.gridCols ?? 4;
  const gridColsClass = getGridColsClass(gridCols);

  const { masteredSet, handleToggleMastered } = useResultPanelStats({
    words,
    userAnswers,
    accuracy: accuracy ?? null,
    corpus,
    userId: USER_ID,
  });

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

  const {
    rate: savedRate,
    shuffle: savedShuffle,
    practiceMode,
  } = corpus.getLastTestMeta();

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

      <div className={`grid ${gridColsClass} border border-base-300`}>
        {words.map((w, index) => {
          const { word, phonetic, meaning, audioUrl, id } = w;
          const rowIndex = Math.floor(index / gridCols);
          const isStripeRow = rowIndex % 2 === 0;
          const userAnswer = (userAnswers[index] ?? "").trim();
          const isCorrect = normalizeWord(word) === normalizeWord(userAnswer);
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
