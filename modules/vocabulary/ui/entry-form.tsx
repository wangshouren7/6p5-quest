"use client";

import { cn } from "@/modules/ui/jsx";
import { Sparkles } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  aiFillVocabulary,
  createVocabularyEntry,
  getVocabularyFilterOptions,
  updateVocabularyEntry,
} from "../actions";
import type {
  ICollocationItem,
  IMorphemeItem,
  IPartOfSpeechMeaning,
  IVocabularyEntryFormData,
  IVocabularyFilterOptions,
  VocabularyAiConfig,
} from "../core";
import { DEFAULT_PART_OF_SPEECH, PARTS_OF_SPEECH } from "../core";
import { useVocabularyOptional } from "./context";
import { FilterCheckboxes } from "./filter-bar";
import { MorphemeMultiSelect, MorphemeSingleSelect } from "./morpheme-select";

const initialMeanings: IPartOfSpeechMeaning[] = [
  { partOfSpeech: DEFAULT_PART_OF_SPEECH, meanings: [""] },
];

export interface EntryFormProps {
  /** 在 Vocabulary 页可从 Context 取得，在 Import 页需传入 */
  aiConfig?: VocabularyAiConfig;
  /** 编辑模式：传入 entryId 和初始数据，提交时调用 update */
  entryId?: number;
  initialData?: IVocabularyEntryFormData;
  /** 可选：预加载的筛选选项，传入后不再显示「加载选项中…」 */
  filterOptions?: IVocabularyFilterOptions | null;
  /** 是否在表单内显示「是否启用 AI 回填」开关（仅导入页：勾选后解析将自动创建回填任务） */
  showEnableAiFill?: boolean;
  enableAiFill?: boolean;
  onEnableAiFillChange?: (value: boolean) => void;
  onSuccess?: () => void;
  onCancel?: () => void;
  onError?: (message: string) => void;
  className?: string;
}

