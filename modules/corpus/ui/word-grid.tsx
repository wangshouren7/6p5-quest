"use client";

import { useObservable } from "rcrx";
import type { WordItem } from "../core";
import { RESULT_GRID_COLS } from "../core/constants";
import { useCorpus } from "./context";
import { WordCard } from "./word-card";

export interface WordStat {
  totalCount: number;
  correctCount: number;
  mastered?: boolean;
}

interface WordGridProps {
  words: (WordItem & { id?: number })[];
  /** 每个单词的听写统计（key 为 CorpusWord.id），用于展示听写次数、错误次数、正确率、掌握状态 */
  wordStats?: Map<number, WordStat>;
  /** 切换单词熟练掌握状态；存在时 WordCard 展示「熟练掌握」控制 */
  onToggleMastered?: (word: string) => void;
}

export function WordGrid({
  words,
  wordStats,
  onToggleMastered,
}: WordGridProps) {
  const corpus = useCorpus();
  const controls = useObservable(corpus.controls.value$);
  const rate = controls?.rate ?? 1;

  return (
    <div className="grid grid-cols-4 border border-base-300">
      {words.map((item, index) => {
        const { word, phonetic, meaning, audioUrl, id: wordId } = item;
        const rowIndex = Math.floor(index / RESULT_GRID_COLS);
        const isStripeRow = rowIndex % 2 === 0;
        const stat =
          wordId != null && wordStats ? wordStats.get(wordId) : undefined;
        const totalCount = stat?.totalCount ?? 0;
        const correctCount = stat?.correctCount ?? 0;
        const errorCount = totalCount - correctCount;
        const correctRate =
          totalCount > 0 ? (correctCount / totalCount) * 100 : undefined;
        const mastered = stat?.mastered ?? false;

        return (
          <WordCard
            key={`${word}-${index}`}
            word={word}
            phonetic={phonetic}
            meaning={meaning}
            audioUrl={audioUrl}
            rate={rate}
            isStripeRow={isStripeRow}
            totalCount={stat != null ? totalCount : undefined}
            errorCount={stat != null ? errorCount : undefined}
            correctRate={
              stat != null && totalCount > 0 ? correctRate : undefined
            }
            mastered={mastered}
            onToggleMastered={
              onToggleMastered ? () => onToggleMastered(word) : undefined
            }
          />
        );
      })}
    </div>
  );
}
