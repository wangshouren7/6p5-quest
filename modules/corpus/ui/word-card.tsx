"use client";

import { cn } from "@/modules/ui/jsx";
import { Play } from "lucide-react";
import { playWordAudio } from "../core/audio";

export interface WordCardProps {
  word: string;
  phonetic?: string;
  meaning: string;
  audioUrl?: string;
  rate: number;
  isStripeRow?: boolean;
  isWrong?: boolean;
  userAnswer?: string;
  /** 该词在历史记录中被写错的次数，用于在卡片上展示 */
  errorCount?: number;
  /** 该词在历史中的正确率 0–100，用于在卡片上展示 */
  correctRate?: number;
  /** 该词听写总次数，用于在卡片上展示 */
  totalCount?: number;
  /** 是否已标记为熟练掌握 */
  mastered?: boolean;
  /** 切换熟练掌握时回调；存在时展示「熟练掌握」控制 */
  onToggleMastered?: () => void;
}

function formatPhonetic(phonetic: string): string {
  return phonetic.replace(/^\/|\/$/g, "");
}

export function WordCard({
  word,
  phonetic,
  meaning,
  audioUrl,
  rate,
  isStripeRow = false,
  isWrong = false,
  userAnswer,
  errorCount,
  correctRate,
  totalCount,
  mastered = false,
  onToggleMastered,
}: WordCardProps) {
  const handlePlay = () => {
    if (audioUrl) playWordAudio(audioUrl, rate);
  };

  console.log(
    "totalCount",
    totalCount,
    "correctRate",
    correctRate,
    "errorCount",
    errorCount,
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-0.5 border border-base-300 p-3",
        "text-neutral-800 dark:text-base-content",
        isStripeRow
          ? "bg-orange-50 dark:bg-orange-950/20"
          : "bg-white dark:bg-base-200",
        isWrong &&
          "ring-2 ring-error/50 ring-inset bg-error/5 dark:bg-error/10",
      )}
    >
      <div className="flex items-start justify-between gap-1">
        <span className="text-base font-medium">{word}</span>
        {audioUrl && (
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-square shrink-0"
            onClick={handlePlay}
            aria-label={`朗读 ${word}`}
          >
            <Play className="size-3.5" />
          </button>
        )}
      </div>
      {phonetic != null && phonetic !== "" && (
        <div className="text-sm font-mono opacity-80">
          [{formatPhonetic(phonetic)}]
        </div>
      )}
      <div className="text-xs opacity-75">{meaning}</div>
      {totalCount != null || correctRate != null ? (
        <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0 text-xs text-base-content">
          {totalCount != null && (
            <span>
              对/总：{totalCount - (errorCount ?? 0)}/{totalCount}
            </span>
          )}
          {correctRate != null && <span>正确率 {correctRate.toFixed(0)}%</span>}
        </div>
      ) : null}
      {onToggleMastered != null && (
        <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={mastered}
            onChange={onToggleMastered}
          />
          <span>掌握</span>
        </label>
      )}
      {isWrong && (
        <div className="mt-1 border-t border-error/30 pt-1 text-xs text-error">
          {userAnswer != null
            ? `你写的：${userAnswer || "（未填写）"}`
            : "错题"}
        </div>
      )}
    </div>
  );
}
