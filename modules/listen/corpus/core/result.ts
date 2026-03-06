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
      w.word.trim().toLowerCase() !==
      (userAnswers[i] ?? "").trim().toLowerCase()
        ? i
        : -1,
    )
    .filter((i) => i >= 0);
  const wrongWordStrings = wrongIndices.map((i) =>
    words[i].word.trim().toLowerCase(),
  );
  const correctCount = words.length - wrongIndices.length;
  return { correctCount, wrongIndices, wrongWordStrings };
}
