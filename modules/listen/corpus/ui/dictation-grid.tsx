"use client";

import { useObservable } from "rcrx";
import { useEffect, useRef, useState } from "react";
import { cn } from "../../../ui/jsx";
import { RESULT_GRID_COLS } from "../core/constants";
import { useCorpus } from "./context";
import { WordCard } from "./word-card";

function formatPhonetic(phonetic: string): string {
  return phonetic.replace(/^\/|\/$/g, "");
}

export function DictationGrid() {
  const corpus = useCorpus();
  const words = useObservable(corpus.data.words$) ?? [];
  const userAnswers = useObservable(corpus.data.userAnswers$) ?? [];
  const controls = useObservable(corpus.controls.value$);
  const showResultOnBlur = controls?.showResultOnBlur ?? false;
  const rate = controls?.rate ?? 1;
  const currentPlayingIndex =
    useObservable(corpus.data.currentPlayingIndex$) ?? -1;
  const testPaused = useObservable(corpus.data.testPaused$) ?? false;
  const practiceMode = useObservable(corpus.data.practiceMode$) ?? false;
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(
    () => new Set(),
  );

  // 挂载后聚焦第一个输入框并播放第一个单词（onFocusFirstInput$ 在 startTest 里同步发出时本组件尚未挂载，收不到）
  useEffect(() => {
    const t = setTimeout(() => {
      firstInputRef.current?.focus();
      // 程序化 focus 可能不触发 onFocus，练习模式下显式播放第一个单词
      if (practiceMode) corpus.playWordAtIndex(0);
    }, 0);
    return () => clearTimeout(t);
  }, [practiceMode, corpus]);

  return (
    <>
      <div className="mb-2 flex items-center gap-2">
        {!practiceMode && (
          <>
            {testPaused ? (
              <button
                type="button"
                className="btn"
                onClick={() => corpus.resumeTest()}
              >
                继续
              </button>
            ) : (
              <button
                type="button"
                className="btn"
                onClick={() => corpus.pauseTest()}
              >
                暂停
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => corpus.cancelTest()}
            >
              取消
            </button>
          </>
        )}
        <button type="button" className="btn" onClick={() => corpus.endTest()}>
          结束
        </button>
      </div>
      <div className="grid grid-cols-4 border border-base-300">
        {words.map((item, index) => {
          const rowIndex = Math.floor(index / RESULT_GRID_COLS);
          const isStripeRow = rowIndex % 2 === 0;
          const isPlaying = currentPlayingIndex === index;
          const isRevealed =
            !practiceMode && showResultOnBlur && revealedIndices.has(index);
          const userAnswer = (userAnswers[index] ?? "").trim();
          const isCorrect =
            item.word.trim().toLowerCase() === userAnswer.toLowerCase();

          if (isRevealed) {
            return (
              <WordCard
                key={`${item.word}-${index}`}
                word={item.word}
                phonetic={item.phonetic}
                meaning={item.meaning}
                audioUrl={item.audioUrl}
                rate={rate}
                isStripeRow={isStripeRow}
                isWrong={!isCorrect}
                userAnswer={userAnswer}
              />
            );
          }

          return (
            <div
              key={`${item.word}-${index}`}
              className={cn(
                "relative flex min-h-22 flex-col justify-center border border-base-300 p-3 text-neutral-800 dark:text-base-content",
                isStripeRow
                  ? "bg-orange-50 dark:bg-orange-950/20"
                  : "bg-white dark:bg-base-200",
                isPlaying && "ring-2 ring-primary ring-inset",
                practiceMode ? "items-stretch gap-1" : "items-center",
              )}
            >
              {practiceMode ? (
                <>
                  <span className="text-base font-medium">{item.word}</span>
                  {item.phonetic != null && item.phonetic !== "" && (
                    <span className="text-sm font-mono opacity-80">
                      [{formatPhonetic(item.phonetic)}]
                    </span>
                  )}
                  <span className="text-xs opacity-75">{item.meaning}</span>
                  <div className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                    {item.word.split("").map((char, i) => {
                      const answered = i < userAnswer.length;
                      const correct =
                        answered &&
                        userAnswer[i].toLowerCase() ===
                          item.word[i].toLowerCase();
                      const isLastTyped = i === userAnswer.length - 1;
                      return (
                        <span
                          key={i}
                          className={cn(
                            "inline-flex h-7 min-w-5 items-center justify-center rounded-sm text-base font-medium transition-colors",
                            !answered && "text-base-content/30",
                            answered && correct && "bg-success/20 text-success",
                            answered && !correct && "bg-error/20 text-error",
                            isLastTyped &&
                              correct &&
                              "ring-1 ring-success ring-inset",
                            isLastTyped &&
                              !correct &&
                              "ring-1 ring-error ring-inset",
                          )}
                        >
                          {char}
                        </span>
                      );
                    })}
                  </div>
                  <input
                    ref={index === 0 ? firstInputRef : undefined}
                    type="text"
                    className="absolute inset-0 cursor-text opacity-0"
                    value={userAnswers[index] ?? ""}
                    onChange={(e) => corpus.setAnswer(index, e.target.value)}
                    onFocus={() => corpus.playWordAtIndex(index)}
                    aria-label={`第 ${index + 1} 个单词`}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </>
              ) : (
                <>
                  <input
                    ref={index === 0 ? firstInputRef : undefined}
                    type="text"
                    className={cn(
                      "border-0 text-center border-b bg-transparent py-0.5 text-base outline-none placeholder:opacity-50",
                      "border-base-300 focus:border-primary focus:border-b-2",
                      "text-neutral-800 dark:text-base-content",
                    )}
                    value={userAnswers[index] ?? ""}
                    onChange={(e) => corpus.setAnswer(index, e.target.value)}
                    onFocus={() => corpus.playWordAtIndex(index)}
                    onBlur={() => {
                      if (showResultOnBlur) {
                        setRevealedIndices((prev) => new Set(prev).add(index));
                      }
                    }}
                    placeholder=""
                    aria-label={`第 ${index + 1} 个单词`}
                    spellCheck={false}
                    autoComplete="off"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
