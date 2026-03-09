"use client";

import { devError } from "@/utils/logger";
import { useControls } from "leva";
import { useObservable } from "rcrx";
import { useEffect, useMemo, useState } from "react";
import {
  getVocabularyEntries,
  getVocabularyFilterOptions,
  upsertVocabularyAiSettings,
} from "../actions";
import { Vocabulary as VocabularyClass } from "../core";
import {
  getStoredVocabularyAiConfig,
  saveVocabularyAiConfig,
} from "./ai-config-storage";
import { useVocabulary, VocabularyContext } from "./context";
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
    }).catch((err) => devError("[vocabulary] upsertVocabularyAiSettings", err));
  }, [aiConfig.baseUrl, aiConfig.accessToken, aiConfig.model]);

  const vocabulary = useMemo(
    () =>
      new VocabularyClass({
        fetch: {
          fetchEntries: getVocabularyEntries,
          fetchFilterOptions: getVocabularyFilterOptions,
        },
      }),
    [],
  );
  useEffect(() => {
    vocabulary.data.loadFilterOptions();
  }, [vocabulary]);

  const contextValue = useMemo(
    () => ({
      vocabulary,
      aiConfig: {
        baseUrl: aiConfig.baseUrl,
        accessToken: aiConfig.accessToken,
        model: aiConfig.model,
      },
    }),
    [vocabulary, aiConfig.baseUrl, aiConfig.accessToken, aiConfig.model],
  );

  return (
    <VocabularyContext.Provider value={contextValue}>
      <VocabularyInner />
    </VocabularyContext.Provider>
  );
}

function VocabularyInner() {
  const { vocabulary } = useVocabulary();
  const formError = useObservable(vocabulary.data.formError$);
  const result = useObservable(vocabulary.data.result$);

  return (
    <div className="flex flex-col gap-4">
      {formError != null && formError !== "" && (
        <div className="alert alert-error text-sm py-2">
          <span>{formError}</span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => vocabulary.data.setFormError(null)}
          >
            关闭
          </button>
        </div>
      )}

      <VocabularyFilterBar />

      <main className="min-w-0 flex-1">
        {result === null ? (
          <p className="text-base-content/70">请设置筛选条件并点击「搜索」。</p>
        ) : (
          <VocabularyWordList />
        )}
      </main>
    </div>
  );
}
