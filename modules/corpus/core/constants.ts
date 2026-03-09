import type { ICorpusControls } from "./types";

/** public 下 corpus 目录，用于 fetch chapters/words */
export const CORPUS_BASE = "/listen/corpus/chapters";

/** 听写时每个单词播放间隔（毫秒） */
export const DICTATION_INTERVAL_MS = 3000;

/** 听写结果/历史网格默认列数（与 DEFAULT_CORPUS_CONTROLS.gridCols 一致） */
export const RESULT_GRID_COLS = 4;

/** 当前未做登录，前端写死的用户 ID */
export const USER_ID = 1;

export const DEFAULT_CORPUS_CONTROLS: ICorpusControls = {
  rate: 1,
  shuffle: true,
  showResultOnBlur: true,
  dictationIntervalMs: 3000,
  gridCols: 4,
};
