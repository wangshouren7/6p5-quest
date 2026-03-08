/** 词性 (part of speech) 可选值，含可数/不可数；不含裸 n./v. 以免歧义 */
export const PARTS_OF_SPEECH = [
  "n.[C]",
  "n.[U]",
  "n.[C/U]",
  "vi.",
  "vt.",
  "adj.",
  "adv.",
  "pron.",
  "prep.",
  "conj.",
  "interj.",
  "art.",
  "num.",
  "aux.",
  "modal",
  "det.",
  "particle",
] as const;

export type PartOfSpeech = (typeof PARTS_OF_SPEECH)[number];

/** 默认词性（用于新词性行），取列表首项 */
export const DEFAULT_PART_OF_SPEECH = PARTS_OF_SPEECH[0];

/** 单词网格视图每行卡片数（与 corpus 网格一致） */
export const VOCABULARY_GRID_COLS = 4;

/** 批量导入时，分批表单回填每批请求的单词数量 */
export const VOCABULARY_BATCH_FILL_SIZE = 3;

/** 22 个词汇分类（与 VocabularyCategory seed 一致，供前端下拉与校验） */
export const VOCABULARY_CATEGORIES = [
  "自然地理",
  "植物研究",
  "动物保护",
  "太空探索",
  "学校教育",
  "科技发明",
  "文化历史",
  "语言演化",
  "娱乐运动",
  "物品材料",
  "时尚潮流",
  "饮食健康",
  "建筑场所",
  "交通旅行",
  "国家政府",
  "社会经济",
  "法律法规",
  "沙场争锋",
  "社会角色",
  "行为动作",
  "身心健康",
  "时间日期",
] as const;

export type VocabularyCategoryName = (typeof VOCABULARY_CATEGORIES)[number];

/** 语素类型：前缀 / 后缀 / 词根 */
export const MORPHEME_TYPES = ["prefix", "suffix", "root"] as const;
export type MorphemeType = (typeof MORPHEME_TYPES)[number];

export const MORPHEME_ROLES = ["prefix", "suffix", "root"] as const;
export type MorphemeRole = (typeof MORPHEME_ROLES)[number];

/** 词汇 AI 补全默认配置（与 Leva useControls 一致） */
export const DEFAULT_VOCABULARY_AI_CONTROLS = {
  baseUrl: "https://api.openai.com/v1",
  accessToken:
    "Ask-or-v1-561192548ad90bcce72a355f26a8e288a47c68793341280e24aeb1962b911bc1",
  model: "gpt-4o-mini",
} as const;
