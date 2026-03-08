"use client";

import { createContext, useContext } from "react";
import type { Vocabulary as VocabularyClass } from "../core";

export interface IVocabularyContextValue {
  vocabulary: VocabularyClass;
  aiConfig: { baseUrl: string; accessToken: string; model: string };
}

export const VocabularyContext = createContext<IVocabularyContextValue | null>(
  null,
);

export function useVocabulary(): IVocabularyContextValue {
  const value = useContext(VocabularyContext);
  if (value == null) {
    throw new Error(
      "useVocabulary must be used within VocabularyContext.Provider",
    );
  }
  return value;
}

/** 在 Provider 外使用时返回 null（如 Import 页的 EntryForm） */
export function useVocabularyOptional(): IVocabularyContextValue | null {
  return useContext(VocabularyContext);
}
