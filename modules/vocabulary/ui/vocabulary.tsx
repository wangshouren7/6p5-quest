"use client";

import { useControls } from "leva";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getVocabularyEntries,
  getVocabularyFilterOptions,
  upsertVocabularyAiSettings,
} from "../actions";
import type { IVocabularyEntryListItem, IVocabularyFilter } from "../core";
import { getStoredVocabularyAiConfig, saveVocabularyAiConfig } from "../core";
import { VocabularyContext } from "./context";
import { VocabularyFilterBar } from "./filter-bar";
import { VocabularyWordList } from "./word-list";

/** 仅在客户端挂载后渲染，避免 useControls + localStorage 导致 SSR 与客户端不一致引发 hydration 报错 */
export function Vocabulary() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);
  if (!mounted) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base-content/70">加载中…</p>
      </div>
    );
  }
  return <VocabularyContent />;
}

function VocabularyContent() {
  const [aiConfig] = useControls(
    "词汇",
    () => {
      const stored = getStoredVocabularyAiConfig();
      return {
        baseUrl: { value: stored.baseUrl, label: "Base URL" },
        accessToken: { value: stored.accessToken, label: "API Key" },
        model: { value: stored.model, label: "Model" },
      };
    },
    [],
  );

  useEffect(() => {
    saveVocabularyAiConfig({
      baseUrl: aiConfig.baseUrl,
      accessToken: aiConfig.accessToken,
      model: aiConfig.model,
    });
    upsertVocabularyAiSettings({
      baseUrl: aiConfig.baseUrl,
      accessToken: aiConfig.accessToken,
      model: aiConfig.model,
    }).catch(() => {});
  }, [aiConfig.baseUrl, aiConfig.accessToken, aiConfig.model]);

  const [filterOptions, setFilterOptions] = useState<Awaited<
    ReturnType<typeof getVocabularyFilterOptions>
  > | null>(null);
  const [filter, setFilter] = useState<IVocabularyFilter>({});
  const [result, setResult] = useState<{
    items: IVocabularyEntryListItem[];
    total: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(200);
  const [filterLoading, setFilterLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    const opts = await getVocabularyFilterOptions();
    setFilterOptions(opts);
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const fetchEntries = useCallback(async () => {
    setFilterLoading(true);
    try {
      const { items, total } = await getVocabularyEntries(filter, {
        page: 1,
        pageSize,
      });
      setResult({ items, total });
      setPage(1);
    } finally {
      setFilterLoading(false);
    }
  }, [filter, pageSize]);

  const handlePageChange = useCallback(
    async (newPage: number) => {
      setFilterLoading(true);
      try {
        const { items, total } = await getVocabularyEntries(filter, {
          page: newPage,
          pageSize,
        });
        setResult({ items, total });
        setPage(newPage);
      } finally {
        setFilterLoading(false);
      }
    },
    [filter, pageSize],
  );

  const handlePageSizeChange = useCallback(
    (newSize: number) => {
      setPageSize(newSize);
      setFilterLoading(true);
      getVocabularyEntries(filter, { page: 1, pageSize: newSize })
        .then(({ items, total }) => {
          setResult({ items, total });
          setPage(1);
        })
        .finally(() => setFilterLoading(false));
    },
    [filter],
  );

  const handleFormSuccess = useCallback(() => {
    setFormError(null);
    loadOptions();
  }, [loadOptions]);

  const handleRefresh = useCallback(async () => {
    setFilterLoading(true);
    try {
      const { items, total } = await getVocabularyEntries(filter, {
        page,
        pageSize,
      });
      setResult({ items, total });
    } finally {
      setFilterLoading(false);
    }
  }, [filter, page, pageSize]);

  const contextValue = useMemo(
    () => ({
      filter,
      setFilter,
      filterOptions,
      result,
      page,
      pageSize,
      formError,
      setFormError,
      filterLoading,
      aiConfig: {
        baseUrl: aiConfig.baseUrl,
        accessToken: aiConfig.accessToken,
        model: aiConfig.model,
      },
      loadFilterOptions: loadOptions,
      fetchEntries,
      handlePageChange,
      handlePageSizeChange,
      handleRefresh,
      handleFormSuccess,
    }),
    [
      filter,
      filterOptions,
      result,
      page,
      pageSize,
      formError,
      filterLoading,
      aiConfig.baseUrl,
      aiConfig.accessToken,
      aiConfig.model,
      loadOptions,
      fetchEntries,
      handlePageChange,
      handlePageSizeChange,
      handleRefresh,
      handleFormSuccess,
    ],
  );

  return (
    <VocabularyContext.Provider value={contextValue}>
      <div className="flex flex-col gap-4">
        {formError && (
          <div className="alert alert-error text-sm py-2">
            <span>{formError}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setFormError(null)}
            >
              关闭
            </button>
          </div>
        )}

        <VocabularyFilterBar />

        <main className="min-w-0 flex-1">
          {result === null ? (
            <p className="text-base-content/70">
              请设置筛选条件并点击「搜索」。
            </p>
          ) : (
            <VocabularyWordList />
          )}
        </main>
      </div>
    </VocabularyContext.Provider>
  );
}
