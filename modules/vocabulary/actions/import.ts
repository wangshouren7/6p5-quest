"use server";

import { db } from "@/modules/db/client";
import type { IVocabularyEntryFormData } from "@/modules/vocabulary/core";
import { DEFAULT_AI_MODEL } from "./constants";
import { createVocabularyEntry } from "./crud";
import type { IVocabularyAiConfig } from "./types";

/** 创建词汇导入任务（一单词一条 Task）；可选写入 AI 配置到 VocabularyAiSettings */
export async function createVocabularyImportTasks(
  words: string[],
  aiConfig?: IVocabularyAiConfig,
): Promise<{ ok: true; count: number } | { error: string }> {
  const list = [
    ...new Set(
      words
        .filter((w) => typeof w === "string" && w.trim().length > 0)
        .map((w) => (w as string).trim()),
    ),
  ];
  if (list.length === 0) return { error: "单词列表为空" };

  if (aiConfig) {
    const baseUrl =
      typeof aiConfig.baseUrl === "string" && aiConfig.baseUrl.trim()
        ? aiConfig.baseUrl.trim().replace(/\/$/, "")
        : "https://api.openai.com/v1";
    const accessToken =
      typeof aiConfig.accessToken === "string" && aiConfig.accessToken.trim()
        ? aiConfig.accessToken.trim()
        : "";
    const model =
      typeof aiConfig.model === "string" && aiConfig.model.trim()
        ? aiConfig.model.trim()
        : DEFAULT_AI_MODEL;
    const existing = await db.vocabularyAiSettings.findFirst({
      orderBy: { id: "asc" },
    });
    if (existing) {
      await db.vocabularyAiSettings.update({
        where: { id: existing.id },
        data: { baseUrl, accessToken, model, updatedAt: new Date() },
      });
    } else {
      await db.vocabularyAiSettings.create({
        data: { baseUrl, accessToken, model },
      });
    }
  }

  await db.vocabularyAiFillTask.createMany({
    data: list.map((word) => ({
      word,
      status: "PENDING",
    })),
  });
  return { ok: true, count: list.length };
}

/** 获取当前 AI 回填任务列表（无过滤，最近 200 条） */
export async function getVocabularyImportTasks(): Promise<{
  tasks: Array<{
    id: number;
    word: string;
    status: string;
    error: string | null;
    createdAt: Date;
  }>;
}> {
  const rows = await db.vocabularyAiFillTask.findMany({
    orderBy: { id: "desc" },
    take: 200,
    select: {
      id: true,
      word: true,
      status: true,
      error: true,
      createdAt: true,
    },
  });
  return {
    tasks: rows.map((r) => ({
      id: r.id,
      word: r.word,
      status: r.status,
      error: r.error,
      createdAt: r.createdAt,
    })),
  };
}

/** 批量创建词条（一键保存）；与 AI 回填 Task 无关 */
export async function createVocabularyEntriesBatch(
  entries: IVocabularyEntryFormData[],
): Promise<{ ok: true; saved: number; errors: string[] } | { error: string }> {
  if (!Array.isArray(entries) || entries.length === 0) {
    return { error: "条目列表为空" };
  }
  const errors: string[] = [];
  let saved = 0;
  for (const data of entries) {
    const result = await createVocabularyEntry(data);
    if ("id" in result) saved++;
    else errors.push(`${data.word?.trim() ?? "?"}: ${result.error}`);
  }
  return { ok: true, saved, errors };
}

/** 按单词列表批量更新分类（用于批量导入后统一设置分类；categoryId 为 null 则清空） */
export async function updateVocabularyEntriesCategoryByWords(
  words: string[],
  categoryId: number | null,
): Promise<{ ok: true; updated: number } | { error: string }> {
  if (!Array.isArray(words) || words.length === 0) {
    return { error: "单词列表为空" };
  }
  const wordLowers = [
    ...new Set(
      words
        .filter((w) => typeof w === "string" && w.trim())
        .map((w) => w.trim().toLowerCase()),
    ),
  ];
  if (wordLowers.length === 0) return { ok: true, updated: 0 };
  const result = await db.vocabularyEntry.updateMany({
    where: { wordLower: { in: wordLowers } },
    data: { categoryId },
  });
  return { ok: true, updated: result.count };
}
