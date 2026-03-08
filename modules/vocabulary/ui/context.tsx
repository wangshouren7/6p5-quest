"use client";

import { createContext, useContext } from "react";
import type { IVocabulary } from "../core";

export const VocabularyContext = createContext<IVocabulary | null>(null);

export function useVocabulary(): IVocabulary {
  const value = useContext(VocabularyContext);
  if (value == null) {
    throw new Error(
      "useVocabulary must be used within VocabularyContext.Provider",
    );
  }
  return value;
}

/** 在 Provider 外使用时返回 null（如 Import 页的 EntryForm） */
export function useVocabularyOptional(): IVocabulary | null {
  return useContext(VocabularyContext);
}
