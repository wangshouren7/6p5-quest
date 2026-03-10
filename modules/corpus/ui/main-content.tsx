"use client";

import { getWordsForDictation } from "@/modules/corpus/actions";
import { useWordSpeech } from "@/modules/speech";
import { ListenModeBar } from "@/modules/ui/listen-mode-bar";
import { useObservable } from "rcrx";
import { useCallback, useEffect, useMemo, useState } from "react";
import { USER_ID } from "../core/constants";
import { shuffleWords } from "../core/shuffle";
import type { ICorpus } from "../core/types";
import { useCorpus } from "./context";
import { DictationGrid } from "./dictation-grid";
import { ResultPanel } from "./result-panel";
import { useCorpusPageData } from "./use-corpus-page-data";
import { WordGrid } from "./word-grid";

type PageSizeOption = 200 | 300 | 500 | "custom" | "all";

/** 分页器：使用 daisyUI join + join-item btn，见 https://daisyui.com/components/pagination/ */
function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  disabled,
}: {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}) {
  const showPages = ((): number[] => {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: number[] = [1];
    const lo = Math.max(2, currentPage - 1);
    const hi = Math.min(totalPages - 1, currentPage + 1);
    if (lo > 2) pages.push(-1);
    for (let p = lo; p <= hi; p++)
      if (p !== 1 && p !== totalPages) pages.push(p);
    if (hi < totalPages - 1) pages.push(-2);
    if (totalPages > 1) pages.push(totalPages);
    return pages;
  })();

  return (
    <div className="join">
      <button
        type="button"
        className="btn btn-sm join-item"
        disabled={disabled || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label="上一页"
      >
        «
      </button>
      {showPages.map((p, i) =>
        p === -1 || p === -2 ? (
          <button
            key={`ellipsis-${i}`}
            type="button"
            className="btn btn-sm join-item btn-disabled"
            disabled
          >
            …
          </button>
        ) : (
          <button
            key={p}
            type="button"
            className={`btn btn-sm join-item ${p === currentPage ? "btn-active" : ""}`}
            disabled={disabled}
            onClick={() => onPageChange(p)}
            aria-label={`第 ${p} 页`}
          >
            {p}
          </button>
        ),
      )}
      <button
        type="button"
        className="btn btn-sm join-item"
        disabled={disabled || currentPage >= totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label="下一页"
      >
        »
      </button>
    </div>
  );
}

/** 练习模式结束：不进入结果页，直接重置回单词列表 */
function PracticeEndReset({ corpus }: { corpus: ICorpus }) {
  useEffect(() => {
    corpus.resetTest();
  }, [corpus]);
  return null;
}

interface MainContentProps {
  filteredWords: Awaited<ReturnType<typeof getWordsForDictation>> | null;
  setFilteredWords: React.Dispatch<
    React.SetStateAction<Awaited<
      ReturnType<typeof getWordsForDictation>
    > | null>
  >;
}

export function MainContent({
  filteredWords,
  setFilteredWords,
}: MainContentProps) {
  const corpus = useCorpus();
  const controls = useObservable(corpus.controls.value$);
  const testActive = useObservable(corpus.data.testActive$) ?? false;
  const testFinished = useObservable(corpus.data.testFinished$) ?? false;

  const [page, setPage] = useState(1);
  const [pageSizeOption, setPageSizeOption] = useState<PageSizeOption>(200);
  const [customPageSize, setCustomPageSize] = useState(100);
  /** 听单词模式：按顺序播放当前页单词、拼写、释义 */
  const [listenActive, setListenActive] = useState(false);
  const [listenIndex, setListenIndex] = useState(0);
  const [listenTotal, setListenTotal] = useState(0);

  const {
    speakSequence,
    cancelSequence,
    preferredLang,
    enVoices,
    preferredVoiceName,
    setPreferredVoiceName,
  } = useWordSpeech();

  const displayList = useMemo(() => filteredWords ?? [], [filteredWords]);
  const { wordStats, handleToggleMastered } = useCorpusPageData({
    displayList,
    userId: USER_ID,
  });

  const effectivePageSize =
    pageSizeOption === "all"
      ? Infinity
      : pageSizeOption === "custom"
        ? Math.max(1, customPageSize)
        : pageSizeOption;
  const totalPages =
    effectivePageSize === Infinity
      ? 1
      : Math.max(1, Math.ceil(displayList.length / effectivePageSize));
  const safePage = Math.min(page, totalPages);
  const pageSlice =
    effectivePageSize === Infinity
      ? displayList
      : displayList.slice(
          (safePage - 1) * effectivePageSize,
          safePage * effectivePageSize,
        );

  const playNextWord = useCallback(
    (list: Awaited<ReturnType<typeof getWordsForDictation>>, i: number) => {
      if (i >= list.length) {
        setListenActive(false);
        return;
      }
      setListenIndex(i);
      const entry = list[i];
      const segments = [
        { text: entry.word, lang: preferredLang },
        {
          text: entry.word.split("").join(", "),
          lang: preferredLang,
        },
        { text: entry.meaning, lang: "zh-CN" },
      ];
      speakSequence(segments, () => playNextWord(list, i + 1));
    },
    [preferredLang, speakSequence],
  );

  const onStartListen = useCallback(() => {
    if (pageSlice.length === 0) return;
    setListenTotal(pageSlice.length);
    setListenActive(true);
    setListenIndex(0);
    playNextWord(pageSlice, 0);
  }, [pageSlice, playNextWord]);

  const onStopListen = useCallback(() => {
    cancelSequence();
    setListenActive(false);
  }, [cancelSequence]);

  const onListenVoiceChange = useCallback(
    (value: string | null) => {
      setPreferredVoiceName(value);
      if (listenActive && pageSlice.length > 0) {
        cancelSequence();
        playNextWord(pageSlice, listenIndex);
      }
    },
    [
      listenActive,
      pageSlice,
      listenIndex,
      setPreferredVoiceName,
      cancelSequence,
      playNextWord,
    ],
  );

  const shuffle = controls?.shuffle ?? false;
  const rate = controls?.rate ?? 1;
  const listForTest = shuffle ? shuffleWords(displayList) : displayList;
  const handleStartTest = () => {
    corpus.startTest(listForTest, { rate, shuffle });
  };
  const handleStartPractice = () => {
    corpus.startTest(listForTest, { rate, shuffle, practiceMode: true });
  };

  if (testFinished) {
    const { practiceMode } = corpus.getLastTestMeta();
    if (practiceMode) {
      return <PracticeEndReset corpus={corpus} />;
    }
    return <ResultPanel />;
  }

  if (testActive) {
    return <DictationGrid />;
  }

  if (filteredWords === null) {
    return (
      <p className="text-base-content/70">请设置筛选条件并点击「搜索」。</p>
    );
  }

  if (displayList.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-base-content/70">没有符合条件的单词。</p>
        <button
          type="button"
          className="btn btn-ghost btn-sm w-fit"
          onClick={() => setFilteredWords(null)}
        >
          清空并重新筛选
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={listenActive}
          onClick={handleStartTest}
        >
          开始听写
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={listenActive}
          onClick={handleStartPractice}
        >
          开始练习
        </button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={displayList.length === 0 || listenActive}
          onClick={onStartListen}
          title="按顺序播放当前页单词发音、拼写与释义"
          aria-label="听单词"
        >
          听单词
        </button>
        <span className="text-sm text-base-content/60">
          共 {displayList.length} 个单词
        </span>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setFilteredWords(null)}
        >
          清空结果
        </button>
      </div>

      {listenActive && (
        <ListenModeBar
          listenIndex={listenIndex}
          listenTotal={listenTotal}
          enVoices={enVoices}
          preferredVoiceName={preferredVoiceName}
          preferredLang={preferredLang}
          onVoiceChange={onListenVoiceChange}
          onStop={onStopListen}
        />
      )}

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="label-text shrink-0">每页</span>
        <select
          className="select select-bordered select-sm w-full min-w-0 sm:w-32"
          value={pageSizeOption}
          onChange={(e) => {
            const v = e.target.value;
            if (v === "custom" || v === "all") {
              setPageSizeOption(v);
            } else {
              setPageSizeOption(Number(v) as 200 | 300 | 500);
            }
            setPage(1);
          }}
        >
          <option value={200}>200</option>
          <option value={300}>300</option>
          <option value={500}>500</option>
          <option value="custom">自定义</option>
          <option value="all">全部展示</option>
        </select>
        {pageSizeOption === "custom" && (
          <input
            type="number"
            min={1}
            max={1000}
            className="input input-bordered input-sm w-full min-w-0 sm:w-24"
            value={customPageSize}
            onChange={(e) => {
              const next = Math.max(1, parseInt(e.target.value, 10) || 1);
              setCustomPageSize(next);
              setPage(1);
            }}
          />
        )}
        <span className="text-sm text-base-content/60 shrink-0">
          第 {safePage} / {totalPages} 页，共 {displayList.length} 条
        </span>
        <Pagination
          currentPage={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
          disabled={listenActive}
        />
      </div>

      <WordGrid
        words={pageSlice}
        wordStats={wordStats}
        onToggleMastered={handleToggleMastered}
      />
    </>
  );
}
