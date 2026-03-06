import { Controls } from "./controls";
import { CorpusData } from "./data";
import type { IStartTestOptions, ITestSession, WordItem } from "./types";

export class PracticeSession implements ITestSession {
  private currentList: WordItem[] | null = null;
  private originalWords: WordItem[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private rate = 1;
  private shuffle = false;

  constructor(
    private readonly data: CorpusData,
    private readonly controls: Controls,
  ) {}

  private getPlaybackRate(): number {
    const rate = this.controls.value$.value.rate;
    if (!Number.isFinite(rate)) return 1;
    return Math.max(0.5, Math.min(1.5, rate));
  }

  start(
    list: WordItem[],
    options: IStartTestOptions,
    originalWords: WordItem[],
  ): void {
    this.rate = options.rate ?? this.controls.value$.value.rate ?? 1;
    this.shuffle =
      options.shuffle ?? this.controls.value$.value.shuffle ?? false;
    this.data.setPracticeMode(true);
    this.currentList = list;
    this.originalWords = originalWords;

    this.data.words$.next(list);
    this.data.userAnswers$.next(Array(list.length).fill(""));
    this.data.testFinished$.next(false);
    this.data.accuracy$.next(null);
    this.data.testActive$.next(true);
    this.data.testPaused$.next(false);
    this.data.currentPlayingIndex$.next(-1);

    if (typeof window !== "undefined") {
      list.forEach((w) => {
        if (w.audioUrl) {
          const a = new Audio();
          a.src = w.audioUrl;
          a.load();
        }
      });
    }
  }

  playWordAtIndex(index: number): void {
    if (!this.currentList || index < 0 || index >= this.currentList.length)
      return;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.data.currentPlayingIndex$.next(index);
    const item = this.currentList[index];
    if (item.audioUrl && typeof window !== "undefined") {
      const audio = new Audio(item.audioUrl);
      audio.playbackRate = this.getPlaybackRate();
      this.currentAudio = audio;
      audio.onended = () => {
        this.currentAudio = null;
      };
      audio.onerror = () => {
        this.currentAudio = null;
      };
      audio.play().catch(() => {
        this.currentAudio = null;
      });
    }
  }

  private finishTest(list: WordItem[]): void {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.data.testActive$.next(false);
    this.data.testPaused$.next(false);
    this.data.currentPlayingIndex$.next(-1);
    this.data.setPracticeMode(false);
    this.currentList = null;
    const answers = this.data.userAnswers$.value;
    const correct = list.filter(
      (w, idx) =>
        w.word.trim().toLowerCase() ===
        (answers[idx] ?? "").trim().toLowerCase(),
    ).length;
    this.data.accuracy$.next((correct / list.length) * 100);
    this.data.testFinished$.next(true);
  }

  pause(): void {
    // 练习模式无暂停，空实现
  }

  resume(): void {
    // 练习模式无继续，空实现
  }

  end(): void {
    const list = this.currentList;
    if (!list) return;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.currentList = null;
    this.finishTest(list);
  }

  cancel(): void {
    if (!this.currentList) return;
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.currentList = null;
    this.data.testActive$.next(false);
    this.data.testPaused$.next(false);
    this.data.currentPlayingIndex$.next(-1);
    this.data.setPracticeMode(false);
    this.data.testFinished$.next(false);
    this.data.accuracy$.next(null);
    this.data.userAnswers$.next([]);
    if (this.originalWords.length > 0) {
      this.data.words$.next(this.originalWords);
    }
  }

  getMeta(): { rate: number; shuffle: boolean; practiceMode: boolean } {
    return { rate: this.rate, shuffle: this.shuffle, practiceMode: true };
  }
}
