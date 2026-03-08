const VOCABULARY_AI_CONFIG_KEY = "vocabulary-ai-config";

export interface VocabularyAiConfig {
  baseUrl: string;
  accessToken: string;
  model: string;
}

const defaultAiConfig: VocabularyAiConfig = {
  baseUrl: "https://api.openai.com/v1",
  accessToken: "",
  model: "gpt-4o-mini",
};

/** 从 localStorage 读取词汇 AI 配置（供录入页 AI 补全使用） */
export function getStoredVocabularyAiConfig(): VocabularyAiConfig {
  if (typeof window === "undefined") return defaultAiConfig;
  try {
    const raw = localStorage.getItem(VOCABULARY_AI_CONFIG_KEY);
    if (!raw) return defaultAiConfig;
    const parsed = JSON.parse(raw) as Partial<VocabularyAiConfig>;
    return {
      baseUrl:
        typeof parsed.baseUrl === "string"
          ? parsed.baseUrl
          : defaultAiConfig.baseUrl,
      accessToken:
        typeof parsed.accessToken === "string"
          ? parsed.accessToken
          : defaultAiConfig.accessToken,
      model:
        typeof parsed.model === "string" ? parsed.model : defaultAiConfig.model,
    };
  } catch {
    return defaultAiConfig;
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
