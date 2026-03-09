/** 单词比较用：trim + toLowerCase，供 vocabulary / corpus 统一使用 */
export function normalizeWord(w: string): string {
  return w.trim().toLowerCase();
}

/** 音标展示用：去掉首尾斜杠，如 /ˈwɜːrd/ -> ˈwɜːrd */
export function formatPhonetic(phonetic: string): string {
  return phonetic.replace(/^\/|\/$/g, "");
}
