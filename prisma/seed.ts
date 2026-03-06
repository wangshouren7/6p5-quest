/**
 * Seed: sync corpus from public/listen/corpus into DB (CorpusChapter, CorpusTest, CorpusWord).
 * Run via: npx prisma db seed  or  pnpm run sync-corpus
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../modules/db/generated/client";

const dbUrl = process.env["DATABASE_URL"]?.startsWith("file:")
  ? process.env["DATABASE_URL"]
  : `file:${path.join(process.cwd(), "prisma", "dev.db")}`;
const db = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: dbUrl }),
});

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
    await db.corpusChapter.upsert({
      where: { id: ch.id },
      create: { id: ch.id, title: ch.title },
      update: { title: ch.title },
    });

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

      const test = await db.corpusTest.upsert({
        where: {
          chapterId_testIndex: { chapterId: ch.id, testIndex: testId },
        },
        create: {
          chapterId: ch.id,
          testIndex: testId,
        },
        update: {},
      });

      const words = JSON.parse(wordsRaw) as Array<{
        word: string;
        phonetic?: string;
        meaning: string;
      }>;
      const audioPathBase = `/listen/corpus/chapters/${ch.id}/tests/${testId}/audio`;

      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        await db.corpusWord.upsert({
          where: {
            testId_index: { testId: test.id, index: i },
          },
          create: {
            testId: test.id,
            index: i,
            word: w.word,
            phonetic: w.phonetic ?? null,
            meaning: w.meaning,
            audioPath: `${audioPathBase}/${i}.wav`,
          },
          update: {
            word: w.word,
            phonetic: w.phonetic ?? null,
            meaning: w.meaning,
            audioPath: `${audioPathBase}/${i}.wav`,
          },
        });
      }
    }
  }

  console.log(
    "Corpus seed done: chapters and words synced from public/listen/corpus",
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
