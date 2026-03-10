"use client";

import { FormRow } from "@/modules/ui/form-row";
import { cn } from "@/modules/ui/jsx";
import { getErrorMessage } from "@/utils/error";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type {
    ICollocationItem,
    IMorphemeItem,
    IPartOfSpeechMeaning,
    IVocabularyAiFillResult,
    IVocabularyEntryFormData,
    IVocabularyFilterOptions,
    VocabularyAiConfig,
} from "../core";
import { DEFAULT_PART_OF_SPEECH } from "../core";
import {
    entryFormSchema,
    type EntryFormValues,
} from "../core/entry-form-schema";
import { useVocabularyOptional } from "./context";
import {
    EntryFormActions,
    EntryFormCollocationsSection,
    EntryFormHeader,
    EntryFormMeaningsSection,
    EntryFormMnemonicSection,
    EntryFormMorphemesSection,
    EntryFormWordRow,
} from "./entry-form-sections";
import { useEntryFormActions } from "./use-entry-form-actions";

const initialMeanings: IPartOfSpeechMeaning[] = [
  { partOfSpeech: DEFAULT_PART_OF_SPEECH, meanings: [""] },
];

function getDefaultValues(
  initial?: IVocabularyEntryFormData | null,
): EntryFormValues {
  const rawCollocations = initial?.collocations ?? [];
  const collocations = rawCollocations.map((c) =>
    typeof c === "string"
      ? { phrase: c, meaning: "" }
      : { phrase: c.phrase ?? "", meaning: c.meaning ?? "" },
  );
  return {
    word: initial?.word ?? "",
    phonetic: initial?.phonetic ?? "",
    mnemonic: initial?.mnemonic ?? "",
    meanings: initial?.meanings?.length
      ? initial.meanings
      : [...initialMeanings],
    collocations,
    prefixIds: initial?.prefixIds ?? [],
    suffixIds: initial?.suffixIds ?? [],
    rootId: initial?.rootId ?? null,
    categoryId: initial?.categoryId ?? null,
    aiFilledPrefixes: initial?.aiFilledPrefixes ?? [],
    aiFilledSuffixes: initial?.aiFilledSuffixes ?? [],
    aiFilledRoot: initial?.aiFilledRoot ?? null,
  };
}

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
  const actions = useEntryFormActions();
  const aiConfig = aiConfigProp ?? vocab?.aiConfig;
  const onSuccess =
    onSuccessProp ??
    (vocab?.vocabulary
      ? () => {
          void vocab.vocabulary.data.handleFormSuccess();
        }
      : undefined);
  const onError =
    onErrorProp ??
    (vocab?.vocabulary
      ? (message: string) => vocab.vocabulary.data.setFormError(message)
      : undefined);

  const form = useForm<EntryFormValues>({
    resolver: zodResolver(entryFormSchema),
    defaultValues: getDefaultValues(initialData),
  });

  const {
    control,
    watch,
    setValue,
    getValues,
    handleSubmit: formHandleSubmit,
    reset,
  } = form;

  const meaningsFieldArray = useFieldArray({ control, name: "meanings" });
  const collocationsFieldArray = useFieldArray({
    control,
    name: "collocations",
  });

  const [options, setOptions] = useState<IVocabularyFilterOptions | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const word = watch("word");
  const phonetic = watch("phonetic");
  const mnemonic = watch("mnemonic");
  const meanings = watch("meanings");
  const collocations = watch("collocations");
  const prefixIds = watch("prefixIds");
  const suffixIds = watch("suffixIds");
  const rootId = watch("rootId");
  const categoryId = watch("categoryId");
  const aiFilledPrefixes = watch("aiFilledPrefixes") ?? [];
  const aiFilledSuffixes = watch("aiFilledSuffixes") ?? [];
  const aiFilledRoot = watch("aiFilledRoot") ?? null;

  const loadFilterOptionsFn = actions.loadFilterOptions;
  const loadOptions = useCallback(async () => {
    const opts = await loadFilterOptionsFn();
    setOptions(opts);
  }, [loadFilterOptionsFn]);

  useEffect(() => {
    if (filterOptionsProp == null) loadOptions();
  }, [filterOptionsProp, loadOptions]);

  const effectiveOptions = filterOptionsProp ?? options;

  useEffect(() => {
    if (initialData != null) {
      reset(getDefaultValues(initialData));
    }
  }, [entryId, initialData, reset]);

  const handleAiFill = useCallback(async () => {
    if (!aiConfig) return;
    const w = getValues("word").trim();
    if (!w) {
      onError?.("请先输入单词");
      return;
    }
    setAiLoading(true);
    try {
      const result = await actions.runAiFill(w, aiConfig);
      if (!result.ok) {
        onError?.(result.error);
        return;
      }
      const data = result.data as IVocabularyAiFillResult;
      if (data.phonetic != null) setValue("phonetic", data.phonetic);
      if (data.mnemonic != null) setValue("mnemonic", data.mnemonic);
      if (data.partOfSpeechMeanings?.length)
        setValue(
          "meanings",
          data.partOfSpeechMeanings.map((m) => ({
            partOfSpeech: m.partOfSpeech ?? "",
            meanings: Array.isArray(m.meanings) ? m.meanings : [""],
          })),
        );
      if (categoryId == null && data.category && effectiveOptions?.categories) {
        const exact = effectiveOptions.categories.find(
          (c) => c.name === data.category,
        );
        const fallback = effectiveOptions.categories.find(
          (c) =>
            c.name.includes(data.category!) || data.category!.includes(c.name),
        );
        const cat = exact ?? fallback;
        if (cat) setValue("categoryId", cat.id);
      }
      if (data.collocations?.length) {
        setValue(
          "collocations",
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
        setValue(
          "aiFilledPrefixes",
          (data.prefixes ?? []).filter(
            (p) => typeof p === "object" && p?.text?.trim(),
          ) as IMorphemeItem[],
        );
        setValue(
          "aiFilledSuffixes",
          (data.suffixes ?? []).filter(
            (s) => typeof s === "object" && s?.text?.trim(),
          ) as IMorphemeItem[],
        );
        setValue(
          "aiFilledRoot",
          data.root && typeof data.root === "object" && data.root.text?.trim()
            ? (data.root as IMorphemeItem)
            : null,
        );
      }
    } catch (e) {
      onError?.(getErrorMessage(e, "AI 补全失败"));
    } finally {
      setAiLoading(false);
    }
  }, [
    actions,
    aiConfig,
    categoryId,
    effectiveOptions?.categories,
    getValues,
    onError,
    setValue,
  ]);

  const addMeaningRow = useCallback(() => {
    meaningsFieldArray.append({
      partOfSpeech: DEFAULT_PART_OF_SPEECH,
      meanings: [""],
    });
  }, [meaningsFieldArray]);

  const updateMeaning = useCallback(
    (index: number, upd: Partial<IPartOfSpeechMeaning>) => {
      const current = getValues(`meanings.${index}`);
      if (current) meaningsFieldArray.update(index, { ...current, ...upd });
    },
    [getValues, meaningsFieldArray],
  );

  const addMeaningItem = useCallback(
    (meaningIndex: number) => {
      const row = getValues(`meanings.${meaningIndex}`);
      if (row)
        setValue(`meanings.${meaningIndex}.meanings`, [...row.meanings, ""]);
    },
    [getValues, setValue],
  );

  const removeMeaningItem = useCallback(
    (meaningIndex: number, itemIndex: number) => {
      const row = getValues(`meanings.${meaningIndex}`);
      if (!row) return;
      const next = row.meanings.filter((_, i) => i !== itemIndex);
      setValue(`meanings.${meaningIndex}.meanings`, next.length ? next : [""]);
    },
    [getValues, setValue],
  );

  const removeMeaningRow = useCallback(
    (index: number) => {
      if (meanings.length <= 1) return;
      meaningsFieldArray.remove(index);
    },
    [meanings.length, meaningsFieldArray],
  );

  const onValidSubmit = useCallback(
    async (data: EntryFormValues) => {
      setLoading(true);
      try {
        const payload: IVocabularyEntryFormData = {
          word: data.word.trim(),
          phonetic: data.phonetic.trim(),
          mnemonic: data.mnemonic.trim(),
          meanings: data.meanings
            .filter(
              (m) => m.partOfSpeech.trim() && m.meanings.some((s) => s.trim()),
            )
            .map((m) => ({
              partOfSpeech: m.partOfSpeech,
              meanings: m.meanings.filter((s) => s.trim()),
            })),
          prefixIds: data.prefixIds,
          suffixIds: data.suffixIds,
          rootId: data.rootId,
          categoryId: data.categoryId,
          collocations: data.collocations
            .filter((c) => c.phrase.trim())
            .map((c) => ({
              phrase: c.phrase.trim(),
              meaning: (c.meaning ?? "").trim(),
            })),
          aiFilledPrefixes:
            (data.aiFilledPrefixes?.length ?? 0) > 0
              ? data.aiFilledPrefixes
              : undefined,
          aiFilledSuffixes:
            (data.aiFilledSuffixes?.length ?? 0) > 0
              ? data.aiFilledSuffixes
              : undefined,
          aiFilledRoot: data.aiFilledRoot ?? undefined,
        };
        if (entryId != null) {
          const result = await actions.updateEntry(entryId, payload);
          if ("error" in result && result.error) {
            onError?.(result.error);
            return;
          }
          setValue("aiFilledPrefixes", []);
          setValue("aiFilledSuffixes", []);
          setValue("aiFilledRoot", null);
          onSuccess?.();
        } else {
          const result = await actions.createEntry(payload);
          if ("error" in result) {
            onError?.(result.error);
            return;
          }
          reset(getDefaultValues(null));
          onSuccess?.();
        }
      } finally {
        setLoading(false);
      }
    },
    [actions, entryId, onError, onSuccess, reset, setValue],
  );

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
      <EntryFormHeader
        isEdit={entryId != null}
        showEnableAiFill={showEnableAiFill}
        enableAiFill={enableAiFill}
        onEnableAiFillChange={onEnableAiFillChange}
      />
      <form onSubmit={formHandleSubmit(onValidSubmit)} className="space-y-4">
        <EntryFormWordRow
          word={word}
          onWordChange={(v) => setValue("word", v)}
          onLoadOptions={loadOptions}
          onAiFill={handleAiFill}
          aiLoading={aiLoading}
        />
        <FormRow label="音标">
          <input
            type="text"
            className="input input-bordered input-sm flex-1 min-w-0"
            placeholder="/ˈeksəmpəl/"
            {...form.register("phonetic")}
          />
        </FormRow>
        <EntryFormMnemonicSection
          mnemonic={mnemonic}
          onMnemonicChange={(v) => setValue("mnemonic", v)}
        />
        <EntryFormCollocationsSection
          collocations={collocations}
          onCollocationsChange={(v) => setValue("collocations", v)}
        />
        <EntryFormMeaningsSection
          meanings={meanings}
          onAddRow={addMeaningRow}
          onUpdate={updateMeaning}
          onAddItem={addMeaningItem}
          onRemoveItem={removeMeaningItem}
          onRemoveRow={removeMeaningRow}
        />
        {effectiveOptions ? (
          <EntryFormMorphemesSection
            options={effectiveOptions}
            prefixIds={prefixIds}
            onPrefixIdsChange={(v) => setValue("prefixIds", v)}
            suffixIds={suffixIds}
            onSuffixIdsChange={(v) => setValue("suffixIds", v)}
            rootId={rootId}
            onRootIdChange={(v) => setValue("rootId", v)}
            categoryId={categoryId}
            onCategoryIdChange={(v) => setValue("categoryId", v)}
            aiFilledPrefixes={aiFilledPrefixes}
            onAiFilledPrefixesChange={(v) => setValue("aiFilledPrefixes", v)}
            aiFilledSuffixes={aiFilledSuffixes}
            onAiFilledSuffixesChange={(v) => setValue("aiFilledSuffixes", v)}
            aiFilledRoot={aiFilledRoot}
            onAiFilledRootChange={(v) => setValue("aiFilledRoot", v)}
          />
        ) : (
          <p className="text-sm text-base-content/50">加载选项中…</p>
        )}
        <EntryFormActions
          loading={loading}
          isEdit={entryId != null}
          onCancel={onCancel}
        />
      </form>
    </div>
  );
}
