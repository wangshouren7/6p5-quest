"use client";

import { cn } from "@/modules/ui/jsx";

const GRID_COLS_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface GridColsControlProps {
  /** 当前列数（1–10），显示用户选择；实际渲染列数由调用方按视口计算 */
  value: number;
  onChange: (cols: number) => void;
  /** 标签文案，默认「每行列数」 */
  label?: string;
  className?: string;
}

/** 网格每行列数选择器（1–10），词汇/语料库共用。始终可选 1–10，大屏生效。 */
export function GridColsControl({
  value,
  onChange,
  label = "每行列数",
  className,
}: GridColsControlProps) {
  const n = Math.min(10, Math.max(1, Math.round(value)));

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="label-text">{label}</span>
      <select
        className="select select-bordered select-sm w-20"
        value={n}
        onChange={(e) =>
          onChange(Number(e.target.value) as (typeof GRID_COLS_OPTIONS)[number])
        }
        aria-label="网格每行列数"
      >
        {GRID_COLS_OPTIONS.map((cols) => (
          <option key={cols} value={cols}>
            {cols}
          </option>
        ))}
      </select>
    </div>
  );
}
