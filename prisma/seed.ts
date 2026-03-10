/**
 * Seed: sync corpus from public/listen/corpus into DB (CorpusChapter, CorpusTest, CorpusWord).
 * Run via: npx prisma db seed  or  pnpm run sync-corpus
 * 需要配置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN。
 */
import { PrismaLibSql } from "@prisma/adapter-libsql";
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../modules/db/generated/client";

const tursoUrl = process.env["TURSO_DATABASE_URL"]?.trim();
const tursoToken = process.env["TURSO_AUTH_TOKEN"];
if (!tursoUrl) {
  throw new Error(
    "Seed 需要 Turso。请在 .env 中设置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN。",
  );
}

const db = new PrismaClient({
  adapter: new PrismaLibSql({ url: tursoUrl, authToken: tursoToken ?? "" }),
});

const CORPUS_BASE = path.join(
  process.cwd(),
  "public",
  "listen",
  "corpus",
  "chapters",
);

const VOCABULARY_CATEGORY_NAMES = [
  "自然地理",
  "植物研究",
  "动物保护",
  "太空探索",
  "学校教育",
  "科技发明",
  "文化历史",
  "语言演化",
  "娱乐运动",
  "物品材料",
  "时尚潮流",
  "饮食健康",
  "建筑场所",
  "交通旅行",
  "国家政府",
  "社会经济",
  "法律法规",
  "沙场争锋",
  "社会角色",
  "行为动作",
  "身心健康",
  "时间日期",
];

async function main() {
  // Seed VocabularyCategory (22 categories) — only if client was generated with vocabulary models
  if (
    "vocabularyCategory" in db &&
    typeof (
      db as {
        vocabularyCategory?: { upsert: (args: unknown) => Promise<unknown> };
      }
    ).vocabularyCategory?.upsert === "function"
  ) {
    for (const name of VOCABULARY_CATEGORY_NAMES) {
      await (
        db as {
          vocabularyCategory: { upsert: (args: unknown) => Promise<unknown> };
        }
      ).vocabularyCategory.upsert({
        where: { name },
        create: { name },
        update: {},
      });
    }
    console.log("Vocabulary categories seeded: 22 categories");
  }

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
