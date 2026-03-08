"use client";

import { cn } from "@/modules/ui/jsx";
import { Search } from "lucide-react";
import { useFirstMountState } from "react-use";
import type { IVocabularyFilter } from "../core";
import { useVocabulary } from "./context";

export function FilterCheckboxes<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
  onReset,
  renderOption,
  maxVisible = 20,
}: {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
  onReset?: () => void;
  renderOption: (value: T) => string;
  /** 最多展示的选项数，0 表示全部；默认 20 */
  maxVisible?: number;
}) {
  const visible = maxVisible <= 0 ? options : options.slice(0, maxVisible);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="label-text w-14 shrink-0">{label}</span>
      <div className="flex flex-wrap gap-1">
        {visible.map((value) => (
          <label key={String(value)} className="label cursor-pointer gap-1">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={selected.includes(value)}
              onChange={() => onToggle(value)}
            />
            <span className="label-text text-xs">{renderOption(value)}</span>
          </label>
        ))}
        {maxVisible > 0 && options.length > maxVisible && (
          <span className="text-xs text-base-content/60">
            等 {options.length} 项
          </span>
        )}
        {onReset && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onReset}
            aria-label={`清空${label}`}
          >
            清空
          </button>
        )}
      </div>
    </div>
  );
}

export function VocabularyFilterBar() {
  const {
    filterOptions: options,
    filter,
    setFilter,
    filterLoading: loading,
    fetchEntries: onFetch,
  } = useVocabulary();
  const isFirst = useFirstMountState();

  const partOfSpeechList = options?.partsOfSpeech ?? [];
  const prefixList = options?.prefixes ?? [];
  const suffixList = options?.suffixes ?? [];
  const rootList = options?.roots ?? [];
  const categoryList = options?.categories ?? [];

  const selectedPos = filter.partOfSpeech ?? [];
  const selectedPrefixIds = filter.prefixIds ?? [];
  const selectedSuffixIds = filter.suffixIds ?? [];
  const selectedRootIds = filter.rootIds ?? [];
  const selectedCategoryIds = filter.categoryIds ?? [];
  const createdAtFrom = filter.createdAtFrom ?? "";
  const createdAtTo = filter.createdAtTo ?? "";

  const toggle = <T,>(key: keyof IVocabularyFilter, value: T, current: T[]) => {
    setFilter((f) => {
      const arr = (f[key] as T[]) ?? [];
      const next = arr.includes(value)
        ? arr.filter((x) => x !== value)
        : [...arr, value];
      return { ...f, [key]: next.length > 0 ? next : undefined };
    });
  };

  return (
    <div
      className={cn(
        "collapse collapse-arrow rounded-lg border border-base-300 bg-base-200",
        isFirst ? "collapse-open" : "",
      )}
    >
      <input type="checkbox" aria-label="展开/收起筛选" />
      <div className="collapse-title min-h-0 py-2 font-medium">单词筛选</div>
      <div className="collapse-content">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 pt-1 pb-2">
          <FilterCheckboxes
            label="词性"
            options={partOfSpeechList}
            selected={selectedPos}
            onToggle={(v) => toggle("partOfSpeech", v, selectedPos)}
            onReset={() =>
              setFilter((f) => ({ ...f, partOfSpeech: undefined }))
            }
            renderOption={(v) => String(v)}
          />
          <FilterCheckboxes
            label="前缀"
            options={prefixList.map((p) => p.id)}
            selected={selectedPrefixIds}
            onToggle={(id) => toggle("prefixIds", id, selectedPrefixIds)}
            onReset={() => setFilter((f) => ({ ...f, prefixIds: undefined }))}
            renderOption={(id) =>
              prefixList.find((p) => p.id === id)?.text ?? String(id)
            }
          />
          <FilterCheckboxes
            label="后缀"
            options={suffixList.map((s) => s.id)}
            selected={selectedSuffixIds}
            onToggle={(id) => toggle("suffixIds", id, selectedSuffixIds)}
            onReset={() => setFilter((f) => ({ ...f, suffixIds: undefined }))}
            renderOption={(id) =>
              suffixList.find((s) => s.id === id)?.text ?? String(id)
            }
          />
          <FilterCheckboxes
            label="词根"
            options={rootList.map((r) => r.id)}
            selected={selectedRootIds}
            onToggle={(id) => toggle("rootIds", id, selectedRootIds)}
            onReset={() => setFilter((f) => ({ ...f, rootIds: undefined }))}
            renderOption={(id) =>
              rootList.find((r) => r.id === id)?.text ?? String(id)
            }
          />
          <FilterCheckboxes
            label="分类"
            options={categoryList.map((c) => c.id)}
            selected={selectedCategoryIds}
            onToggle={(id) => toggle("categoryIds", id, selectedCategoryIds)}
            onReset={() => setFilter((f) => ({ ...f, categoryIds: undefined }))}
            renderOption={(id) =>
              categoryList.find((c) => c.id === id)?.name ?? String(id)
            }
          />
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-text w-14 shrink-0">创建时间</span>
            <input
              type="date"
              className="input input-sm input-bordered w-36"
              value={createdAtFrom}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  createdAtFrom: e.target.value || undefined,
                }))
              }
              aria-label="创建时间从"
            />
            <span className="text-xs text-base-content/60">至</span>
            <input
              type="date"
              className="input input-sm input-bordered w-36"
              value={createdAtTo}
              onChange={(e) =>
                setFilter((f) => ({
                  ...f,
                  createdAtTo: e.target.value || undefined,
                }))
              }
              aria-label="创建时间至"
            />
            {(createdAtFrom || createdAtTo) && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() =>
                  setFilter((f) => ({
                    ...f,
                    createdAtFrom: undefined,
                    createdAtTo: undefined,
                  }))
                }
                aria-label="清空创建时间"
              >
                清空
              </button>
            )}
          </div>
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
        </div>
      </div>
    </div>
  );
}
