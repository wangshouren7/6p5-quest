import { Subject } from "rxjs";
import { Controls } from "./controls";
import type { FetchWordsFn } from "./data";
import { CorpusData } from "./data";
import { DictationSession } from "./dictation-session";
import { PracticeSession } from "./practice-session";
import type {
    ChapterItem,
    IControls,
    ICorpus,
    ICorpusData,
    IStartTestOptions,
    ITestSession,
    Selection,
    WordItem,
} from "./types";

export type { IStartTestOptions } from "./types";

export interface ICorpusOptions {
  chapters: ChapterItem[];
  fetchWords: FetchWordsFn;
}

export class Corpus implements ICorpus {
  private readonly _data: CorpusData;
  readonly data: ICorpusData;
  private readonly _controls: Controls;
  readonly controls: IControls;
  readonly onFocusFirstInput$ = new Subject<void>();

  private currentSession: ITestSession | null = null;
  private originalWordsBeforeTest: WordItem[] = [];
  private lastTestMeta: {
    rate: number;
    shuffle: boolean;
    practiceMode: boolean;
  } = { rate: 1, shuffle: false, practiceMode: false };

  constructor(options: ICorpusOptions) {
    this._data = new CorpusData(options.chapters, {
      fetchWords: options.fetchWords,
    });
    this.data = this._data;
    this._controls = new Controls();
    this.controls = this._controls;
  }

  setSelected(s: Selection) {
    this._data.setSelected(s);
  }

  setAnswer(index: number, value: string) {
    this._data.setAnswer(index, value);
  }

  resetTest() {
    this.currentSession = null;
    this._data.resetTest();
    if (this.originalWordsBeforeTest.length > 0) {
      this._data.words$.next(this.originalWordsBeforeTest);
      this.originalWordsBeforeTest = [];
    }
  }

  startTest(list: WordItem[], options?: IStartTestOptions) {
    if (list.length === 0 || this.currentSession != null) return;
    this.originalWordsBeforeTest = this._data.words$.value;
    const opts = options ?? {};
    const practiceMode = opts.practiceMode ?? false;

    if (practiceMode) {
      this.currentSession = new PracticeSession(this._data, this._controls);
    } else {
      this.currentSession = new DictationSession(this._data, this._controls);
    }
    this.currentSession.start(list, opts, this.originalWordsBeforeTest);
    this.lastTestMeta = this.currentSession.getMeta();

    if (!practiceMode) {
      this.onFocusFirstInput$.next();
    }
  }

  pauseTest() {
    this.currentSession?.pause();
  }

  resumeTest() {
    this.currentSession?.resume();
  }

  endTest() {
    const session = this.currentSession;
    if (!session) return;
    this.lastTestMeta = session.getMeta();
    session.end();
    this.currentSession = null;
  }

  cancelTest() {
    const session = this.currentSession;
    if (!session) return;
    session.cancel();
    this.currentSession = null;
  }

  getLastTestMeta(): { rate: number; shuffle: boolean; practiceMode: boolean } {
    return this.currentSession?.getMeta() ?? this.lastTestMeta;
  }

  playWordAtIndex(index: number) {
    this.currentSession?.playWordAtIndex(index);
  }
}
