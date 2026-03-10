"use client";

import { cn } from "@/modules/ui/jsx";
import { AlertCircle, Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import type { IVocabularyEntryListItem } from "../core";
import { meaningSummary } from "../core";
import { MfpCard } from "./mfp-card";

const AUTO_PLAY_DELAY_MS = 400;

export interface ReciteViewProps {
  items: IVocabularyEntryListItem[];
  index: number;
  revealed: boolean;
  showFirst: "word" | "meaning";
  /** 发音函数，传入时启用自动播放与音量按钮 */
  speak?: (word: string) => void;
  /** 是否静音（不自动播放） */
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
  onPrev: () => void;
  onReveal: () => void;
  onNext: () => void;
  onExit: () => void;
  onShowFirstChange: (v: "word" | "meaning") => void;
  /** 点击「忘了 +1」时调用 */
  onForget?: (entryId: number) => void;
}

export function ReciteView({
  items,
  index,
  revealed,
  showFirst,
  speak,
  muted = false,
  onMutedChange,
  onPrev,
  onReveal,
  onNext,
  onExit,
  onShowFirstChange,
  onForget,
}: ReciteViewProps) {
  const total = items.length;
  const entry = total > 0 ? items[index] : null;

  // 背诵模式下切换单词时自动播放发音（未静音时）
  useEffect(() => {
    if (!entry?.word || !speak || muted) return;
    const t = setTimeout(() => speak(entry.word), AUTO_PLAY_DELAY_MS);
    return () => clearTimeout(t);
  }, [index, entry?.word, speak, muted]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!entry) return;
      if (e.key === "ArrowLeft") {
        onPrev();
        e.preventDefault();
      } else if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        onNext();
        e.preventDefault();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [entry, onPrev, onNext]);

  if (total === 0) {
    return (
      <div className="rounded-lg border border-base-300 bg-base-200 p-6 text-center text-sm text-base-content/70">
        暂无单词，请先搜索或退出背诵。
        <div className="mt-3">
          <button type="button" className="btn btn-sm" onClick={onExit}>
            退出背诵
          </button>
        </div>
      </div>
    );
  }

  if (!entry) return null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-base-300 pb-2">
        <div className="flex items-center gap-3">
          <span className="text-sm text-base-content/70">
            第 {index + 1} / {total}
          </span>
          <div className="join">
            <button
              type="button"
              className={cn(
                "btn btn-sm join-item",
                showFirst === "word" && "btn-active",
              )}
              onClick={() => onShowFirstChange("word")}
              aria-label="先显示单词"
            >
              先显示单词
            </button>
            <button
              type="button"
              className={cn(
                "btn btn-sm join-item",
                showFirst === "meaning" && "btn-active",
              )}
              onClick={() => onShowFirstChange("meaning")}
              aria-label="先显示释义"
            >
              先显示释义
            </button>
          </div>
          {speak != null && onMutedChange != null && (
            <button
              type="button"
              className={cn(
                "btn btn-sm btn-ghost btn-square",
                muted && "btn-ghost opacity-70",
              )}
              onClick={() => onMutedChange(!muted)}
              title={muted ? "开启发音" : "静音"}
              aria-label={muted ? "开启发音" : "静音"}
            >
              {muted ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>
          )}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={onExit}
          aria-label="退出背诵"
        >
          退出背诵
        </button>
      </div>

      <div className="flex min-h-[200px] flex-1 flex-col items-center justify-center rounded-lg border border-base-300 bg-base-200 p-6">
        {revealed ? (
          <div className="w-full max-w-xl">
            <MfpCard
              data={{
                word: entry.word,
                phonetic: entry.phonetic,
                mnemonic: entry.mnemonic,
                meanings: entry.meanings,
                prefixes: entry.prefixes,
                suffixes: entry.suffixes,
                root: entry.root,
                categoryName: entry.categoryName,
                collocations: entry.collocations ?? [],
                forgetCount: entry.forgetCount,
              }}
              className="bg-base-200"
            />
          </div>
        ) : showFirst === "word" ? (
          <div className="text-center">
            <p className="text-2xl font-bold">{entry.word}</p>
            {entry.phonetic && (
              <p className="mt-1 font-mono text-base text-base-content/70">
                {entry.phonetic}
              </p>
            )}
          </div>
        ) : (
          <div className="text-center">
            <p className="text-lg text-base-content/90">
              {meaningSummary(entry)}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className="btn btn-sm"
          disabled={index <= 0}
          onClick={onPrev}
          aria-label="上一个"
        >
          上一个
        </button>
        {!revealed ? (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={onReveal}
            aria-label="揭示"
          >
            揭示
          </button>
        ) : null}
        {onForget && entry && (
          <button
            type="button"
            className="btn btn-sm btn-ghost gap-1"
            onClick={() => onForget(entry.id)}
            title={
              entry.forgetCount != null && entry.forgetCount > 0
                ? `忘了 +1（当前 ${entry.forgetCount}）`
                : "忘了 +1"
            }
            aria-label="忘了 +1"
          >
            <AlertCircle className="size-3.5" />
            <span>忘了 +1</span>
            {entry.forgetCount != null && entry.forgetCount > 0 && (
              <span className="opacity-70">({entry.forgetCount})</span>
            )}
          </button>
        )}
        <button
          type="button"
          className="btn btn-sm"
          onClick={onNext}
          aria-label="下一个"
        >
          下一个
        </button>
      </div>
    </div>
  );
}
