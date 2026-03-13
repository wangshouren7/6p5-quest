import { PrismaLibSql } from "@prisma/adapter-libsql";

import { config } from "dotenv";

import "dotenv/config";

import { existsSync, mkdirSync, writeFileSync } from "node:fs";

import path from "node:path";
import { PrismaClient } from "../../modules/db/generated/client";

config({ path: ".env.local" }); // Vercel env pull 常写入 .env.local

const tursoUrl = process.env["TURSO_DATABASE_URL"]?.trim();

const tursoToken = process.env["TURSO_AUTH_TOKEN"];

if (!tursoUrl || !tursoToken) {
  throw new Error("请设置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN");
}

const db = new PrismaClient({
  adapter: new PrismaLibSql({ url: tursoUrl, authToken: tursoToken }),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const outputDir = path.join(process.cwd(), "anki-output", "curpos");
if (!existsSync(outputDir)) {
  mkdirSync(outputDir, { recursive: true });
}

async function main() {
  const tests = await db.corpusTest.findMany({});

  for (const test of tests) {
    const words = await db.corpusWord.findMany({
      where: {
        testId: test.id,
      },
    });

    const lines = words.map((w) => {
      const meaningHtml = w.meaning
        ? `<span class="meaning-text">${escapeHtml(w.meaning)}</span>`
        : "";
      const phoneticHtml = w.phonetic
        ? `<span class="phonetic-text">${escapeHtml(w.phonetic)}</span>`
        : "";
      const tag = `语料库-ch${test.chapterId}-test${test.testIndex + 1}`;

      const parts = [w.word, meaningHtml, phoneticHtml, tag];

      return parts.join("|");
    });

    writeFileSync(
      path.join(outputDir, `${test.chapterId}-${test.testIndex + 1}.txt`),
      lines.join("\n"),
    );
  }
}

main()
  .then(() => process.exit(0))

  .catch((e) => {
    console.error(e);

    process.exit(1);
  });
