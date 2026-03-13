/**
 * 从词汇表图片中提取 word / phonetic / meaning 为 JSON（语料库用）。
 * 使用 OpenRouter 视觉模型（通过 openai 包 + baseURL）与 Zod 结构化输出。
 *
 * 用法:
 *   pnpm tsx scripts/extract-corpus-from-image.ts <图片路径|目录> [--output <文件路径>]
 *   dir 模式: 指定目录则扫描其下所有图片，为每张生成同名的 .json。
 * 环境变量:
 *   OPENROUTER_API_KEY  必填
 *   OPENROUTER_MODEL    可选，默认 openai/gpt-4o
 */

import { config } from "dotenv";
import { existsSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { extractStructuredFromImage } from "../utils/extract-structured-from-image";

config({ path: ".env.local" });

const OPENROUTER_BASE = "https://openrouter.ai/api/v1";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp"]);

const PROMPT = `这张图片是一张词汇表，每行/每格包含：英文单词、音标、中文释义。
请把图中所有词条提取出来，按 JSON 对象输出`;

/** 单条词汇的 Zod 规范 */
const wordItemSchema = z.object({
  word: z.string().describe("英文单词"),
  phonetic: z.string().describe("音标"),
  meaning: z.string().describe("中文释义"),
});

/** 结构化输出要求根为 object，故用 items 包装数组 */
const vocabListResponseSchema = z.object({
  items: z
    .array(wordItemSchema)
    .describe("从图片中识别出的词汇列表，每项含 word、phonetic、meaning"),
});

export type VocabItem = z.infer<typeof wordItemSchema>;

type ParsedArgs =
  | { mode: "file"; imagePath: string; outputPath: string | null }
  | { mode: "dir"; dirPath: string };

function parseArgs(): ParsedArgs {
  const args = process.argv.slice(2);
  const inputPath = args.find((a) => !a.startsWith("--"));
  const outIdx = args.indexOf("--output");
  const outputPath = outIdx >= 0 && args[outIdx + 1] ? args[outIdx + 1] : null;

  if (!inputPath) {
    console.error(
      "用法: pnpm tsx scripts/extract-corpus-from-image.ts <图片路径|目录> [--output <文件路径>]\n" +
        "  单文件: 指定图片路径，可选 --output；未指定则打印到 stdout。\n" +
        "  dir 模式: 指定目录路径，扫描目录下所有图片，为每张图片生成同名的 .json 文件。",
    );
    process.exit(1);
  }

  const resolved = path.resolve(process.cwd(), inputPath);
  try {
    const stat = statSync(resolved);
    if (stat.isDirectory()) {
      return { mode: "dir", dirPath: resolved };
    }
  } catch {
    // 当作文件路径
  }
  return { mode: "file", imagePath: inputPath, outputPath };
}

function getImagePaths(dirPath: string): string[] {
  const names = readdirSync(dirPath);
  return names
    .filter((name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase()))
    .map((name) => path.join(dirPath, name))
    .sort();
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    console.error(
      "请设置环境变量 OPENROUTER_API_KEY（可在 .env.local 中配置）",
    );
    process.exit(1);
  }

  const model = process.env.OPENROUTER_MODEL?.trim() || "openai/gpt-4o";
  const args = parseArgs();

  if (args.mode === "file") {
    const { imagePath, outputPath } = args;
    const result = await extractStructuredFromImage({
      imagePath,
      prompt: PROMPT,
      responseSchema: vocabListResponseSchema,
      schemaName: "vocab_list",
      apiBaseUrl: OPENROUTER_BASE,
      model,
      apiKey,
    });
    const items = result.items;
    const jsonStr = JSON.stringify(items, null, 2);
    if (outputPath) {
      const outResolved = path.resolve(process.cwd(), outputPath);
      writeFileSync(outResolved, jsonStr, "utf-8");
      console.log(`已写入 ${items.length} 条到 ${outResolved}`);
    } else {
      console.log(jsonStr);
    }
    return;
  }

  const { dirPath } = args;
  const imagePaths = getImagePaths(dirPath);
  if (imagePaths.length === 0) {
    console.error(`目录下没有图片: ${dirPath}`);
    process.exit(1);
  }
  console.log(`dir 模式: 共 ${imagePaths.length} 张图片`);
  for (const imagePath of imagePaths) {
    const baseName = path.basename(imagePath, path.extname(imagePath));
    const jsonPath = path.join(dirPath, `${baseName}.json`);
    if (existsSync(jsonPath)) {
      console.log(
        `${path.basename(imagePath)} -> ${path.basename(jsonPath)} (跳过，已存在)`,
      );
      continue;
    }
    try {
      const result = await extractStructuredFromImage({
        imagePath,
        prompt: PROMPT,
        responseSchema: vocabListResponseSchema,
        schemaName: "vocab_list",
        apiBaseUrl: OPENROUTER_BASE,
        model,
        apiKey,
      });
      writeFileSync(jsonPath, JSON.stringify(result.items, null, 2), "utf-8");
      console.log(
        `${path.basename(imagePath)} -> ${path.basename(jsonPath)} (${result.items.length} 条)`,
      );
    } catch (e) {
      console.error(`${imagePath}:`, e);
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
