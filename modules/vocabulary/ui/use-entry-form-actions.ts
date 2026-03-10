"use client";

import { useCallback } from "react";
import {
  aiFillVocabulary,
  createVocabularyEntry,
  getVocabularyFilterOptions,
  updateVocabularyEntry,
} from "../actions";
import type {
  IVocabularyAiFillResult,
  IVocabularyEntryFormData,
  IVocabularyFilterOptions,
  VocabularyAiConfig,
} from "../core";

export interface UseEntryFormActionsReturn {
  loadFilterOptions: () => Promise<IVocabularyFilterOptions | null>;
  runAiFill: (
    word: string,
    aiConfig: VocabularyAiConfig,
  ) => Promise<
    { ok: true; data: IVocabularyAiFillResult } | { ok: false; error: string }
  >;
  createEntry: (
    payload: IVocabularyEntryFormData,
  ) => Promise<{ id: number } | { error: string }>;
  updateEntry: (
    entryId: number,
    payload: IVocabularyEntryFormData,
  ) => Promise<{ id?: number; error?: string }>;
}

export function useEntryFormActions(): UseEntryFormActionsReturn {
  const loadFilterOptions = useCallback(
    async (): Promise<IVocabularyFilterOptions | null> =>
      getVocabularyFilterOptions(),
    [],
  );

  const runAiFill = useCallback(
    async (
      word: string,
      aiConfig: VocabularyAiConfig,
    ): Promise<
      { ok: true; data: IVocabularyAiFillResult } | { ok: false; error: string }
    > => {
      const result = await aiFillVocabulary(word.trim(), {
        baseUrl: aiConfig.baseUrl || undefined,
        accessToken: aiConfig.accessToken || undefined,
        model: aiConfig.model || undefined,
      });
      if ("error" in result) return { ok: false, error: result.error };
      return { ok: true, data: result as IVocabularyAiFillResult };
    },
    [],
  );

  const createEntry = useCallback(
    async (
      payload: IVocabularyEntryFormData,
    ): Promise<{ id: number } | { error: string }> =>
      createVocabularyEntry(payload),
    [],
  );

  const updateEntry = useCallback(
    async (
      entryId: number,
      payload: IVocabularyEntryFormData,
    ): Promise<{ id?: number; error?: string }> => {
      const result = await updateVocabularyEntry(entryId, payload);
      if ("error" in result) return { error: result.error };
      return { id: entryId };
    },
    [],
  );

  return {
    loadFilterOptions,
    runAiFill,
    createEntry,
    updateEntry,
  };
}
