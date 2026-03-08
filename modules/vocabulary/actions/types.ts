/** 词汇 AI 配置（供后台回填使用），可选传入以写入 DB */
export type IVocabularyAiConfig = {
  baseUrl?: string;
  accessToken?: string;
  model?: string;
};
