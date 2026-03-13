/**
 * 从 scripts/words 目录下的 .json 文件生成 Anki 可导入的 txt（制表符分隔，多字段）。
 * 运行：pnpm run anki-words [路径]
 * 路径可为单个 json 文件或目录（目录下所有 .json）；默认 scripts/words/1/1.json
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { escapeHtml } from "./util";

const SEP = "\t";
const FIELDS = [
  "单词",
  "音标",
  "词义",
  "例句英文",
  "例句中文",
  "搭配简",
  "搭配详",
  "笔记简",
  "笔记详",
  "记忆",
  "标签",
] as const;

type WordEntry = {
  word: string;
  phonetic?: string;
  meaning?: string;
  exampleEn?: string;
  exampleCn?: string;
  collocations?: Array<{ collocation?: string; meaning?: string }>;
  notes?: Array<{ word?: string; phonetic?: string; meaning?: string }>;
  remember?: string;
};

function buildRow(entry: WordEntry, tag: string): string {
  const 单词 = entry.word ?? "";
  const 音标 =
    entry.phonetic != null && entry.phonetic !== ""
      ? `<span class="phonetic-text">${escapeHtml(entry.phonetic)}</span>`
      : "";
  const 词义 =
    entry.meaning != null && entry.meaning !== ""
      ? `<span class="meaning-text">${escapeHtml(entry.meaning)}</span>`
      : "";
  const 例句英文 = entry.exampleEn != null ? escapeHtml(entry.exampleEn) : "";
  const 例句中文 = entry.exampleCn != null ? escapeHtml(entry.exampleCn) : "";

  const collocations = entry.collocations ?? [];
  const 搭配简 =
    collocations.length === 0
      ? ""
      : `<ul class="collocation-list">${collocations
          .map(
            (c) =>
              `<li>${c.collocation != null ? escapeHtml(c.collocation) : ""}</li>`,
          )
          .join("")}</ul>`;
  const 搭配详 =
    collocations.length === 0
      ? ""
      : `<ul class="collocation-list">${collocations
          .map((c) => {
            const col = c.collocation != null ? escapeHtml(c.collocation) : "";
            const mean = c.meaning != null ? escapeHtml(c.meaning) : "";
            return `<li>${col}${mean ? ` — ${mean}` : ""}</li>`;
          })
          .join("")}</ul>`;

  const notes = entry.notes ?? [];
  const 笔记简 =
    notes.length === 0
      ? ""
      : `<ul class="notes-list">${notes
          .map((n) => `<li>${n.word != null ? escapeHtml(n.word) : ""}</li>`)
          .join("")}</ul>`;
  const 笔记详 =
    notes.length === 0
      ? ""
      : `<ul class="notes-list">${notes
          .map((n) => {
            const w = n.word != null ? escapeHtml(n.word) : "";
            const p = n.phonetic != null ? escapeHtml(n.phonetic) : "";
            const m = n.meaning != null ? escapeHtml(n.meaning) : "";
            const parts = [w, p, m].filter(Boolean);
            return `<li>${parts.join(" — ")}</li>`;
          })
          .join("")}</ul>`;

  const 记忆 = entry.remember != null ? escapeHtml(entry.remember) : "";

  const parts = [
    单词,
    音标,
    词义,
    例句英文,
    例句中文,
    搭配简,
    搭配详,
    笔记简,
    笔记详,
    记忆,
    tag,
  ];
  return parts.join(SEP);
}

function collectJsonFiles(inputPath: string): string[] {
  const resolved = path.resolve(process.cwd(), inputPath);
  if (!existsSync(resolved)) return [];
  const stat = statSync(resolved);
  if (stat.isFile()) return resolved.endsWith(".json") ? [resolved] : [];
  return readdirSync(resolved)
    .filter((f) => f.endsWith(".json"))
    .map((f) => path.join(resolved, f));
}

function main() {
  const input = process.argv[2] ?? path.join("scripts", "words", "1", "1.json");
  const files = collectJsonFiles(input);
  if (files.length === 0) {
    console.error(
      "未找到 JSON 文件，请指定文件或目录：pnpm run anki-words <路径>",
    );
    process.exit(1);
  }

  const outputDir = path.join(process.cwd(), "anki-output", "words");
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  const header = FIELDS.join(SEP);
  for (const filePath of files) {
    const raw = readFileSync(filePath, "utf-8");
    let items: WordEntry[];
    try {
      items = JSON.parse(raw) as WordEntry[];
    } catch (e) {
      console.error(`解析失败 ${filePath}:`, e);
      continue;
    }
    if (!Array.isArray(items)) {
      console.error(`非数组 ${filePath}`);
      continue;
    }
    const baseName = path.basename(filePath, ".json");
    const tag = `words-${baseName}`;
    const lines = [header, ...items.map((item) => buildRow(item, tag))];
    const outPath = path.join(outputDir, `${baseName}.txt`);
    writeFileSync(outPath, lines.join("\n"), "utf-8");
    console.log(`已写入 ${outPath}，共 ${items.length} 张卡`);
  }
}

main();
