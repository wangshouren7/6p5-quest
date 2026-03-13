import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const outputDir = path.join(process.cwd(), "anki-output", "curpos");
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function writeCorpusWord(
  chapterId: number,
  testId: number,
  words: Array<{
    word: string;
    phonetic?: string;
    meaning: string;
  }>,
) {
  const lines = words.map((w) => {
    const meaningHtml = w.meaning
      ? `<span class="meaning-text">${escapeHtml(w.meaning)}</span>`
      : "";
    const phoneticHtml = w.phonetic
      ? `<span class="phonetic-text">${escapeHtml(w.phonetic)}</span>`
      : "";
    const tag = `语料库-ch${chapterId}-test${testId}`;

    const parts = [w.word, meaningHtml, phoneticHtml, tag];

    return parts.join("|");
  });

  writeFileSync(
    path.join(outputDir, `${chapterId}-${testId}.txt`),
    lines.join("\n"),
  );
}
