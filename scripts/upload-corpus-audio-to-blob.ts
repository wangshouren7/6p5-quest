/**
 * 一次性脚本：将 public/listen/corpus 下的 .wav 上传到 Vercel Blob，并把 DB 中 CorpusWord.audioPath 更新为 Blob URL。
 *
 * 前置条件：
 * 1. 在 Vercel 项目里创建 Blob Store（Storage → Create Database → Blob）。
 * 2. 本地拉取环境变量：vercel env pull（会得到 BLOB_READ_WRITE_TOKEN，通常写入 .env.local）。
 * 3. .env 或 .env.local 中已有 TURSO_DATABASE_URL、TURSO_AUTH_TOKEN、BLOB_READ_WRITE_TOKEN。
 *
 * 运行：pnpm run upload-corpus-audio  或  pnpm exec tsx scripts/upload-corpus-audio-to-blob.ts
 *
 * 重复运行：使用相同 pathname 且 allowOverwrite: true，会覆盖已有 blob，不会产生重复文件。
 * 说明：Turso 是数据库，适合存结构化数据和 URL；音频放在 Vercel Blob，Turso 只存 URL。
 */

import { PrismaLibSql } from "@prisma/adapter-libsql";
import { put } from "@vercel/blob";
import cliProgress from "cli-progress";
import { config } from "dotenv";
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "../modules/db/generated/client";
config({ path: ".env.local" }); // Vercel env pull 常写入 .env.local

const tursoUrl = process.env["TURSO_DATABASE_URL"]?.trim();
const tursoToken = process.env["TURSO_AUTH_TOKEN"];
const blobToken = process.env["BLOB_READ_WRITE_TOKEN"];

if (!tursoUrl || !tursoToken) {
  throw new Error("请设置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN");
}
if (!blobToken) {
  throw new Error(
    "请设置 BLOB_READ_WRITE_TOKEN（在 Vercel 项目创建 Blob Store 后，用 vercel env pull 拉取）",
  );
}

const db = new PrismaClient({
  adapter: new PrismaLibSql({ url: tursoUrl, authToken: tursoToken }),
});

const CORPUS_BASE = path.join(
  process.cwd(),
  "public",
  "listen",
  "corpus",
  "chapters",
);

/** 统计将要处理的文件总数（用于进度条） */
async function countTotalFiles(
  chapters: Array<{ id: number; testCount: number }>,
): Promise<number> {
  let total = 0;
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
      const words = JSON.parse(wordsRaw) as Array<unknown>;
      const test = await db.corpusTest.findFirst({
        where: { chapterId: ch.id, testIndex: testId },
        select: { _count: { select: { words: true } } },
      });
      if (test && test._count.words === words.length) {
        total += words.length;
      }
    }
  }
  return total;
}

async function main() {
  const chaptersJsonPath = path.join(CORPUS_BASE, "chapters.json");
  const raw = await fs.readFile(chaptersJsonPath, "utf-8");
  const chapters = JSON.parse(raw) as Array<{
    id: number;
    title: string;
    testCount: number;
  }>;

  const totalFiles = await countTotalFiles(chapters);
  console.log(`Total files to upload: ${totalFiles}\n`);

  const progressBar = new cliProgress.SingleBar(
    {
      format:
        "上传进度 |{bar}| {percentage}% | {value}/{total} 文件 | Ch.{chapter} T{test}",
      barCompleteChar: "█",
      barIncompleteChar: "░",
      hideCursor: true,
    },
    cliProgress.Presets.shades_classic,
  );
  progressBar.start(totalFiles, 0, { chapter: "-", test: "-" });

  let processed = 0;
  let uploaded = 0;
  let updated = 0;
  let skipped = 0;

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

      const words = JSON.parse(wordsRaw) as Array<unknown>;
      const test = await db.corpusTest.findFirst({
        where: {
          chapterId: ch.id,
          testIndex: testId,
        },
        include: { words: { orderBy: { index: "asc" } } },
      });
      if (!test || test.words.length !== words.length) {
        console.warn(
          `Skip chapter ${ch.id} test ${testId}: test not found or word count mismatch`,
        );
        continue;
      }

      for (let i = 0; i < words.length; i++) {
        const wordRow = test.words[i];
        if (wordRow?.audioPath?.startsWith("http")) {
          processed++;
          skipped++;
          progressBar.update(processed, {
            chapter: String(ch.id),
            test: String(testId),
          });
          continue;
        }

        const wavPath = path.join(
          CORPUS_BASE,
          String(ch.id),
          "tests",
          String(testId),
          "audio",
          `${i}.wav`,
        );
        let buf: Buffer;
        try {
          buf = await fs.readFile(wavPath);
        } catch (e) {
          console.warn(`\nSkip ${wavPath}: ${e}`);
          processed++;
          progressBar.update(processed, {
            chapter: String(ch.id),
            test: String(testId),
          });
          continue;
        }

        const pathname = `corpus/chapters/${ch.id}/tests/${testId}/audio/${i}.wav`;
        const blob = await put(pathname, buf, {
          access: "public",
          contentType: "audio/wav",
          token: blobToken,
          addRandomSuffix: false,
          allowOverwrite: true,
        });
        uploaded++;
        if (wordRow) {
          await db.corpusWord.update({
            where: { id: wordRow.id },
            data: { audioPath: blob.url },
          });
          updated++;
        }
        processed++;
        progressBar.update(processed, {
          chapter: String(ch.id),
          test: String(testId),
        });
      }
    }
  }

  progressBar.stop();
  console.log(
    `Done. Uploaded ${uploaded} blobs, updated ${updated} DB rows${skipped > 0 ? `, skipped ${skipped} (already had http URL)` : ""}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
