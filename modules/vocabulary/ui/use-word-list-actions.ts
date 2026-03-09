"use client";

import { useCallback } from "react";
import { deleteVocabularyEntry, getVocabularyEntryById } from "../actions";
import type {
    IVocabularyEntryFormData,
    IVocabularyEntryListItem,
} from "../core";
import { useVocabulary } from "./context";

export interface UseWordListActionsReturn {
  deleteEntry: (
    e: React.MouseEvent,
    id: number,
    onSuccess?: () => void,
    onError?: (msg: string) => void,
  ) => Promise<void>;
  fetchEntryById: (
    entry: IVocabularyEntryListItem,
    onSuccess: (data: IVocabularyEntryFormData) => void,
    onError?: (msg: string) => void,
  ) => Promise<void>;
  refresh: () => Promise<void>;
  setFormError: (msg: string | null) => void;
}

export function useWordListActions(): UseWordListActionsReturn {
  const { vocabulary } = useVocabulary();

  const refresh = useCallback(
    () => vocabulary.data.handleRefresh(),
    [vocabulary],
  );
  const setFormError = useCallback(
    (msg: string | null) => vocabulary.data.setFormError(msg),
    [vocabulary],
  );

  const fetchEntryById = useCallback(
    async (
      entry: IVocabularyEntryListItem,
      onSuccess: (data: IVocabularyEntryFormData) => void,
      onError?: (msg: string) => void,
    ) => {
      const full = await getVocabularyEntryById(entry.id);
      if (!full) {
        onError?.("无法加载该单词");
        return;
      }
      const data: IVocabularyEntryFormData = {
        word: full.word,
        phonetic: full.phonetic ?? "",
        mnemonic: full.mnemonic ?? "",
        meanings: full.meanings,
        prefixIds: full.prefixIds ?? [],
        suffixIds: full.suffixIds ?? [],
        rootId: full.rootId ?? null,
        categoryId: full.categoryId,
        collocations: full.collocations ?? [],
      };
      onSuccess(data);
    },
    [],
  );

  const deleteEntry = useCallback(
    async (
      e: React.MouseEvent,
      id: number,
      onSuccess?: () => void,
      onError?: (msg: string) => void,
    ) => {
      e.stopPropagation();
      if (!confirm("确定要删除该单词吗？")) return;
      try {
        const result = await deleteVocabularyEntry(id);
        if ("error" in result) {
          onError?.(result.error);
        } else {
          onSuccess?.();
        }
      } finally {
        // callers may set loading to false in finally
      }
    },
    [],
  );

  return {
    deleteEntry,
    fetchEntryById,
    refresh,
    setFormError,
  };
}
