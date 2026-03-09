"use client";

import { FilterCheckboxes } from "@/modules/ui/filter-checkboxes";
import { FormRow } from "@/modules/ui/form-row";
import { cn } from "@/modules/ui/jsx";
import { Sparkles } from "lucide-react";
import type {
    ICollocationItem,
    IMorphemeItem,
    IPartOfSpeechMeaning,
    IVocabularyFilterOptions,
} from "../core";
import { PARTS_OF_SPEECH } from "../core";
import { MorphemeMultiSelect, MorphemeSingleSelect } from "./morpheme-select";

/** 表单头部：标题 + 可选「启用 AI 回填」勾选 */
export function EntryFormHeader({
  isEdit,
  showEnableAiFill,
  enableAiFill,
  onEnableAiFillChange,
}: {
  isEdit: boolean;
  showEnableAiFill?: boolean;
  enableAiFill?: boolean;
  onEnableAiFillChange?: (value: boolean) => void;
}) {
  return (
    <>
      <h3 className="font-semibold mb-3">{isEdit ? "编辑单词" : "录入单词"}</h3>
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
    </>
  );
}

/** 单词行：输入 + 加载选项 + AI 补全按钮 */
export function EntryFormWordRow({
  word,
  onWordChange,
  onLoadOptions,
  onAiFill,
  aiLoading,
}: {
  word: string;
  onWordChange: (value: string) => void;
  onLoadOptions: () => void;
  onAiFill: () => void;
  aiLoading: boolean;
}) {
  return (
    <FormRow label="单词">
      <div className="flex flex-1 min-w-0 gap-1">
        <input
          type="text"
          className="input input-bordered input-sm flex-1 min-w-0"
          placeholder="word"
          value={word}
          onChange={(e) => onWordChange(e.target.value)}
          required
        />
        <button
          type="button"
          className="btn btn-square btn-sm btn-ghost"
          onClick={onLoadOptions}
          title="加载选项"
          aria-label="加载选项"
        >
          ↻
        </button>
        <button
          type="button"
          className="btn btn-square btn-sm btn-secondary"
          onClick={onAiFill}
          disabled={aiLoading}
          title="AI 补全"
          aria-label="AI 补全"
        >
          <Sparkles className={cn("size-4", aiLoading && "animate-pulse")} />
        </button>
      </div>
    </FormRow>
  );
}

/** 记法区块 */
export function EntryFormMnemonicSection({
  mnemonic,
  onMnemonicChange,
}: {
  mnemonic: string;
  onMnemonicChange: (value: string) => void;
}) {
  return (
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
        onChange={(e) => onMnemonicChange(e.target.value)}
        rows={3}
      />
    </div>
  );
}

/** 固定搭配区块 */
export function EntryFormCollocationsSection({
  collocations,
  onCollocationsChange,
}: {
  collocations: ICollocationItem[];
  onCollocationsChange: (value: ICollocationItem[]) => void;
}) {
  return (
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
                onCollocationsChange(next);
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
                onCollocationsChange(next);
              }}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-square"
              onClick={() =>
                onCollocationsChange(collocations.filter((_, j) => j !== i))
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
            onCollocationsChange([...collocations, { phrase: "", meaning: "" }])
          }
        >
          + 添加一行
        </button>
      </div>
    </div>
  );
}

