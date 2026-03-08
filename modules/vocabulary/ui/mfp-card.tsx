"use client";

import { cn } from "@/modules/ui/jsx";
import { Pencil, Trash2, Volume2 } from "lucide-react";
import type {
  ICollocationItem,
  IMorphemeItem,
  IPartOfSpeechMeaning,
} from "../core";
import { useWordSpeech } from "./use-word-speech";

export interface MfpCardData {
  word: string;
  phonetic: string | null;
  mnemonic: string | null;
  meanings: IPartOfSpeechMeaning[];
  prefixes: IMorphemeItem[];
  suffixes: IMorphemeItem[];
  root: IMorphemeItem | null;
  categoryName: string | null;
  /** 固定搭配（短语 + 意思） */
  collocations?: ICollocationItem[];
}

export interface MfpCardProps {
  data: MfpCardData;
  onClose?: () => void;
  /** 网格视图下可选的编辑/删除回调，传入时在卡片头部显示操作按钮 */
  onEdit?: () => void;
  onDelete?: () => void;
  /** 删除请求进行中时禁用删除按钮 */
  deleteLoading?: boolean;
  /** 为 true 时卡片宽度填满容器（用于网格布局） */
  fillWidth?: boolean;
  /** 分类与释义等提示的透明度 0–1，小于 1 时弱化显示（如全屏「提示透明度」滑块） */
  hintOpacity?: number;
  className?: string;
}

export function MfpCard({
  data,
  onClose,
  onEdit,
  onDelete,
  deleteLoading = false,
  fillWidth = false,
  hintOpacity,
  className,
}: MfpCardProps) {
  const dimHints = hintOpacity !== undefined && hintOpacity < 1;
  const {
    word,
    phonetic,
    mnemonic,
    meanings,
    prefixes,
    suffixes,
    root,
    categoryName,
    collocations = [],
  } = data;

  const hasActions = onClose ?? onEdit ?? onDelete;
  const hasHoverActions = onEdit ?? onDelete;
  const { speak } = useWordSpeech();

  return (
    <div
      className={cn(
        "group rounded-lg border border-base-300 flex flex-col w-full min-w-0",
        fillWidth ? "min-h-full bg-transparent" : "bg-base-200",
        className,
      )}
      onMouseEnter={() => speak(word)}
    >
      <div className="px-2 pt-2 pb-0.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <h3 className="text-base font-bold">{word}</h3>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-square p-0 min-h-0 h-6 w-6 text-base-content/50 hover:text-base-content/80"
              onClick={(e) => {
                e.stopPropagation();
                speak(word);
              }}
              title="朗读（英式发音）"
              aria-label="朗读"
            >
              <Volume2 className="size-3.5" />
            </button>
            {categoryName && (
              <span
                className={cn(
                  "badge badge-ghost badge-xs",
                  dimHints && "select-none transition-opacity duration-200",
                )}
                style={dimHints ? { opacity: hintOpacity } : undefined}
              >
                {categoryName}
              </span>
            )}
          </div>
        </div>
        {hasActions && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-0.5 transition-opacity",
              hasHoverActions && "opacity-0 group-hover:opacity-100",
            )}
          >
            {onEdit && (
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                title="编辑"
                aria-label="编辑"
              >
                <Pencil className="size-3.5" />
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square text-error"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                disabled={deleteLoading}
                title="删除"
                aria-label="删除"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
            {onClose && (
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square"
                onClick={onClose}
                aria-label="关闭"
              >
                ×
              </button>
            )}
          </div>
        )}
      </div>

      <div
        className={cn(
          "px-2 pt-0.5 pb-2 space-y-1.5 text-xs",
          dimHints && "select-none transition-opacity duration-200",
        )}
        style={dimHints ? { opacity: hintOpacity } : undefined}
      >
        <section className="flex gap-1.5 flex-wrap items-baseline text-xs wrap-break-word">
          <span className="font-semibold text-base-content/70 shrink-0">
            F:
          </span>
          <span className="min-w-0 flex-1">
            {prefixes.length > 0 && (
              <>
                <span className="font-medium">前缀</span>{" "}
                {prefixes.map((p, i) => (
                  <span key={i}>
                    {i > 0 && "、"}
                    <span className="font-mono">{p.text}</span>
                    {p.meanings?.length > 0 && (
                      <span>（{p.meanings.join("；")}）</span>
                    )}
                  </span>
                ))}
                {(suffixes.length > 0 || root) && " "}
              </>
            )}
            {suffixes.length > 0 && (
              <>
                <span className="font-medium">后缀</span>{" "}
                {suffixes.map((s, i) => (
                  <span key={i}>
                    {i > 0 && "、"}
                    <span className="font-mono">{s.text}</span>
                    {s.meanings?.length > 0 && (
                      <span>（{s.meanings.join("；")}）</span>
                    )}
                  </span>
                ))}
                {root && " "}
              </>
            )}
            {root && (
              <>
                <span className="font-medium">词根</span>{" "}
                <span className="font-mono">{root.text}</span>
                {root.meanings?.length > 0 && (
                  <span>（{root.meanings.join("；")}）</span>
                )}
              </>
            )}
            {prefixes.length === 0 && suffixes.length === 0 && !root && (
              <span className="text-base-content/50">暂无</span>
            )}
          </span>
        </section>

        <section className="flex gap-1.5 flex-wrap items-baseline text-xs wrap-break-word">
          <span className="font-semibold text-base-content/70 shrink-0">
            P:
          </span>
          <span className="min-w-0 flex-1 text-base-content/80 font-mono break-all">
            {phonetic ?? "暂无"}
          </span>
        </section>

        {mnemonic && (
          <section className="flex gap-1.5 flex-wrap items-baseline wrap-break-word">
            <span className="font-semibold text-base-content/70 shrink-0">
              记法
            </span>
            <span className="text-base-content/90 whitespace-pre-wrap">
              {mnemonic}
            </span>
          </section>
        )}

        {collocations.length > 0 && (
          <section className="flex gap-1.5 flex-wrap items-baseline wrap-break-word">
            <span className="font-semibold text-base-content/70 shrink-0">
              固定搭配
            </span>
            <span className="min-w-0 flex-1 text-base-content/90">
              {collocations
                .map((c) =>
                  c.meaning ? `${c.phrase}（${c.meaning}）` : c.phrase,
                )
                .join("；")}
            </span>
          </section>
        )}

        <section className="flex gap-1.5 flex-wrap items-baseline text-xs wrap-break-word">
          <span className="font-semibold text-base-content/70 shrink-0">
            M:
          </span>
          <span className="min-w-0 flex-1">
            {meanings.map((m, i) => (
              <span key={i}>
                {i > 0 && " "}
                <span className="font-medium text-primary">
                  {m.partOfSpeech}
                </span>
                {m.meanings.filter(Boolean).join("；")}
              </span>
            ))}
          </span>
        </section>
      </div>
    </div>
  );
}
