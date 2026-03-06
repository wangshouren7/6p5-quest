"use client";

import { createContext, useContext } from "react";
import type { ICorpus } from "../core";

export const CorpusContext = createContext<ICorpus | null>(null);

export function useCorpus(): ICorpus {
  const value = useContext(CorpusContext);
  if (value == null) {
    throw new Error("useCorpus must be used within CorpusProvider");
  }
  return value;
}
