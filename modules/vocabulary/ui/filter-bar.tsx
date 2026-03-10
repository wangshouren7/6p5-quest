"use client";

import { FilterBarCollapse, FilterField } from "@/modules/ui/filter-bar-layout";
import { SearchableMultiSelect } from "@/modules/ui/searchable-multi-select";
import { Search } from "lucide-react";
import { useObservable } from "rcrx";
import { useFirstMountState } from "react-use";
import type { IVocabularyFilter } from "../core";
import { useVocabulary } from "./context";
import { MorphemeMultiSelect } from "./morpheme-select";

export function VocabularyFilterBar() {
  const { vocabulary } = useVocabulary();
  const options = useObservable(vocabulary.data.filterOptions$);
  const filter = useObservable(vocabulary.data.filter$);
  const loading = useObservable(vocabulary.data.filterLoading$);
  const setFilter = (
    value: IVocabularyFilter | ((prev: IVocabularyFilter) => IVocabularyFilter),
  ) => vocabulary.data.setFilter(value);
  const onFetch = () => vocabulary.data.fetchEntriesPageOne();
  const isFirst = useFirstMountState();

  const partOfSpeechList = options?.partsOfSpeech ?? [];
  const prefixList = options?.prefixes ?? [];
  const suffixList = options?.suffixes ?? [];
  const rootList = options?.roots ?? [];
  const categoryList = options?.categories ?? [];

  const wordQuery = filter?.word ?? "";
  const selectedPos = filter?.partOfSpeech ?? [];
  const selectedPrefixIds = filter?.prefixIds ?? [];
  const selectedSuffixIds = filter?.suffixIds ?? [];
  const selectedRootIds = filter?.rootIds ?? [];
  const selectedCategoryIds = filter?.categoryIds ?? [];
  const createdAtFrom = filter?.createdAtFrom ?? "";
  const createdAtTo = filter?.createdAtTo ?? "";
  const forgetCountMin = filter?.forgetCountMin;
  const forgetCountMax = filter?.forgetCountMax;

  return (
    <FilterBarCollapse title="单词筛选" defaultOpen={isFirst}>
      <FilterField label="单词">
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="input input-sm input-bordered w-full min-w-0"
            placeholder="输入单词或部分字母，不区分大小写"
            value={wordQuery}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                word: e.target.value || undefined,
              }))
            }
            aria-label="单词搜索"
          />
          {wordQuery && (
            <button
              type="button"
              className="btn btn-ghost btn-xs shrink-0"
              onClick={() => setFilter((f) => ({ ...f, word: undefined }))}
              aria-label="清空单词"
            >
              清空
            </button>
          )}
        </div>
      </FilterField>
      <SearchableMultiSelect
        label="词性"
        options={partOfSpeechList.map((pos) => ({
          value: pos,
          label: pos,
        }))}
        selected={selectedPos}
        onChange={(next) =>
          setFilter((f) => ({
            ...f,
            partOfSpeech: next.length > 0 ? next : undefined,
          }))
        }
        placeholder="搜索词性…"
      />
      <MorphemeMultiSelect
        label="前缀"
        options={prefixList}
        selectedIds={selectedPrefixIds}
        onChange={(next) =>
          setFilter((f) => ({
            ...f,
            prefixIds: next.length > 0 ? next : undefined,
          }))
        }
        placeholder="搜索前缀…"
      />
      <MorphemeMultiSelect
        label="后缀"
        options={suffixList}
        selectedIds={selectedSuffixIds}
        onChange={(next) =>
          setFilter((f) => ({
            ...f,
            suffixIds: next.length > 0 ? next : undefined,
          }))
        }
        placeholder="搜索后缀…"
      />
      <MorphemeMultiSelect
        label="词根"
        options={rootList}
        selectedIds={selectedRootIds}
        onChange={(next) =>
          setFilter((f) => ({
            ...f,
            rootIds: next.length > 0 ? next : undefined,
          }))
        }
        placeholder="搜索词根…"
      />
      <SearchableMultiSelect
        label="分类"
        options={categoryList.map((c) => ({ value: c.id, label: c.name }))}
        selected={selectedCategoryIds}
        onChange={(next) =>
          setFilter((f) => ({
            ...f,
            categoryIds: next.length > 0 ? next : undefined,
          }))
        }
        placeholder="搜索分类…"
      />
      <FilterField label="创建时间">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="input input-sm input-bordered w-full min-w-0 sm:w-36"
            value={createdAtFrom}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                createdAtFrom: e.target.value || undefined,
              }))
            }
            aria-label="创建时间从"
          />
          <span className="text-xs text-base-content/60 shrink-0">至</span>
          <input
            type="date"
            className="input input-sm input-bordered w-full min-w-0 sm:w-36"
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
      </FilterField>
      <FilterField label="遗忘次数">
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            min={0}
            className="input input-sm input-bordered w-20"
            placeholder="至少"
            value={forgetCountMin !== undefined ? String(forgetCountMin) : ""}
            onChange={(e) => {
              const v = e.target.value;
              setFilter((f) => ({
                ...f,
                forgetCountMin: v === "" ? undefined : Math.max(0, parseInt(v, 10) || 0),
              }));
            }}
            aria-label="遗忘次数至少"
          />
          <span className="text-xs text-base-content/60 shrink-0">至</span>
          <input
            type="number"
            min={0}
            className="input input-sm input-bordered w-20"
            placeholder="至多"
            value={forgetCountMax !== undefined ? String(forgetCountMax) : ""}
            onChange={(e) => {
              const v = e.target.value;
              setFilter((f) => ({
                ...f,
                forgetCountMax: v === "" ? undefined : Math.max(0, parseInt(v, 10) || 0),
              }));
            }}
            aria-label="遗忘次数至多"
          />
          {(forgetCountMin !== undefined) || (forgetCountMax !== undefined) ? (
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() =>
                setFilter((f) => ({
                  ...f,
                  forgetCountMin: undefined,
                  forgetCountMax: undefined,
                }))
              }
              aria-label="清空遗忘次数"
            >
              清空
            </button>
          ) : null}
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
