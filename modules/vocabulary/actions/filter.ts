"use server";

import { db } from "@/modules/db/client";
import type { VocabularyEntryWhereInput } from "@/modules/db/generated/models/VocabularyEntry";
import type {
    ICollocationItem,
    IMorphemeItem,
    IPartOfSpeechMeaning,
    IVocabularyFilter,
    IVocabularyFilterOptions,
} from "@/modules/vocabulary/core";
import { normalizeWord } from "@/utils/string";
import {
    normalizeMorphemeText,
    parseCollocationsJson,
    parseMeaningsJson,
    parseMorphemeMeaningsJson,
} from "./helpers";

/** 获取筛选选项：词性、前缀、后缀、词根、分类 */
export async function getVocabularyFilterOptions(): Promise<IVocabularyFilterOptions> {
  const [categories, morphemes, posRows] = await Promise.all([
    db.vocabularyCategory.findMany({ orderBy: { id: "asc" } }),
    db.vocabularyMorpheme.findMany({
      orderBy: [{ type: "asc" }, { text: "asc" }],
    }),
    db.vocabularyEntryPartOfSpeech.findMany({
      select: { partOfSpeech: true },
      distinct: ["partOfSpeech"],
    }),
  ]);

  const prefixes = morphemes.filter((m) => m.type === "prefix");
  const suffixes = morphemes.filter((m) => m.type === "suffix");
  const roots = morphemes.filter((m) => m.type === "root");

  return {
    partsOfSpeech: [...new Set(posRows.map((r) => r.partOfSpeech))].sort(),
    prefixes: prefixes.map((m) => ({
      id: m.id,
      text: normalizeMorphemeText(m.text),
      meanings: parseMorphemeMeaningsJson(m.meanings),
    })),
    suffixes: suffixes.map((m) => ({
      id: m.id,
      text: normalizeMorphemeText(m.text),
      meanings: parseMorphemeMeaningsJson(m.meanings),
    })),
    roots: roots.map((m) => ({
      id: m.id,
      text: normalizeMorphemeText(m.text),
      meanings: parseMorphemeMeaningsJson(m.meanings),
    })),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
  };
}

/** 按条件筛选单词列表（分页） */
export async function getVocabularyEntries(
  filter: IVocabularyFilter,
  options: { page?: number; pageSize?: number } = {},
): Promise<{
  items: Array<{
    id: number;
    word: string;
    wordLower: string;
    phonetic: string | null;
    mnemonic: string | null;
    categoryId: number | null;
    categoryName: string | null;
    meanings: IPartOfSpeechMeaning[];
    prefixes: IMorphemeItem[];
    suffixes: IMorphemeItem[];
    root: IMorphemeItem | null;
    collocations: ICollocationItem[];
    forgetCount: number;
    createdAt: Date;
    updatedAt: Date;
  }>;
  total: number;
}> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, options.pageSize ?? 200));

  const where: VocabularyEntryWhereInput = {};

  const wordQuery = filter.word?.trim();
  if (wordQuery) {
    const normalized = normalizeWord(wordQuery);
    if (normalized) {
      where.wordLower = { contains: normalized };
    }
  }

  if (filter.partOfSpeech?.length) {
    where.partsOfSpeech = {
      some: { partOfSpeech: { in: filter.partOfSpeech } },
    };
  }
  if (filter.categoryIds?.length) {
    where.categoryId = { in: filter.categoryIds };
  }
  if (filter.createdAtFrom ?? filter.createdAtTo) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (filter.createdAtFrom) {
      createdAt.gte = new Date(`${filter.createdAtFrom}T00:00:00.000Z`);
    }
    if (filter.createdAtTo) {
      createdAt.lte = new Date(`${filter.createdAtTo}T23:59:59.999Z`);
    }
    where.createdAt = createdAt;
  }
  const forgetCountMin = filter.forgetCountMin != null && filter.forgetCountMin >= 0 ? filter.forgetCountMin : undefined;
  const forgetCountMax = filter.forgetCountMax != null && filter.forgetCountMax >= 0 ? filter.forgetCountMax : undefined;
  if (forgetCountMin != null || forgetCountMax != null) {
    where.forgetCount = {
      ...(forgetCountMin != null && { gte: forgetCountMin }),
      ...(forgetCountMax != null && { lte: forgetCountMax }),
    };
  }
  if (
    filter.prefixIds?.length ||
    filter.suffixIds?.length ||
    filter.rootIds?.length
  ) {
    const and: Array<Record<string, unknown>> = [];
    if (filter.prefixIds?.length) {
      and.push({
        morphemes: {
          some: {
            morphemeId: { in: filter.prefixIds },
            role: "prefix",
          },
        },
      });
    }
    if (filter.suffixIds?.length) {
      and.push({
        morphemes: {
          some: {
            morphemeId: { in: filter.suffixIds },
            role: "suffix",
          },
        },
      });
    }
    if (filter.rootIds?.length) {
      and.push({
        morphemes: {
          some: {
            morphemeId: { in: filter.rootIds },
            role: "root",
          },
        },
      });
    }
    if (and.length) where.AND = and;
  }

  const [items, total] = await Promise.all([
    db.vocabularyEntry.findMany({
      where,
      include: {
        category: { select: { name: true } },
        morphemes: { include: { morpheme: true } },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.vocabularyEntry.count({ where }),
  ]);

  const result = items.map((e) => {
    const prefixRels = e.morphemes.filter((r) => r.role === "prefix");
    const suffixRels = e.morphemes.filter((r) => r.role === "suffix");
    const rootRel = e.morphemes.find((r) => r.role === "root");

    return {
      id: e.id,
      word: e.word,
      wordLower: e.wordLower,
      phonetic: e.phonetic,
      mnemonic: e.mnemonic ?? null,
      categoryId: e.categoryId,
      categoryName: e.category?.name ?? null,
      meanings: parseMeaningsJson(e.meanings),
      prefixes: prefixRels.map((r) => ({
        text: normalizeMorphemeText(r.morpheme.text),
        meanings: parseMorphemeMeaningsJson(r.morpheme.meanings),
      })),
      suffixes: suffixRels.map((r) => ({
        text: normalizeMorphemeText(r.morpheme.text),
        meanings: parseMorphemeMeaningsJson(r.morpheme.meanings),
      })),
      root: rootRel
        ? {
            text: normalizeMorphemeText(rootRel.morpheme.text),
            meanings: parseMorphemeMeaningsJson(rootRel.morpheme.meanings),
          }
        : null,
      collocations: parseCollocationsJson(e.collocations),
      forgetCount: e.forgetCount ?? 0,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    };
  });

  return { items: result, total };
}
