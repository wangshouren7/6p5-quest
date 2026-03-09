/** localStorage key（读写实现在 UI 层 ai-config-storage） */
export const VOCABULARY_AI_CONFIG_KEY = "vocabulary-ai-config";

export interface VocabularyAiConfig {
  baseUrl: string;
  accessToken: string;
  model: string;
}

export const DEFAULT_VOCABULARY_AI_CONFIG: VocabularyAiConfig = {
  baseUrl: "https://api.openai.com/v1",
  accessToken: "",
  model: "gpt-4o-mini",
};
