import type { Observable } from "rxjs";

export interface WordItem {
  /** CorpusWord.id，用于统计与提交 */
  id?: number;
  word: string;
  phonetic?: string;
  meaning: string;
  /** 预录制音频 URL */
  audioUrl: string;
}

export interface ChapterItem {
  id: number;
  title: string;
  testCount: number;
}

export interface Selection {
  chapterIndex: number;
  testIndex: number;
}

export interface VoiceItem {
  name: string;
  lang: string;
}

export interface ICorpusControls {
  rate: number;
  shuffle: boolean;
  showResultOnBlur: boolean;
  /** 听写时每个单词播放间隔（毫秒） */
  dictationIntervalMs: number;
  /** 单词网格每行列数（2–8） */
  gridCols: number;
}

/** 历史记录展示用（含 Prisma 可选字段） */
export interface ListenRecordDisplay {
  id: number;
  userId: number;
  chapterId: number;
  testId: number;
  accuracy: number;
  totalCount: number;
  correctCount: number;
  wrongIndices: unknown;
  wrongWordStrings?: unknown;
  rate?: number;
  shuffle?: boolean;
  completedAt: Date;
}

/** 语料数据：选中状态、单词列表、听写状态流与读写方法 */
export interface ICorpusData {
  readonly chapters: readonly ChapterItem[];
  selected$: Observable<Selection>;
  /** 当前选中的 chapter，无效选择时为 null */
  currentChapter$: Observable<ChapterItem | null>;
  /** 当前 chapterId，便于请求用 */
  chapterId$: Observable<number | null>;
  /** 当前 testId（1-based），便于请求用 */
  testId$: Observable<number | null>;
  /** 当前选择是否有效（chapter 存在且 testIndex 在范围内） */
  hasSelection$: Observable<boolean>;
  words$: Observable<WordItem[]>;
  userAnswers$: Observable<string[]>;
  testActive$: Observable<boolean>;
  testFinished$: Observable<boolean>;
  testPaused$: Observable<boolean>;
  currentPlayingIndex$: Observable<number>;
  accuracy$: Observable<number | null>;
  /** 当前是否为练习模式（单元格显示单词/音标/释义） */
  practiceMode$: Observable<boolean>;
  setSelected(s: Selection): void;
  setAnswer(index: number, value: string): void;
  resetTest(): void;
}

/** 语速/乱序等控制 */
export interface IControls {
  value$: Observable<ICorpusControls>;
  change(params: Partial<ICorpusControls>): void;
}

/** 单次测验/练习的会话：听写或练习二选一，由具体实现负责流程 */
export interface ITestSession {
  start(
    list: WordItem[],
    options: IStartTestOptions,
    originalWords: WordItem[],
  ): void;
  pause(): void;
  resume(): void;
  end(): void;
  cancel(): void;
  getMeta(): { rate: number; shuffle: boolean; practiceMode: boolean };
  playWordAtIndex(index: number): void;
}

/** 听写流程：startTest/pause/resume/end/cancel，暴露 data + controls */
export interface ICorpus {
  readonly data: ICorpusData;
  readonly controls: IControls;
  readonly onFocusFirstInput$: Observable<void>;
  setSelected(s: Selection): void;
  setAnswer(index: number, value: string): void;
  resetTest(): void;
  startTest(list: WordItem[], options?: IStartTestOptions): void;
  pauseTest(): void;
  resumeTest(): void;
  endTest(): void;
  cancelTest(): void;
  getLastTestMeta(): { rate: number; shuffle: boolean; practiceMode: boolean };
  playWordAtIndex(index: number): void;
}

export interface IStartTestOptions {
  rate?: number;
  shuffle?: boolean;
  practiceMode?: boolean;
}

/** 单条听写记录的错题集视图（只读），由 record + words 派生 */
export interface IListenRecordView {
  readonly wrongWordSet: Set<string>;
  isWordWrong(word: string): boolean;
  isWordWrongByIndex(index: number): boolean;
}
