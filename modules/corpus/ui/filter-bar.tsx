"use client";

import type { DictationFilter } from "@/modules/corpus/actions";
import { FilterBarCollapse, FilterField } from "@/modules/ui/filter-bar-layout";
import { SearchableMultiSelect } from "@/modules/ui/searchable-multi-select";
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

  const chapterOptions = useMemo(
    () =>
      chapters.map((ch) => ({
        value: ch.id,
        label: `Ch.${ch.id} ${ch.title}`,
      })),
    [chapters],
  );

  const testOptions = useMemo(
    () =>
      Array.from({ length: maxTestInSelectedChapters }, (_, i) => i + 1).map(
        (n) => ({ value: n, label: `Test ${n}` }),
      ),
    [maxTestInSelectedChapters],
  );

  return (
    <FilterBarCollapse title="单词筛选" defaultOpen={isFirst}>
      <SearchableMultiSelect
        label="章节"
        options={chapterOptions}
        selected={chapterIds}
        onChange={(next) =>
          setFilter((f) => ({
            ...f,
            chapterIds: next.length > 0 ? next : undefined,
          }))
        }
        placeholder="搜索章节…"
      />
      <SearchableMultiSelect
        label="Test"
        options={testOptions}
        selected={testIds}
        onChange={(next) =>
          setFilter((f) => ({
            ...f,
            testIds: next.length > 0 ? next : undefined,
          }))
        }
        placeholder="搜索 Test…"
      />
      <FilterField label="掌握状态">
        <select
          className="select select-bordered select-sm w-full min-w-0 sm:w-28"
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
      </FilterField>
      <FilterField label="正确率">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            placeholder="最小 0～1"
            className="input input-bordered input-sm w-full min-w-0 sm:w-28"
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
          <span className="text-base-content/60 shrink-0">～</span>
          <input
            type="number"
            min={0}
            max={1}
            step={0.1}
            placeholder="最大 0～1"
            className="input input-bordered input-sm w-full min-w-0 sm:w-28"
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
      </FilterField>
      <FilterField label="错误次数">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            placeholder="最少"
            className="input input-bordered input-sm w-full min-w-0 sm:w-24"
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
          <span className="text-base-content/60 shrink-0">～</span>
          <input
            type="number"
            min={0}
            placeholder="最多"
            className="input input-bordered input-sm w-full min-w-0 sm:w-24"
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
      </FilterField>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={onFetch}
          disabled={loading}
        >
          <Search size={14} /> 搜索
        </button>
      </div>
    </FilterBarCollapse>
  );
}
