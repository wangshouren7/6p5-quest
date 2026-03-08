import type { ICorpusControls } from "./types";

/** public 下 corpus 目录，用于 fetch chapters/words */
export const CORPUS_BASE = "/listen/corpus/chapters";

/** 听写时每个单词播放间隔（毫秒） */
export const DICTATION_INTERVAL_MS = 3000;

/** 听写结果/历史网格默认列数（与 DEFAULT_CORPUS_CONTROLS.gridCols 一致） */
export const RESULT_GRID_COLS = 4;

/** 根据 gridCols（2–8）返回 Tailwind grid 类名 */
export function getGridColsClass(gridCols: number): string {
  const n = Math.min(8, Math.max(2, Math.round(gridCols)));
  return (
    [
      "grid-cols-2",
      "grid-cols-3",
      "grid-cols-4",
      "grid-cols-5",
      "grid-cols-6",
      "grid-cols-7",
      "grid-cols-8",
    ][n - 2] ?? "grid-cols-4"
  );
}

/** 当前未做登录，前端写死的用户 ID */
export const USER_ID = 1;

export const DEFAULT_CORPUS_CONTROLS: ICorpusControls = {
  rate: 1,
  shuffle: true,
  showResultOnBlur: true,
  dictationIntervalMs: 3000,
  gridCols: 4,
};
