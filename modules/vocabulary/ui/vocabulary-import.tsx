"use client";

import { devError } from "@/utils/logger";
import { useControls } from "leva";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    aiParseBatchVocabulary,
    createVocabularyEntriesBatch,
    createVocabularyImportTasks,
    getVocabularyFilterOptions,
    getVocabularyImportTasks,
    updateVocabularyEntriesCategoryByWords,
    upsertVocabularyAiSettings,
} from "../actions";
import type { IVocabularyEntryFormData } from "../core";
import {
    getStoredVocabularyAiConfig,
    saveVocabularyAiConfig,
} from "./ai-config-storage";

/** 仅在客户端挂载后渲染，避免 useControls + localStorage 导致 hydration 报错 */
export function VocabularyImport() {
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
  return <VocabularyImportContent />;
}

function VocabularyImportContent() {
  const [aiConfig] = useControls(
    "词汇",
    () => {
      const stored = getStoredVocabularyAiConfig();
      return {
        baseUrl: {
          value: stored.baseUrl,
          label: "Base URL",
        },
        accessToken: {
          value: stored.accessToken,
          label: "API Key",
        },
        model: {
          value: stored.model,
          label: "Model",
        },
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
    }).catch((err) =>
      devError("[vocabulary-import] upsertVocabularyAiSettings", err),
    );
  }, [aiConfig.baseUrl, aiConfig.accessToken, aiConfig.model]);

  const [rawText, setRawText] = useState("");
  /** 解析出的词条列表（含词性+释义，若原文有则从原文解析） */
  const [parsedEntries, setParsedEntries] = useState<
    IVocabularyEntryFormData[] | null
  >(null);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseProgress, setParseProgress] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  /** AI 回填任务列表；保存后加载并轮询 */
  const [tasks, setTasks] = useState<
    Awaited<ReturnType<typeof getVocabularyImportTasks>>["tasks"] | null
  >(null);
  const [batchSaveLoading, setBatchSaveLoading] = useState(false);
  const [batchSaveResult, setBatchSaveResult] = useState<string | null>(null);
  /** 筛选选项（含分类），解析出单词后加载，用于批量设置分类 */
  const [filterOptions, setFilterOptions] = useState<Awaited<
    ReturnType<typeof getVocabularyFilterOptions>
  > | null>(null);
  /** 批量设置分类：选中的分类 id，空表示不设置/清空 */
  const [batchCategoryId, setBatchCategoryId] = useState<number | "">("");
  const [batchCategoryApplyLoading, setBatchCategoryApplyLoading] =
    useState(false);
  const [batchCategoryApplyResult, setBatchCategoryApplyResult] = useState<
    string | null
  >(null);

  /** 解析出词条后加载分类选项 */
  useEffect(() => {
    if (parsedEntries == null || parsedEntries.length === 0) return;
    getVocabularyFilterOptions()
      .then(setFilterOptions)
      .catch((err) =>
        devError("[vocabulary-import] getVocabularyFilterOptions", err),
      );
  }, [parsedEntries?.length]);

  /** 当已展示任务列表时，每 5 秒轮询一次 */
  useEffect(() => {
    if (tasks === null) return;
    const t = setInterval(() => {
      getVocabularyImportTasks()
        .then((r) => setTasks(r.tasks))
        .catch((err) =>
          devError("[vocabulary-import] getVocabularyImportTasks", err),
        );
    }, 5000);
    return () => clearInterval(t);
  }, [tasks === null]);

  const opts = useMemo(
    () => ({
      baseUrl: aiConfig.baseUrl || undefined,
      accessToken: aiConfig.accessToken || undefined,
      model: aiConfig.model || undefined,
    }),
    [aiConfig.baseUrl, aiConfig.accessToken, aiConfig.model],
  );

  const handleParse = useCallback(async () => {
    if (!rawText.trim()) {
      setParseError("请粘贴要解析的文本");
      return;
    }
    setParseLoading(true);
    setParseError(null);
    setParseProgress("正在解析词条（有词性/释义则一并提取）…");
    try {
      const result = await aiParseBatchVocabulary(rawText.trim(), opts);
      if ("error" in result) {
        setParseError(result.error);
        setParseProgress(null);
        setParseLoading(false);
        return;
      }
      if (result.length === 0) {
        setParseError("未识别到词条，请检查格式或重试");
        setParseProgress(null);
        setParseLoading(false);
        return;
      }
      setParsedEntries(result);
      setParseProgress(null);
    } finally {
      setParseLoading(false);
      setParseProgress(null);
    }
  }, [rawText, opts]);

  const handleReset = useCallback(() => {
    setParsedEntries(null);
    setTasks(null);
    setRawText("");
    setParseError(null);
    setBatchSaveResult(null);
    setBatchCategoryId("");
    setBatchCategoryApplyResult(null);
  }, []);

  const words = useMemo(
    () => parsedEntries?.map((e) => e.word.trim()).filter(Boolean) ?? [],
    [parsedEntries],
  );

  const handleBatchApplyCategory = useCallback(async () => {
    if (!words.length) return;
    setBatchCategoryApplyLoading(true);
    setBatchCategoryApplyResult(null);
    try {
      const result = await updateVocabularyEntriesCategoryByWords(
        words,
        batchCategoryId === "" ? null : batchCategoryId,
      );
      if ("error" in result) {
        setBatchCategoryApplyResult(result.error);
      } else {
        setBatchCategoryApplyResult(
          `已为 ${result.updated} 个单词${batchCategoryId === "" ? "清空分类" : "设置分类"}`,
        );
      }
    } finally {
      setBatchCategoryApplyLoading(false);
    }
  }, [words, batchCategoryId]);

  const handleBatchSave = useCallback(async () => {
    if (!parsedEntries?.length) return;
    setBatchSaveLoading(true);
    setBatchSaveResult(null);
    try {
      const batchResult = await createVocabularyEntriesBatch(parsedEntries);
      if ("error" in batchResult) {
        setBatchSaveResult(batchResult.error);
        setBatchSaveLoading(false);
        return;
      }
      // 仅对「本次新写入」的单词创建回填任务，重复词（该单词已存在）不创建
      const duplicateWords = new Set(
        batchResult.errors
          .filter((e) => e.includes("该单词已存在"))
          .map((e) => e.split(":")[0]?.trim() ?? ""),
      );
      const wordsForTasks = words.filter((w) => !duplicateWords.has(w.trim()));
      if (wordsForTasks.length > 0) {
        const taskResult = await createVocabularyImportTasks(
          wordsForTasks,
          opts,
        );
        if ("error" in taskResult) {
          setBatchSaveResult(
            `已写入 ${batchResult.saved} 条；创建回填任务失败：${taskResult.error}`,
          );
          setBatchSaveLoading(false);
          return;
        }
        setBatchSaveResult(
          `已写入 ${batchResult.saved} 条，已创建 ${taskResult.count} 个 AI 回填任务（后台将自动补全释义）${duplicateWords.size > 0 ? `；${duplicateWords.size} 个重复词未创建任务` : ""}`,
        );
        const { tasks: list } = await getVocabularyImportTasks();
        setTasks(list);
      } else {
        setBatchSaveResult(
          batchResult.saved > 0
            ? `已写入 ${batchResult.saved} 条；本批均为重复词，未创建回填任务`
            : `本批均为重复词，未写入也未创建回填任务`,
        );
      }
    } finally {
      setBatchSaveLoading(false);
    }
  }, [parsedEntries, words, opts]);

  if (parsedEntries == null) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-base-content/70">
          粘贴包含单词列表的文本（若有词性、释义会一并解析），点击「AI
          解析」；解析后点击「保存」写入数据库并创建 AI
          回填任务（后台补全音标、记法等）。
        </p>
        {parseProgress && (
          <p className="text-sm text-primary">{parseProgress}</p>
        )}
        <textarea
          className="textarea textarea-bordered w-full min-h-48 font-mono text-sm"
          placeholder="例如：atmosphere n. 大气层；气氛&#10;destructive adj. 破坏/有害的&#10;..."
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleParse}
            disabled={parseLoading}
          >
            {parseLoading ? "解析中…" : "AI 解析"}
          </button>
          <Link href="/vocabulary" className="btn btn-ghost">
            返回词汇
          </Link>
        </div>
        {parseError && (
          <div className="alert alert-error text-sm">
            <span>{parseError}</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setParseError(null)}
            >
              关闭
            </button>
          </div>
        )}
      </div>
    );
  }

  const total = words.length;
  return (
    <div className="flex flex-col gap-4">
      {parseProgress && <p className="text-sm text-primary">{parseProgress}</p>}

      <div className="rounded-lg border border-base-300 bg-base-200/50 p-3">
        <p className="mb-2 text-sm font-medium text-base-content/70">
          已解析 {total} 个单词
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {words.map((w, i) => (
            <li key={`${i}-${w}`}>
              <span className="rounded px-2 py-0.5 text-sm bg-base-300">
                {w}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleBatchSave}
          disabled={batchSaveLoading}
        >
          {batchSaveLoading ? "保存中…" : "保存"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleReset}
        >
          再解析一批
        </button>
        <Link href="/vocabulary" className="btn btn-ghost btn-sm">
          返回词汇
        </Link>
      </div>
      {batchSaveResult && (
        <p className="text-sm text-base-content/70">{batchSaveResult}</p>
      )}
      {batchSaveResult && words.length > 0 && (
        <div className="rounded-lg border border-base-300 bg-base-200/50 p-3">
          <p className="mb-2 text-sm font-medium text-base-content/70">
            为这批单词设置分类（可选）
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="select select-sm select-bordered w-40"
              value={batchCategoryId === "" ? "" : String(batchCategoryId)}
              onChange={(e) => {
                const v = e.target.value;
                setBatchCategoryId(v === "" ? "" : Number(v));
              }}
              aria-label="选择分类"
            >
              <option value="">（不设置 / 留空）</option>
              {(filterOptions?.categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-sm btn-primary"
              onClick={handleBatchApplyCategory}
              disabled={batchCategoryApplyLoading}
            >
              {batchCategoryApplyLoading ? "应用中…" : "应用"}
            </button>
          </div>
          {batchCategoryApplyResult && (
            <p className="mt-2 text-sm text-base-content/60">
              {batchCategoryApplyResult}
            </p>
          )}
        </div>
      )}
      {tasks != null && tasks.length > 0 && (
        <div className="rounded-lg border border-base-300 bg-base-200/50 p-3">
          <p className="mb-2 text-sm font-medium text-base-content/70">
            AI 回填任务列表（每 5 秒刷新）
          </p>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
            <table className="table table-xs">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>单词</th>
                  <th>状态</th>
                  <th>错误</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td>
                    <td>{t.word}</td>
                    <td>{t.status}</td>
                    <td
                      className="max-w-32 truncate"
                      title={t.error ?? undefined}
                    >
                      {t.error ?? "—"}
                    </td>
                    <td className="text-xs text-base-content/60">
                      {t.createdAt instanceof Date
                        ? t.createdAt.toLocaleString()
                        : String(t.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
