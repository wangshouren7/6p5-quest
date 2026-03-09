import { normalizeWord } from "@/utils/string";
import type { WordItem } from "./types";

export interface ComputeResultReturn {
  correctCount: number;
  wrongIndices: number[];
  wrongWordStrings: string[];
}

export function computeResult(
  words: WordItem[],
  userAnswers: string[],
): ComputeResultReturn {
  const wrongIndices = words
    .map((w, i) =>
      normalizeWord(w.word) !== normalizeWord(userAnswers[i] ?? "") ? i : -1,
    )
    .filter((i) => i >= 0);
  const wrongWordStrings = wrongIndices.map((i) =>
    normalizeWord(words[i].word),
  );
  const correctCount = words.length - wrongIndices.length;
  return { correctCount, wrongIndices, wrongWordStrings };
}
