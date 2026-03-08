"use client";

import {
    getWordsForDictation,
    type DictationFilter,
} from "@/modules/corpus/actions";
import { useControls } from "leva";
import React, { startTransition, useCallback, useState } from "react";
import type { ChapterItem } from "../core";
import { Corpus as CorpusClass, fetchChapters } from "../core";
import { DEFAULT_CORPUS_CONTROLS, USER_ID } from "../core/constants";
import { CorpusContext } from "./context";
import { FilterBar } from "./filter-bar";
import { GridColsControl } from "./grid-cols-control";
import { MainContent } from "./main-content";

export function Corpus() {
  const [chapters, setChapters] = React.useState<ChapterItem[] | null>(null);
  const [error, setError] = React.useState<Error | null>(null);
  const [filter, setFilter] = useState<DictationFilter>({});
  const [filteredWords, setFilteredWords] = useState<Awaited<
    ReturnType<typeof getWordsForDictation>
  > | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);

  React.useEffect(() => {
    const tid = setTimeout(() => {
      fetchChapters()
        .then((data) => startTransition(() => setChapters(data)))
        .catch((e) =>
          startTransition(() =>
            setError(e instanceof Error ? e : new Error(String(e))),
          ),
        );
    }, 0);
    return () => clearTimeout(tid);
  }, []);

  const corpus = React.useMemo(
    () => (chapters ? new CorpusClass({ chapters }) : null),
    [chapters],
  );
  const [controls] = useControls(
    "语料库",
    () => ({
      rate: {
        value: DEFAULT_CORPUS_CONTROLS.rate,
        min: 0.5,
        max: 2,
        step: 0.1,
        label: "语速",
      },
      shuffle: {
        value: DEFAULT_CORPUS_CONTROLS.shuffle,
        label: "乱序",
      },
      showResultOnBlur: {
        value: DEFAULT_CORPUS_CONTROLS.showResultOnBlur,
        label: "失焦显示结果",
      },
      dictationIntervalMs: {
        value: DEFAULT_CORPUS_CONTROLS.dictationIntervalMs,
        min: 500,
        max: 15000,
        step: 500,
        label: "听写间隔(ms)",
      },
      gridCols: {
        value: DEFAULT_CORPUS_CONTROLS.gridCols,
        min: 2,
        max: 8,
        step: 1,
        label: "网格每行列数",
      },
    }),
    [],
  );
  const { rate, shuffle, showResultOnBlur, dictationIntervalMs, gridCols } =
    controls;
  React.useEffect(() => {
    if (corpus)
      corpus.controls.change({
        rate,
        shuffle,
        showResultOnBlur,
        dictationIntervalMs,
        gridCols,
      });
  }, [corpus, rate, shuffle, showResultOnBlur, dictationIntervalMs, gridCols]);

  const [fetchId, setFetchId] = useState(0);
  const handleFetchWords = useCallback(async () => {
    setFilterLoading(true);
    try {
      const list = await getWordsForDictation(USER_ID, filter);
      setFilteredWords(list);
      setFetchId((i) => i + 1);
    } finally {
      setFilterLoading(false);
    }
  }, [filter]);

  if (error) {
    return <div className="p-4 text-error">加载失败：{error.message}</div>;
  }
  if (!chapters || !corpus) {
    return <div className="p-4 text-base-content/70">加载中…</div>;
  }

  return (
    <CorpusContext.Provider value={corpus}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <FilterBar
            chapters={chapters}
            filter={filter}
            setFilter={setFilter}
            loading={filterLoading}
            onFetch={handleFetchWords}
          />
          <GridColsControl />
        </div>
        <main className="min-w-0 flex-1 overflow-auto">
          <MainContent
            key={fetchId}
            filteredWords={filteredWords}
            setFilteredWords={setFilteredWords}
          />
        </main>
      </div>
    </CorpusContext.Provider>
  );
}
