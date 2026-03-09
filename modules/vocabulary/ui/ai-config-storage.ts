import type { VocabularyAiConfig } from "../core/ai-config";
import {
    DEFAULT_VOCABULARY_AI_CONFIG,
    VOCABULARY_AI_CONFIG_KEY,
} from "../core/ai-config";

/** 从 localStorage 读取词汇 AI 配置（供录入页 AI 补全使用） */
export function getStoredVocabularyAiConfig(): VocabularyAiConfig {
  if (typeof window === "undefined") return DEFAULT_VOCABULARY_AI_CONFIG;
  try {
    const raw = localStorage.getItem(VOCABULARY_AI_CONFIG_KEY);
    if (!raw) return DEFAULT_VOCABULARY_AI_CONFIG;
    const parsed = JSON.parse(raw) as Partial<VocabularyAiConfig>;
    return {
      baseUrl:
        typeof parsed.baseUrl === "string"
          ? parsed.baseUrl
          : DEFAULT_VOCABULARY_AI_CONFIG.baseUrl,
      accessToken:
        typeof parsed.accessToken === "string"
          ? parsed.accessToken
          : DEFAULT_VOCABULARY_AI_CONFIG.accessToken,
      model:
        typeof parsed.model === "string"
          ? parsed.model
          : DEFAULT_VOCABULARY_AI_CONFIG.model,
    };
  } catch {
    return DEFAULT_VOCABULARY_AI_CONFIG;
  }
}

export function saveVocabularyAiConfig(config: VocabularyAiConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(VOCABULARY_AI_CONFIG_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}