/** 词性 + 释义区块 */
export function EntryFormMeaningsSection({
  meanings,
  onAddRow,
  onUpdate,
  onAddItem,
  onRemoveItem,
  onRemoveRow,
}: {
  meanings: IPartOfSpeechMeaning[];
  onAddRow: () => void;
  onUpdate: (index: number, upd: Partial<IPartOfSpeechMeaning>) => void;
  onAddItem: (meaningIndex: number) => void;
  onRemoveItem: (meaningIndex: number, itemIndex: number) => void;
  onRemoveRow: (index: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="label-text">词性 + 释义</span>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          onClick={onAddRow}
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
              onChange={(e) => onUpdate(i, { partOfSpeech: e.target.value })}
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
                      onUpdate(i, { meanings: next });
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    onClick={() => onRemoveItem(i, j)}
                    aria-label="删除释义"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onAddItem(i)}
              >
                + 释义
              </button>
            </div>
            {meanings.length > 1 && (
              <button
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onRemoveRow(i)}
                aria-label="删除该词性"
              >
                删除
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function AiFilledBadges<T extends { text: string; meanings?: string[] }>({
  items,
  onRemove,
  label = "AI 建议（保存时创建）：",
}: {
  items: T[];
  onRemove: (index: number) => void;
  label?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="text-xs text-base-content/60">{label}</span>
      {items.map((p, i) => (
        <span key={i} className="badge badge-sm badge-outline gap-0.5 pr-0.5">
          <span className="max-w-32 truncate" title={p.meanings?.join("；")}>
            {p.text}
            {p.meanings?.length
              ? ` — ${p.meanings.slice(0, 1).join("；")}`
              : ""}
          </span>
          <button type="button" onClick={() => onRemove(i)} aria-label="移除">
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

/** 词素 + 分类区块：前缀/后缀/词根选择 + AI 建议徽章 + 分类多选 */
export function EntryFormMorphemesSection({
  options,
  prefixIds,
  onPrefixIdsChange,
  suffixIds,
  onSuffixIdsChange,
  rootId,
  onRootIdChange,
  categoryId,
  onCategoryIdChange,
  aiFilledPrefixes,
  onAiFilledPrefixesChange,
  aiFilledSuffixes,
  onAiFilledSuffixesChange,
  aiFilledRoot,
  onAiFilledRootChange,
}: {
  options: IVocabularyFilterOptions;
  prefixIds: number[];
  onPrefixIdsChange: (ids: number[]) => void;
  suffixIds: number[];
  onSuffixIdsChange: (ids: number[]) => void;
  rootId: number | null;
  onRootIdChange: (id: number | null) => void;
  categoryId: number | null;
  onCategoryIdChange: (id: number | null) => void;
  aiFilledPrefixes: IMorphemeItem[];
  onAiFilledPrefixesChange: (value: IMorphemeItem[]) => void;
  aiFilledSuffixes: IMorphemeItem[];
  onAiFilledSuffixesChange: (value: IMorphemeItem[]) => void;
  aiFilledRoot: IMorphemeItem | null;
  onAiFilledRootChange: (value: IMorphemeItem | null) => void;
}) {
  return (
    <>
      <MorphemeMultiSelect
        label="前缀"
        options={options.prefixes}
        selectedIds={prefixIds}
        onChange={onPrefixIdsChange}
        placeholder="搜索前缀…"
      />
      <AiFilledBadges
        items={aiFilledPrefixes}
        onRemove={(i) =>
          onAiFilledPrefixesChange(aiFilledPrefixes.filter((_, j) => j !== i))
        }
      />
      <MorphemeMultiSelect
        label="后缀"
        options={options.suffixes}
        selectedIds={suffixIds}
        onChange={onSuffixIdsChange}
        placeholder="搜索后缀…"
      />
      <AiFilledBadges
        items={aiFilledSuffixes}
        onRemove={(i) =>
          onAiFilledSuffixesChange(aiFilledSuffixes.filter((_, j) => j !== i))
        }
      />
      <MorphemeSingleSelect
        label="词根"
        options={options.roots}
        value={rootId}
        onChange={onRootIdChange}
        placeholder="搜索词根…"
      />
      {aiFilledRoot && (
        <AiFilledBadges
          items={[aiFilledRoot]}
          onRemove={() => onAiFilledRootChange(null)}
        />
      )}
      <FilterCheckboxes
        label="分类"
        options={options.categories.map((c) => c.id)}
        selected={categoryId != null ? [categoryId] : []}
        onToggle={(id) => onCategoryIdChange(categoryId === id ? null : id)}
        onReset={() => onCategoryIdChange(null)}
        renderOption={(id) =>
          options.categories.find((c) => c.id === id)?.name ?? String(id)
        }
        maxVisible={0}
      />
    </>
  );
}

/** 表单底部：提交 + 取消 */
export function EntryFormActions({
  loading,
  isEdit,
  onCancel,
}: {
  loading: boolean;
  isEdit: boolean;
  onCancel?: () => void;
}) {
  return (
    <div className="flex gap-2">
      <button
        type="submit"
        className="btn btn-primary btn-sm"
        disabled={loading}
      >
        {loading ? "提交中…" : isEdit ? "更新" : "保存"}
      </button>
      {isEdit && onCancel && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
        >
          取消
        </button>
      )}
    </div>
  );
}