export function EntryForm({
  aiConfig: aiConfigProp,
  entryId,
  initialData,
  filterOptions: filterOptionsProp,
  showEnableAiFill,
  enableAiFill = false,
  onEnableAiFillChange,
  onSuccess: onSuccessProp,
  onCancel,
  onError: onErrorProp,
  className,
}: EntryFormProps) {
  const vocab = useVocabularyOptional();
  const aiConfig = aiConfigProp ?? vocab?.aiConfig;
  const onSuccess = onSuccessProp ?? vocab?.handleFormSuccess;
  const onError = onErrorProp ?? vocab?.setFormError;

  const [word, setWord] = useState(initialData?.word ?? "");
  const [phonetic, setPhonetic] = useState(initialData?.phonetic ?? "");
  const [mnemonic, setMnemonic] = useState(initialData?.mnemonic ?? "");
  const [meanings, setMeanings] = useState<IPartOfSpeechMeaning[]>(
    initialData?.meanings?.length ? initialData.meanings : initialMeanings,
  );
  const [prefixIds, setPrefixIds] = useState<number[]>(
    initialData?.prefixIds ?? [],
  );
  const [suffixIds, setSuffixIds] = useState<number[]>(
    initialData?.suffixIds ?? [],
  );
  const [rootId, setRootId] = useState<number | null>(
    initialData?.rootId ?? null,
  );
  const [categoryId, setCategoryId] = useState<number | null>(
    initialData?.categoryId ?? null,
  );
  const [collocations, setCollocations] = useState<ICollocationItem[]>(() => {
    const raw = initialData?.collocations ?? [];
    return raw.map((c) =>
      typeof c === "string"
        ? { phrase: c, meaning: "" }
        : { phrase: c.phrase ?? "", meaning: c.meaning ?? "" },
    );
  });
  const [options, setOptions] = useState<IVocabularyFilterOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  /** AI 回填的词素（仅展示，点击保存时才创建） */
  const [aiFilledPrefixes, setAiFilledPrefixes] = useState<IMorphemeItem[]>(
    initialData?.aiFilledPrefixes ?? [],
  );
  const [aiFilledSuffixes, setAiFilledSuffixes] = useState<IMorphemeItem[]>(
    initialData?.aiFilledSuffixes ?? [],
  );
  const [aiFilledRoot, setAiFilledRoot] = useState<IMorphemeItem | null>(
    initialData?.aiFilledRoot ?? null,
  );

  const loadOptions = useCallback(async () => {
    const opts = await getVocabularyFilterOptions();
    setOptions(opts);
  }, []);

  useEffect(() => {
    if (filterOptionsProp == null) loadOptions();
  }, [filterOptionsProp, loadOptions]);

  const effectiveOptions = filterOptionsProp ?? options;

  const handleAiFill = useCallback(async () => {
    if (!aiConfig) return;
    const w = word.trim();
    if (!w) {
      onError?.("请先输入单词");
      return;
    }
    setAiLoading(true);
    try {
      const result = await aiFillVocabulary(w, {
        baseUrl: aiConfig.baseUrl || undefined,
        accessToken: aiConfig.accessToken || undefined,
        model: aiConfig.model || undefined,
      });
      if ("error" in result) {
        onError?.(result.error);
        return;
      }
      const data = result;
      if (data.phonetic != null) setPhonetic(data.phonetic);
      if (data.mnemonic != null) setMnemonic(data.mnemonic);
      if (data.partOfSpeechMeanings?.length)
        setMeanings(
          data.partOfSpeechMeanings.map((m) => ({
            partOfSpeech: m.partOfSpeech ?? "",
            meanings: Array.isArray(m.meanings) ? m.meanings : [""],
          })),
        );
      if (categoryId == null && data.category && effectiveOptions?.categories) {
        const exact = effectiveOptions?.categories.find(
          (c) => c.name === data.category,
        );
        const fallback = effectiveOptions?.categories.find(
          (c) =>
            c.name.includes(data.category!) || data.category!.includes(c.name),
        );
        const cat = exact ?? fallback;
        if (cat) setCategoryId(cat.id);
      }
      if (data.collocations?.length) {
        setCollocations(
          data.collocations
            .filter(
              (c) =>
                typeof (c as ICollocationItem).phrase === "string" &&
                (c as ICollocationItem).phrase.trim(),
            )
            .map((c) => ({
              phrase: (c as ICollocationItem).phrase.trim(),
              meaning: String((c as ICollocationItem).meaning ?? "").trim(),
            })),
        );
      }
      if (
        (data.prefixes?.length ?? 0) > 0 ||
        (data.suffixes?.length ?? 0) > 0 ||
        (data.root && typeof data.root === "object")
      ) {
        setAiFilledPrefixes(
          (data.prefixes ?? []).filter(
            (p) => typeof p === "object" && p?.text?.trim(),
          ) as IMorphemeItem[],
        );
        setAiFilledSuffixes(
          (data.suffixes ?? []).filter(
            (s) => typeof s === "object" && s?.text?.trim(),
          ) as IMorphemeItem[],
        );
        setAiFilledRoot(
          data.root && typeof data.root === "object" && data.root.text?.trim()
            ? (data.root as IMorphemeItem)
            : null,
        );
      }
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "AI 补全失败");
    } finally {
      setAiLoading(false);
    }
  }, [word, aiConfig, effectiveOptions?.categories, onError]);

  const addMeaningRow = () => {
    setMeanings((prev) => [
      ...prev,
      { partOfSpeech: DEFAULT_PART_OF_SPEECH, meanings: [""] },
    ]);
  };

  const updateMeaning = (index: number, upd: Partial<IPartOfSpeechMeaning>) => {
    setMeanings((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], ...upd };
      return next;
    });
  };

  const addMeaningItem = (meaningIndex: number) => {
    setMeanings((prev) => {
      const next = [...prev];
      next[meaningIndex] = {
        ...next[meaningIndex],
        meanings: [...next[meaningIndex].meanings, ""],
      };
      return next;
    });
  };

  const removeMeaningItem = (meaningIndex: number, itemIndex: number) => {
    setMeanings((prev) => {
      const next = [...prev];
      const m = next[meaningIndex].meanings.filter((_, i) => i !== itemIndex);
      next[meaningIndex] = {
        ...next[meaningIndex],
        meanings: m.length ? m : [""],
      };
      return next;
    });
  };

  const removeMeaningRow = (index: number) => {
    if (meanings.length <= 1) return;
    setMeanings((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data: IVocabularyEntryFormData = {
        word: word.trim(),
        phonetic: phonetic.trim(),
        mnemonic: mnemonic.trim(),
        meanings: meanings
          .filter(
            (m) => m.partOfSpeech.trim() && m.meanings.some((s) => s.trim()),
          )
          .map((m) => ({
            partOfSpeech: m.partOfSpeech,
            meanings: m.meanings.filter((s) => s.trim()),
          })),
        prefixIds,
        suffixIds,
        rootId,
        categoryId,
        collocations: collocations
          .filter((c) => c.phrase.trim())
          .map((c) => ({
            phrase: c.phrase.trim(),
            meaning: (c.meaning ?? "").trim(),
          })),
        aiFilledPrefixes: aiFilledPrefixes.length
          ? aiFilledPrefixes
          : undefined,
        aiFilledSuffixes: aiFilledSuffixes.length
          ? aiFilledSuffixes
          : undefined,
        aiFilledRoot: aiFilledRoot ?? undefined,
      };
      if (entryId != null) {
        const result = await updateVocabularyEntry(entryId, data);
        if ("error" in result) {
          onError?.(result.error);
          return;
        }
        setAiFilledPrefixes([]);
        setAiFilledSuffixes([]);
        setAiFilledRoot(null);
        onSuccess?.();
      } else {
        const result = await createVocabularyEntry(data);
        if ("error" in result) {
          onError?.(result.error);
          return;
        }
        setWord("");
        setPhonetic("");
        setMnemonic("");
        setMeanings(initialMeanings);
        setPrefixIds([]);
        setSuffixIds([]);
        setRootId(null);
        setCategoryId(null);
        setCollocations([]);
        setAiFilledPrefixes([]);
        setAiFilledSuffixes([]);
        setAiFilledRoot(null);
        onSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  };

  if (!aiConfig) {
    return (
      <p className="text-base-content/70">
        需要 AI 配置（请在词汇页使用或传入 aiConfig）。
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-base-300 bg-base-200 p-4",
        className,
      )}
    >
      <h3 className="font-semibold mb-3">
        {entryId != null ? "编辑单词" : "录入单词"}
      </h3>
      {showEnableAiFill && (
        <label className="flex items-center gap-2 cursor-pointer mb-3">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={enableAiFill}
            onChange={(e) => onEnableAiFillChange?.(e.target.checked)}
          />
          <span className="text-sm">
            是否启用 AI 回填（由后台定时任务执行，勾选后解析将自动创建回填任务）
          </span>
        </label>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="label-text w-16 shrink-0">单词</label>
          <div className="flex flex-1 min-w-0 gap-1">
            <input
              type="text"
              className="input input-bordered input-sm flex-1 min-w-0"
              placeholder="word"
              value={word}
              onChange={(e) => setWord(e.target.value)}
              required
            />
            <button
              type="button"
              className="btn btn-square btn-sm btn-ghost"
              onClick={loadOptions}
              title="加载选项"
              aria-label="加载选项"
            >
              ↻
            </button>
            <button
              type="button"
              className="btn btn-square btn-sm btn-secondary"
              onClick={handleAiFill}
              disabled={aiLoading}
              title="AI 补全"
              aria-label="AI 补全"
            >
              <Sparkles
                className={cn("size-4", aiLoading && "animate-pulse")}
              />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="label-text w-16 shrink-0">音标</label>
          <input
            type="text"
            className="input input-bordered input-sm flex-1 min-w-0"
            placeholder="/ˈeksəmpəl/"
            value={phonetic}
            onChange={(e) => setPhonetic(e.target.value)}
          />
        </div>

        <div className="form-control">
          <label className="label py-0.5">
            <span className="label-text font-medium">记法</span>
            <span className="label-text-alt text-base-content/60">
              如何记忆该词，可结合词根词缀
            </span>
          </label>
          <textarea
            className="textarea textarea-bordered textarea-sm w-full min-h-20"
            placeholder="例如：hydro 水 + sphere 球 → 水圈、地球"
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            rows={3}
          />
        </div>

        <div className="form-control">
          <div className="label py-0.5">
            <span className="label-text font-medium">固定搭配</span>
            <span className="label-text-alt text-base-content/60">
              短语 + 中文意思，如 pay attention / 注意
            </span>
          </div>
          <div className="space-y-2">
            {collocations.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  className="input input-bordered input-sm flex-1 min-w-0"
                  placeholder="短语，如 pay attention"
                  value={c.phrase}
                  onChange={(e) => {
                    const next = [...collocations];
                    next[i] = { ...next[i], phrase: e.target.value };
                    setCollocations(next);
                  }}
                />
                <input
                  type="text"
                  className="input input-bordered input-sm flex-1 min-w-0"
                  placeholder="意思，如 注意"
                  value={c.meaning}
                  onChange={(e) => {
                    const next = [...collocations];
                    next[i] = { ...next[i], meaning: e.target.value };
                    setCollocations(next);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm btn-square"
                  onClick={() =>
                    setCollocations(collocations.filter((_, j) => j !== i))
                  }
                  aria-label="删除该行"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setCollocations([...collocations, { phrase: "", meaning: "" }])
              }
            >
              + 添加一行
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="label-text">词性 + 释义</span>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={addMeaningRow}
            >
              + 添加词性
            </button>
          </div>
          <div className="space-y-2">
            {meanings.map((m, i) => (
              <div
                key={i}
                className="flex flex-wrap items-start gap-2 p-2 rounded bg-base-100 border border-base-300"
              >
                <select
                  className="select select-bordered select-sm w-24"
                  value={m.partOfSpeech}
                  onChange={(e) =>
                    updateMeaning(i, { partOfSpeech: e.target.value })
                  }
                >
                  {PARTS_OF_SPEECH.map((pos) => (
                    <option key={pos} value={pos}>
                      {pos}
                    </option>
                  ))}
                </select>
                <div className="flex-1 min-w-0 space-y-1">
                  {m.meanings.map((mm, j) => (
                    <div key={j} className="flex gap-1">
                      <input
                        type="text"
                        className="input input-bordered input-sm flex-1 min-w-0"
                        placeholder="释义"
                        value={mm}
                        onChange={(e) => {
                          const next = [...m.meanings];
                          next[j] = e.target.value;
                          updateMeaning(i, { meanings: next });
                        }}
                      />
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square"
                        onClick={() => removeMeaningItem(i, j)}
                        aria-label="删除释义"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => addMeaningItem(i)}
                  >
                    + 释义
                  </button>
                </div>
                {meanings.length > 1 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => removeMeaningRow(i)}
                    aria-label="删除该词性"
                  >
                    删除
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 前缀、后缀、词根：可搜索选择并展示释义，找不到可用 AI 补全；分类：FilterCheckboxes 单选 */}
        {effectiveOptions ? (
          <>
            <MorphemeMultiSelect
              label="前缀"
              options={effectiveOptions.prefixes}
              selectedIds={prefixIds}
              onChange={setPrefixIds}
              placeholder="搜索前缀…"
            />
            {aiFilledPrefixes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-base-content/60">
                  AI 建议（保存时创建）：
                </span>
                {aiFilledPrefixes.map((p, i) => (
                  <span
                    key={i}
                    className="badge badge-sm badge-outline gap-0.5 pr-0.5"
                  >
                    <span
                      className="max-w-32 truncate"
                      title={p.meanings?.join("；")}
                    >
                      {p.text}
                      {p.meanings?.length
                        ? ` — ${p.meanings.slice(0, 1).join("；")}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAiFilledPrefixes((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                      aria-label="移除"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <MorphemeMultiSelect
              label="后缀"
              options={effectiveOptions.suffixes}
              selectedIds={suffixIds}
              onChange={setSuffixIds}
              placeholder="搜索后缀…"
            />
            {aiFilledSuffixes.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-base-content/60">
                  AI 建议（保存时创建）：
                </span>
                {aiFilledSuffixes.map((s, i) => (
                  <span
                    key={i}
                    className="badge badge-sm badge-outline gap-0.5 pr-0.5"
                  >
                    <span
                      className="max-w-32 truncate"
                      title={s.meanings?.join("；")}
                    >
                      {s.text}
                      {s.meanings?.length
                        ? ` — ${s.meanings.slice(0, 1).join("；")}`
                        : ""}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setAiFilledSuffixes((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                      aria-label="移除"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <MorphemeSingleSelect
              label="词根"
              options={effectiveOptions.roots}
              value={rootId}
              onChange={setRootId}
              placeholder="搜索词根…"
            />
            {aiFilledRoot && (
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-base-content/60">
                  AI 建议（保存时创建）：
                </span>
                <span className="badge badge-sm badge-outline gap-0.5 pr-0.5">
                  <span
                    className="max-w-32 truncate"
                    title={aiFilledRoot.meanings?.join("；")}
                  >
                    {aiFilledRoot.text}
                    {aiFilledRoot.meanings?.length
                      ? ` — ${aiFilledRoot.meanings.slice(0, 1).join("；")}`
                      : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAiFilledRoot(null)}
                    aria-label="移除"
                  >
                    ×
                  </button>
                </span>
              </div>
            )}
            <FilterCheckboxes
              label="分类"
              options={effectiveOptions.categories.map((c) => c.id)}
              selected={categoryId != null ? [categoryId] : []}
              onToggle={(id) =>
                setCategoryId((prev) => (prev === id ? null : id))
              }
              onReset={() => setCategoryId(null)}
              renderOption={(id) =>
                effectiveOptions.categories.find((c) => c.id === id)?.name ??
                String(id)
              }
              maxVisible={0}
            />
          </>
        ) : (
          <p className="text-sm text-base-content/50">加载选项中…</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={loading}
          >
            {loading ? "提交中…" : entryId != null ? "更新" : "保存"}
          </button>
          {entryId != null && onCancel && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onCancel}
            >
              取消
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
