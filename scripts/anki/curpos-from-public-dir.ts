/**
 * Seed: sync corpus from public/listen/corpus into DB (CorpusChapter, CorpusTest, CorpusWord).
 * Run via: npx prisma db seed  or  pnpm run sync-corpus
 * 需要配置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN。
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { writeCorpusWord } from "./util";

const CORPUS_BASE = path.join(
  process.cwd(),
  "public",
  "listen",
  "corpus",
  "chapters",
);

async function main() {
  const chaptersJsonPath = path.join(CORPUS_BASE, "chapters.json");
  const raw = await fs.readFile(chaptersJsonPath, "utf-8");
  const chapters = JSON.parse(raw) as Array<{
    id: number;
    title: string;
    testCount: number;
  }>;

  for (const ch of chapters) {
    for (let testId = 1; testId <= ch.testCount; testId++) {
      const wordsPath = path.join(
        CORPUS_BASE,
        String(ch.id),
        "tests",
        String(testId),
        "words.json",
      );
      let wordsRaw: string;
      try {
        wordsRaw = await fs.readFile(wordsPath, "utf-8");
      } catch {
        continue;
      }

      const words = JSON.parse(wordsRaw) as Array<{
        word: string;
        phonetic?: string;
        meaning: string;
      }>;

      await writeCorpusWord(ch.id, testId, words);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
