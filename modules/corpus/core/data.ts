import { BehaviorSubject } from "rxjs";
import type { ChapterItem, ICorpusData, Selection, WordItem } from "./types";

export type FetchWordsFn = (
  chapterId: number,
  testId: number,
) => Promise<(WordItem & { id: number })[]>;

export interface ICorpusDataOptions {
  fetchWords: FetchWordsFn;
}

function deriveSelectionState(
  chapters: readonly ChapterItem[],
  s: Selection,
): {
  currentChapter: ChapterItem | null;
  chapterId: number | null;
  testId: number | null;
  hasSelection: boolean;
} {
  const ch = chapters[s.chapterIndex] ?? null;
  const hasSelection =
    ch != null && s.testIndex >= 0 && s.testIndex < ch.testCount;
  return {
    currentChapter: hasSelection ? ch : null,
    chapterId: ch?.id ?? null,
    testId: hasSelection && ch ? s.testIndex + 1 : null,
    hasSelection,
  };
}

export class CorpusData implements ICorpusData {
  selected$: BehaviorSubject<Selection> = new BehaviorSubject<Selection>({
    chapterIndex: 0,
    testIndex: 0,
  });

  currentChapter$ = new BehaviorSubject<ChapterItem | null>(null);
  chapterId$ = new BehaviorSubject<number | null>(null);
  testId$ = new BehaviorSubject<number | null>(null);
  hasSelection$ = new BehaviorSubject<boolean>(false);

  words$ = new BehaviorSubject<WordItem[]>([]);
  userAnswers$: BehaviorSubject<string[]> = new BehaviorSubject<string[]>([]);
  testActive$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  testFinished$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  testPaused$: BehaviorSubject<boolean> = new BehaviorSubject(false);
  currentPlayingIndex$: BehaviorSubject<number> = new BehaviorSubject(-1);
  accuracy$: BehaviorSubject<number | null> = new BehaviorSubject<
    number | null
  >(null);
  practiceMode$ = new BehaviorSubject<boolean>(false);

  private readonly _fetchWords: FetchWordsFn;

  constructor(
    public readonly chapters: ChapterItem[],
    options: ICorpusDataOptions,
  ) {
    this._fetchWords = options.fetchWords;
    this.syncDerivedSelection(this.selected$.value);
    // No auto-load: word list is driven by header filter + "获取单词" only
  }

  private syncDerivedSelection(s: Selection) {
    const d = deriveSelectionState(this.chapters, s);
    this.currentChapter$.next(d.currentChapter);
    this.chapterId$.next(d.chapterId);
    this.testId$.next(d.testId);
    this.hasSelection$.next(d.hasSelection);
  }

  setSelected(s: Selection) {
    const ch = this.chapters[s.chapterIndex];
    if (!ch || s.testIndex >= ch.testCount) {
      this.words$.next([]);
      this.selected$.next(s);
      this.syncDerivedSelection(s);
      return;
    }
    this.selected$.next(s);
    this.words$.next([]);
    this.syncDerivedSelection(s);
    this.loadWords(ch.id, s.testIndex + 1);
  }

  async loadWords(chapterId: number, testId: number): Promise<void> {
    const words = await this._fetchWords(chapterId, testId);
    this.words$.next(words);
  }

  private loadWordsForSelection(sel: Selection) {
    const ch = this.chapters[sel.chapterIndex];
    if (!ch || sel.testIndex >= ch.testCount) return;
    this.loadWords(ch.id, sel.testIndex + 1);
  }

  setAnswer(index: number, value: string) {
    const prev = this.userAnswers$.value;
    const next = [...prev];
    next[index] = value;
    this.userAnswers$.next(next);
  }

  setPracticeMode(value: boolean) {
    this.practiceMode$.next(value);
  }

  resetTest() {
    this.testFinished$.next(false);
    this.accuracy$.next(null);
    this.userAnswers$.next([]);
    this.practiceMode$.next(false);
  }
}
