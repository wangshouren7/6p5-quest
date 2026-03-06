"use client";

import type { DictationFilter } from "@/modules/corpus/actions";
import { cn } from "@/modules/ui/jsx";
import { Search } from "lucide-react";
import React, { useMemo } from "react";
import { useFirstMountState } from "react-use";
import type { ChapterItem } from "../core";

interface FilterBarProps {
  chapters: readonly ChapterItem[];
  filter: DictationFilter;
  setFilter: React.Dispatch<React.SetStateAction<DictationFilter>>;
  loading: boolean;
  onFetch: () => void;
}

/** 多选筛选项：daisyUI Filter 多选写法（checkbox + btn + reset），见 https://daisyui.com/components/filter/ */
function FilterCheckboxes<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
  onReset,
  disabled,
  renderOption,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
  onReset?: () => void;
  disabled?: boolean;
  renderOption: (value: T) => string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label-text w-16 shrink-0">{label}</span>
      <form
        className="flex flex-wrap gap-1"
        onSubmit={(e) => e.preventDefault()}
        onReset={(e) => {
          e.preventDefault();
          onReset?.();
        }}
      >
        {options.map((value) => (
          <input
            key={value}
            type="checkbox"
            className="btn btn-sm"
            name={label}
            aria-label={renderOption(value)}
            checked={selected.includes(value)}
            disabled={disabled}
            onChange={() => onToggle(value)}
          />
        ))}
        <input
          type="reset"
          className="btn btn-sm btn-square"
          value="×"
          aria-label={`清空${label}`}
        />
      </form>
    </div>
  );
}

const MASTERED_OPTIONS = [
  { value: "all" as const, label: "全部" },
  { value: "unmastered" as const, label: "仅未掌握" },
  { value: "mastered" as const, label: "仅已掌握" },
];

function masteredToSelectValue(m: boolean | undefined): string {
  if (m === true) return "mastered";
  if (m === false) return "unmastered";
  return "all";
}

function selectValueToMastered(v: string): boolean | undefined {
  if (v === "mastered") return true;
  if (v === "unmastered") return false;
  return undefined;
}

export function FilterBar({
  chapters,
  filter,
  setFilter,
  loading,
  onFetch,
}: FilterBarProps) {
  const isFirst = useFirstMountState();
  const chapterIds = useMemo(
    () => filter.chapterIds ?? [],
    [filter.chapterIds],
  );
  const testIds = useMemo(() => filter.testIds ?? [], [filter.testIds]);

  const maxTestInSelectedChapters = useMemo(() => {
    if (chapterIds.length === 0)
      return Math.max(0, ...chapters.map((c) => c.testCount));
    return Math.max(
      0,
      ...chapterIds.map(
        (id) => chapters.find((c) => c.id === id)?.testCount ?? 0,
      ),
    );
  }, [chapters, chapterIds]);

  const testOptions = useMemo(
    () => Array.from({ length: maxTestInSelectedChapters }, (_, i) => i + 1),
    [maxTestInSelectedChapters],
  );

  const toggleChapter = (id: number) => {
    setFilter((f) => {
      const prev = f.chapterIds ?? [];
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      return { ...f, chapterIds: next.length > 0 ? next : undefined };
    });
  };

  const toggleTest = (testId: number) => {
    setFilter((f) => {
      const prev = f.testIds ?? [];
      const next = prev.includes(testId)
        ? prev.filter((x) => x !== testId)
        : [...prev, testId];
      return { ...f, testIds: next.length > 0 ? next : undefined };
    });
  };

  return (
    <div
      className={cn(
        "collapse  collapse-arrow rounded-lg border border-base-300 bg-base-200",
        isFirst ? "collapse-open" : "",
      )}
    >
      <input type="checkbox" aria-label="展开/收起筛选" />
      <div className="collapse-title min-h-0 py-2 font-medium">单词筛选</div>
      <div className="collapse-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-1 pb-2">
          <FilterCheckboxes
            label="章节"
            options={chapters.map((ch) => ch.id)}
            selected={chapterIds}
            onToggle={toggleChapter}
            onReset={() => setFilter((f) => ({ ...f, chapterIds: undefined }))}
            renderOption={(id) => {
              const ch = chapters.find((c) => c.id === id);
              return ch ? `Ch.${ch.id} ${ch.title}` : String(id);
            }}
          />
          <FilterCheckboxes
            label="Test"
            options={testOptions}
            selected={testIds}
            onToggle={toggleTest}
            onReset={() => setFilter((f) => ({ ...f, testIds: undefined }))}
            disabled={chapters.length === 0}
            renderOption={(n) => `Test ${n}`}
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-text w-16 shrink-0">掌握状态</span>
            <select
              className="select select-bordered select-sm w-28"
              value={masteredToSelectValue(filter.mastered)}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  mastered: selectValueToMastered(e.target.value),
                }))
              }
            >
              {MASTERED_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-text w-16 shrink-0">正确率</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              placeholder="最小 0～1"
              className="input input-bordered input-sm w-28"
              value={filter.correctRateMin ?? ""}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  correctRateMin: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
            <span className="text-base-content/60">～</span>
            <input
              type="number"
              min={0}
              max={1}
              step={0.1}
              placeholder="最大 0～1"
              className="input input-bordered input-sm w-28"
              value={filter.correctRateMax ?? ""}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  correctRateMax: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-text w-16 shrink-0">错误次数</span>
            <input
              type="number"
              min={0}
              placeholder="最少"
              className="input input-bordered input-sm w-24"
              value={filter.wrongCountMin ?? ""}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  wrongCountMin: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
            <span className="text-base-content/60">～</span>
            <input
              type="number"
              min={0}
              placeholder="最多"
              className="input input-bordered input-sm w-24"
              value={filter.wrongCountMax ?? ""}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  wrongCountMax: e.target.value
                    ? Number(e.target.value)
                    : undefined,
                }))
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-text w-16 shrink-0" />
            <button type="button" className="btn btn-primary" onClick={onFetch}>
              <Search size={16} /> 搜索
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
