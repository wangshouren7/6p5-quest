/** 单词表 meanings JSON 中单条：词性 + 多条释义 */
export interface IPartOfSpeechMeaning {
  partOfSpeech: string;
  meanings: string[];
}

/** 表单/API 中的词性+释义列表 */
export type MeaningsInput = IPartOfSpeechMeaning[];

/** 语素（前缀/后缀/词根）简要：text + meanings 数组 */
export interface IMorphemeItem {
  text: string;
  meanings: string[];
}

/** 固定搭配：短语 + 中文意思 */
export interface ICollocationItem {
  phrase: string;
  meaning: string;
}

/** 筛选条件 */
export interface IVocabularyFilter {
  /** 单词关键词（模糊匹配，不区分大小写） */
  word?: string;
  partOfSpeech?: string[];
  prefixIds?: number[];
  suffixIds?: number[];
  rootIds?: number[];
  categoryIds?: number[];
  /** 创建时间起（含），YYYY-MM-DD */
  createdAtFrom?: string;
  /** 创建时间止（含），YYYY-MM-DD */
  createdAtTo?: string;
  /** 遗忘次数：至少（>=） */
  forgetCountMin?: number;
  /** 遗忘次数：至多（<=） */
  forgetCountMax?: number;
}

/** 列表项：单词 + 关联数据 */
export interface IVocabularyEntryListItem {
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
  /** 固定搭配（短语 + 意思） */
  collocations: ICollocationItem[];
  /** 遗忘次数：用户标记「忘了」的累计次数 */
  forgetCount: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 语素选项（含释义，供表单展示与筛选） */
export interface IMorphemeOption {
  id: number;
  text: string;
  meanings: string[];
}

/** 筛选选项：供筛选栏下拉与表单 */
export interface IVocabularyFilterOptions {
  partsOfSpeech: string[];
  prefixes: IMorphemeOption[];
  suffixes: IMorphemeOption[];
  roots: IMorphemeOption[];
  categories: { id: number; name: string }[];
}

/** 录入/编辑表单数据 */
export interface IVocabularyEntryFormData {
  word: string;
  phonetic: string;
  mnemonic: string;
  meanings: IPartOfSpeechMeaning[];
  prefixIds: number[];
  suffixIds: number[];
  rootId: number | null;
  categoryId: number | null;
  /** 固定搭配（短语 + 意思） */
  collocations?: ICollocationItem[];
  /** AI 回填的前缀（仅展示，保存时才创建并关联） */
  aiFilledPrefixes?: IMorphemeItem[];
  /** AI 回填的后缀（仅展示，保存时才创建并关联） */
  aiFilledSuffixes?: IMorphemeItem[];
  /** AI 回填的词根（仅展示，保存时才创建并关联） */
  aiFilledRoot?: IMorphemeItem | null;
}

/** AI 补全接口返回 */
export interface IVocabularyAiFillResult {
  phonetic?: string;
  mnemonic?: string;
  partOfSpeechMeanings?: IPartOfSpeechMeaning[];
  prefixes?: IMorphemeItem[];
  suffixes?: IMorphemeItem[];
  root?: IMorphemeItem;
  category?: string;
  /** 固定搭配（短语 + 意思） */
  collocations?: ICollocationItem[];
}
