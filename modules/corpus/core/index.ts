export { playWordAudio } from "./audio";
export {
    DEFAULT_CORPUS_CONTROLS,
    DICTATION_INTERVAL_MS,
    RESULT_GRID_COLS,
    USER_ID
} from "./constants";
export { Controls } from "./controls";
export { Corpus } from "./corpus";
export type { ICorpusOptions, IStartTestOptions } from "./corpus";
export { CorpusData } from "./data";
export type { FetchWordsFn } from "./data";
export { parseWrongIndices, parseWrongWordStrings } from "./record-utils";
export { computeResult } from "./result";
export type { ComputeResultReturn } from "./result";
export { shuffleWords } from "./shuffle";
export type {
    ChapterItem,
    IControls,
    ICorpus,
    ICorpusControls,
    ICorpusData,
    Selection,
    VoiceItem,
    WordItem
} from "./types";

