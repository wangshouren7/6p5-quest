import { normalizeWord } from "@/utils/string";
import { Controls } from "./controls";
import { CorpusData } from "./data";
import type { IStartTestOptions, ITestSession, WordItem } from "./types";

const DEFAULT_INTERVAL_MS = 3000;
const MIN_INTERVAL_MS = 500;
const MAX_INTERVAL_MS = 15000;

export class DictationSession implements ITestSession {
  private currentList: WordItem[] | null = null;
  private originalWords: WordItem[] = [];
  private nextIndexToPlay = 0;
  private isPaused = false;
  private playNextRef: ((i: number) => void) | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private scheduleTimeoutId: ReturnType<typeof setTimeout> | null = null;
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

  private getDictationIntervalMs(): number {
    const ms = this.controls.value$.value.dictationIntervalMs;
    if (!Number.isFinite(ms)) return DEFAULT_INTERVAL_MS;
    return Math.max(MIN_INTERVAL_MS, Math.min(MAX_INTERVAL_MS, ms));
  }

  private clearScheduleTimeout(): void {
    if (this.scheduleTimeoutId != null) {
      clearTimeout(this.scheduleTimeoutId);
      this.scheduleTimeoutId = null;
    }
  }

  start(
    list: WordItem[],
    options: IStartTestOptions,
    originalWords: WordItem[],
  ): void {
    this.rate = options.rate ?? this.controls.value$.value.rate ?? 1;
    this.shuffle =
      options.shuffle ?? this.controls.value$.value.shuffle ?? false;
    this.data.setPracticeMode(false);
    this.currentList = list;
    this.originalWords = originalWords;
    this.isPaused = false;

    this.data.words$.next(list);
    this.data.userAnswers$.next(Array(list.length).fill(""));
    this.data.testFinished$.next(false);
    this.data.accuracy$.next(null);
    this.data.testActive$.next(true);
    this.data.testPaused$.next(false);
    this.data.currentPlayingIndex$.next(0);

    const playNext = (i: number) => {
      if (!this.currentList || this.isPaused) return;
      this.playNextRef = playNext;
      if (i >= list.length) {
        this.finishTest(list);
        return;
      }
      this.data.currentPlayingIndex$.next(i);

      const intervalMs = this.getDictationIntervalMs();
      const scheduleNext = () => {
        if (!this.currentList) return;
        if (this.isPaused) {
          this.nextIndexToPlay = i + 1;
          return;
        }
        this.clearScheduleTimeout();
        this.scheduleTimeoutId = setTimeout(() => {
          this.scheduleTimeoutId = null;
          playNext(i + 1);
        }, intervalMs);
      };

      const item = list[i];
      if (item.audioUrl && typeof window !== "undefined") {
        if (this.currentAudio) {
          this.currentAudio.pause();
          this.currentAudio = null;
        }
        const audio = new Audio(item.audioUrl);
        audio.playbackRate = this.getPlaybackRate();
        this.currentAudio = audio;
        audio.onended = () => {
          this.currentAudio = null;
          scheduleNext();
        };
        audio.onerror = () => {
          this.currentAudio = null;
          scheduleNext();
        };
        audio.play().catch(() => {
          this.currentAudio = null;
          scheduleNext();
        });
      } else {
        this.clearScheduleTimeout();
        this.scheduleTimeoutId = setTimeout(() => {
          this.scheduleTimeoutId = null;
          scheduleNext();
        }, intervalMs);
      }
    };
    // 推迟到下一帧再播第一个单词，确保 UI 已挂载且不触发浏览器自动播放限制
    if (typeof window !== "undefined") {
      const startPlayback = () => playNext(0);
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(startPlayback);
      } else {
        setTimeout(startPlayback, 0);
      }
    } else {
      playNext(0);
    }
  }

  private finishTest(list: WordItem[]): void {
    this.clearScheduleTimeout();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.data.testActive$.next(false);
    this.data.testPaused$.next(false);
    this.data.currentPlayingIndex$.next(-1);
    this.data.setPracticeMode(false);
    this.currentList = null;
    this.playNextRef = null;
    const answers = this.data.userAnswers$.value;
    const correct = list.filter(
      (w, idx) => normalizeWord(w.word) === normalizeWord(answers[idx] ?? ""),
    ).length;
    this.data.accuracy$.next((correct / list.length) * 100);
    this.data.testFinished$.next(true);
  }

  pause(): void {
    if (!this.currentList || this.isPaused) return;
    this.isPaused = true;
    this.clearScheduleTimeout();
    this.nextIndexToPlay = this.data.currentPlayingIndex$.value + 1;
    this.data.testPaused$.next(true);
    if (this.currentAudio) {
      this.currentAudio.pause();
    }
  }

  resume(): void {
    if (!this.currentList || !this.isPaused || !this.playNextRef) return;
    this.isPaused = false;
    this.data.testPaused$.next(false);
    this.playNextRef(this.nextIndexToPlay);
  }

  end(): void {
    const list = this.currentList;
    if (!list) return;
    this.clearScheduleTimeout();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.currentList = null;
    this.playNextRef = null;
    this.isPaused = false;
    this.finishTest(list);
  }

  cancel(): void {
    if (!this.currentList) return;
    this.clearScheduleTimeout();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    this.currentList = null;
    this.playNextRef = null;
    this.isPaused = false;
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
    return { rate: this.rate, shuffle: this.shuffle, practiceMode: false };
  }

  playWordAtIndex(index: number): void {
    if (!this.currentList || this.isPaused) return;
    if (index < 0 || index >= this.currentList.length) return;
    // 若该词已在播放（由定时器触发），不要重复播放
    if (this.data.currentPlayingIndex$.value === index) return;
    this.clearScheduleTimeout();
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.playNextRef) this.playNextRef(index);
  }
}
