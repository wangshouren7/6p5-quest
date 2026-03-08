import type {
  IVocabularyEntryListItem,
  IVocabularyFilter,
  IVocabularyFilterOptions,
} from "./types";

/** 列表结果：分页后的条目与总数 */
export interface IVocabularyResult {
  items: IVocabularyEntryListItem[];
  total: number;
}

/** 词汇页 AI 配置（与 Leva 控件一致） */
export interface IVocabularyAiConfig {
  baseUrl: string;
  accessToken: string;
  model: string;
}

/** setState 风格：可传新值或 (prev) => next */
export type SetState<T> = (value: T | ((prev: T) => T)) => void;

/**
 * 词汇模块 Context 暴露的实例形态。
 * UI 通过 useVocabulary() 取此实例，读 filter/result/page 并调用 fetchEntries、setFilter 等方法。
 */
export interface IVocabulary {
  filter: IVocabularyFilter;
  setFilter: SetState<IVocabularyFilter>;
  filterOptions: IVocabularyFilterOptions | null;
  result: IVocabularyResult | null;
  page: number;
  pageSize: number;
  formError: string | null;
  setFormError: SetState<string | null>;
  filterLoading: boolean;
  aiConfig: IVocabularyAiConfig;

  loadFilterOptions: () => Promise<void>;
  fetchEntries: () => Promise<void>;
  handlePageChange: (newPage: number) => Promise<void>;
  handlePageSizeChange: (newSize: number) => void;
  handleRefresh: () => Promise<void>;
  handleFormSuccess: () => void;
}
