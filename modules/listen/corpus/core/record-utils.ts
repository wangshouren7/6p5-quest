export function parseWrongIndices(value: unknown): number[] {
  if (Array.isArray(value))
    return value.filter((x): x is number => typeof x === "number");
  return [];
}

export function parseWrongWordStrings(value: unknown): string[] {
  if (Array.isArray(value))
    return value.filter((x): x is string => typeof x === "string");
  return [];
}

function normalizeWord(w: string): string {
  return w.trim().toLowerCase();
}

export interface ListenRecordForCount {
  wrongIndices: unknown;
  wrongWordStrings?: unknown;
}

/**
 * 根据多条听写记录统计每个单词被写错的次数。
 * @param records 听写记录（需包含 wrongIndices 或 wrongWordStrings）
 * @param words 当前 test 的单词列表（用于 wrongIndices 转成单词）
 * @returns 归一化单词 -> 错误次数的 Map
 */
export function computeWordErrorCounts(
  records: ListenRecordForCount[],
  words: { word: string }[],
): Map<string, number> {
  const count = new Map<string, number>();
  for (const record of records) {
    const wrongWords = new Set<string>();
    const strs = parseWrongWordStrings(record.wrongWordStrings);
    if (strs.length > 0) {
      strs.forEach((s) => wrongWords.add(normalizeWord(s)));
    } else {
      const indices = parseWrongIndices(record.wrongIndices);
      indices.forEach((i) => {
        if (i >= 0 && i < words.length)
          wrongWords.add(normalizeWord(words[i].word));
      });
    }
    wrongWords.forEach((w) => count.set(w, (count.get(w) ?? 0) + 1));
  }
  return count;
}
