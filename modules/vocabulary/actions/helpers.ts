import type {
    ICollocationItem,
    IPartOfSpeechMeaning,
} from "@/modules/vocabulary/core";

export function parseMeaningsJson(raw: string | null): IPartOfSpeechMeaning[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a.filter(
      (x): x is IPartOfSpeechMeaning =>
        typeof x === "object" &&
        x != null &&
        "partOfSpeech" in x &&
        "meanings" in x &&
        Array.isArray((x as IPartOfSpeechMeaning).meanings),
    ) as IPartOfSpeechMeaning[];
  } catch {
    return [];
  }
}

/** 是否已有有效释义（非占位）：至少一条 partOfSpeechMeaning 下存在非空释义字符串 */
export function hasValidMeanings(meanings: IPartOfSpeechMeaning[]): boolean {
  if (!meanings?.length) return false;
  return meanings.some(
    (m) =>
      Array.isArray(m.meanings) &&
      m.meanings.some((s) => typeof s === "string" && s.trim() !== ""),
  );
}

export function parseCollocationsJson(raw: string | null): ICollocationItem[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    if (!Array.isArray(a)) return [];
    return a
      .map((x): ICollocationItem | null => {
        if (typeof x === "string" && x.trim() !== "")
          return { phrase: x.trim(), meaning: "" };
        if (
          typeof x === "object" &&
          x != null &&
          "phrase" in x &&
          typeof (x as ICollocationItem).phrase === "string"
        ) {
          const o = x as ICollocationItem;
          return o.phrase.trim() !== ""
            ? {
                phrase: o.phrase.trim(),
                meaning: String(o.meaning ?? "").trim(),
              }
            : null;
        }
        return null;
      })
      .filter((item): item is ICollocationItem => item != null);
  } catch {
    return [];
  }
}

export function parseMorphemeMeaningsJson(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const a = JSON.parse(raw) as unknown;
    return Array.isArray(a)
      ? a.filter((x): x is string => typeof x === "string")
      : [];
  } catch {
    return [];
  }
}

/** 词素文本统一格式：去掉首尾的连字符 -，如 hydro- / -sphere -> hydro / sphere */
export function normalizeMorphemeText(s: string): string {
  return s.trim().replace(/^-+|-+$/g, "");
}
