/**
 * 图片 → 结构化输出 公共方法
 * 根据本地图片路径与 Zod schema，调用兼容 OpenAI 的 Chat Completions API（如 OpenRouter）
 * 使用 response_format 约束模型按 schema 返回，并解析为类型安全结果。
 *
 * 注意：结构化输出要求根为 object，responseSchema 应为 z.object({ ... })。
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";

export type ExtractStructuredFromImageParams<T extends z.ZodType> = {
  /** 本地图片文件路径 */
  imagePath: string;
  /** 发给模型的文本指令 */
  prompt: string;
  /** 返回值结构的 Zod 定义（根须为 object），用于 response_format 与解析 */
  responseSchema: T;
  /** 传给 zodResponseFormat(schema, schemaName) 的 name */
  schemaName: string;
  /** Chat Completions 的 baseURL，如 https://openrouter.ai/api/v1 */
  apiBaseUrl: string;
  /** 模型 ID，如 openai/gpt-4o */
  model: string;
  /** API Key */
  apiKey: string;
};

function getMime(ext: string): string {
  const lower = ext.toLowerCase();
  if (lower === ".png") return "image/png";
  if (lower === ".jpg" || lower === ".jpeg") return "image/jpeg";
  if (lower === ".gif") return "image/gif";
  if (lower === ".webp") return "image/webp";
  return "image/png";
}

function readImageAsDataUrl(imagePath: string): string {
  const resolved = path.resolve(process.cwd(), imagePath);
  const ext = path.extname(resolved);
  const mime = getMime(ext);
  try {
    const buf = readFileSync(resolved);
    const base64 = buf.toString("base64");
    return `data:${mime};base64,${base64}`;
  } catch (e) {
    throw new Error(
      `读取图片失败: ${resolved} — ${e instanceof Error ? e.message : e}`,
    );
  }
}

function stripMarkdownCodeBlock(raw: string): string {
  let text = raw.trim();
  const codeBlockMatch = text.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }
  return text;
}

/**
 * 从图片中提取结构化数据：读图 → 调用视觉模型（带 response_format）→ 按 responseSchema 解析并返回。
 */
export async function extractStructuredFromImage<T extends z.ZodType>(
  params: ExtractStructuredFromImageParams<T>,
): Promise<z.infer<T>> {
  const {
    imagePath,
    prompt,
    responseSchema,
    schemaName,
    apiBaseUrl,
    model,
    apiKey,
  } = params;

  const dataUrl = readImageAsDataUrl(imagePath);

  const openai = new OpenAI({
    baseURL: apiBaseUrl,
    apiKey,
  });

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
    response_format: zodResponseFormat(responseSchema, schemaName),
  });

  const content = response.choices[0]?.message?.content;
  if (content == null || content === "") {
    throw new Error("模型未返回有效内容");
  }

  const text = stripMarkdownCodeBlock(content);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("模型返回内容无法解析为 JSON");
  }

  const result = responseSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `返回格式不符合 schema: ${result.error.flatten().formErrors.join("; ")}`,
    );
  }

  return result.data as z.infer<T>;
}
