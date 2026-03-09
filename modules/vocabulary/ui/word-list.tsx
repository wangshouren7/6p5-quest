"use client";

import { cn } from "@/modules/ui/jsx";
import { PaginationBar } from "@/modules/ui/pagination";
import { SimpleModal } from "@/modules/ui/simple-modal";
import { shuffleArray } from "@/utils/array";
import { getDefaultGridColsForWidth } from "@/utils/format";
import html2canvas from "html2canvas-pro";
import { LayoutGrid, List, Volume2 } from "lucide-react";
import { useObservable } from "rcrx";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  IVocabularyEntryFormData,
  IVocabularyEntryListItem,
} from "../core";
import { useVocabulary } from "./context";
import { EntryForm } from "./entry-form";
import { MfpCard } from "./mfp-card";
import { ReciteView } from "./recite-view";
import { useWordListActions } from "./use-word-list-actions";
import { useWordSpeech } from "./use-word-speech";
import {
  WordListGridWithFullscreen,
  WordListTableView,
  WordListToolbarExtras,
} from "./word-list-sections";

type ViewMode = "list" | "grid";

interface WordListProps {
  className?: string;
}

export function VocabularyWordList({ className }: WordListProps = {}) {
  const { vocabulary, aiConfig } = useVocabulary();
  const { deleteEntry, fetchEntryById, refresh, setFormError } =
    useWordListActions();
  const result = useObservable(vocabulary.data.result$);
  const page = useObservable(vocabulary.data.page$);
  const pageSize = useObservable(vocabulary.data.pageSize$);
  const items = result?.items ?? [];
  const total = result?.total ?? 0;
  const onPageChange = useCallback(
    (p: number) => vocabulary.data.handlePageChange(p),
    [vocabulary],
  );
  const onPageSizeChange = useCallback(
    (s: number) => vocabulary.data.handlePageSizeChange(s),
    [vocabulary],
  );
  const onRefresh = useCallback(() => refresh(), [refresh]);
  const onError = useCallback(
    (msg: string | null) => setFormError(msg),
    [setFormError],
  );
  const currentPage = page ?? 1;
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [gridCols, setGridCols] = useState(4);
  useEffect(() => {
    setGridCols((prev) =>
      prev === 4 ? getDefaultGridColsForWidth(window.innerWidth) : prev,
    );
  }, []);
  const [isGridFullscreen, setIsGridFullscreen] = useState(false);
  /** 全屏网格展示内容：全部 | 仅单词 | 单词+释义 */
  const [fullscreenDisplayMode, setFullscreenDisplayMode] = useState<
    "full" | "word" | "wordMeaning"
  >("full");
  /** 全屏下提示透明度 0–100，100=不弱化，0=最淡 */
  const [fullscreenHintOpacityLevel, setFullscreenHintOpacityLevel] =
    useState(12);
  const [selectedEntry, setSelectedEntry] =
    useState<IVocabularyEntryListItem | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editFormData, setEditFormData] =
    useState<IVocabularyEntryFormData | null>(null);
  const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
  const [exportImageLoading, setExportImageLoading] = useState(false);
  const fullscreenGridRef = useRef<HTMLDivElement | null>(null);
  const [reciteActive, setReciteActive] = useState(false);
  const [reciteItems, setReciteItems] = useState<IVocabularyEntryListItem[]>(
    [],
  );
  const [reciteIndex, setReciteIndex] = useState(0);
  const [reciteRevealed, setReciteRevealed] = useState(false);
  const [reciteShowFirst, setReciteShowFirst] = useState<"word" | "meaning">(
    "word",
  );
  /** 背诵模式是否乱序，由用户选择 */
  const [reciteShuffle, setReciteShuffle] = useState(false);
  /** 背诵模式是否静音（不自动播放单词发音） */
  const [reciteMuted, setReciteMuted] = useState(false);
  const { speak } = useWordSpeech();

  const totalPages = Math.max(1, Math.ceil(total / (pageSize ?? 200)));

  const gridCardNodes =
    viewMode === "grid"
      ? items.map((entry, index) => {
          const isLastInRow =
            (index + 1) % gridCols === 0 || index === items.length - 1;
          const isLastRow =
            index >= Math.floor((items.length - 1) / gridCols) * gridCols;
          return (
            <div
              key={entry.id}
              className={cn(
                "overflow-hidden bg-base-200 border-base-300",
                "border-r border-b",
                isLastInRow && "border-r-0",
                isLastRow && "border-b-0",
              )}
            >
              <MfpCard
                data={{
                  word: entry.word,
                  phonetic: entry.phonetic,
                  mnemonic: entry.mnemonic,
                  meanings: entry.meanings,
                  prefixes: entry.prefixes,
                  suffixes: entry.suffixes,
                  root: entry.root,
                  categoryName: entry.categoryName,
                  collocations: entry.collocations ?? [],
                }}
                onEdit={() => handleEdit(entry)}
                onDelete={() =>
                  handleDelete(
                    { stopPropagation: () => {} } as React.MouseEvent,
                    entry.id,
                  )
                }
                deleteLoading={deleteLoading === entry.id}
                fillWidth
                hintOpacity={
                  isGridFullscreen && fullscreenHintOpacityLevel < 100
                    ? fullscreenHintOpacityLevel / 100
                    : undefined
                }
                className="border-0 shadow-none"
              />
            </div>
          );
        })
      : null;

  const gridCardNodesWordOnly =
    viewMode === "grid"
      ? items.map((entry, index) => {
          const isLastInRow =
            (index + 1) % gridCols === 0 || index === items.length - 1;
          const isLastRow =
            index >= Math.floor((items.length - 1) / gridCols) * gridCols;
          return (
            <div
              key={entry.id}
              className={cn(
                "overflow-hidden bg-base-200 border-base-300 flex items-center justify-center gap-1 p-2 min-h-10",
                "border-r border-b",
                isLastInRow && "border-r-0",
                isLastRow && "border-b-0",
              )}
              onMouseEnter={() => speak(entry.word)}
            >
              <span className="font-medium text-base">{entry.word}</span>
              <button
                type="button"
                className="btn btn-ghost btn-xs btn-square p-0 min-h-0 h-6 w-6 text-base-content/50 hover:text-base-content/80"
                onClick={(e) => {
                  e.stopPropagation();
                  speak(entry.word);
                }}
                title="朗读（英式发音）"
                aria-label="朗读"
              >
                <Volume2 className="size-3.5" />
              </button>
            </div>
          );
        })
      : null;

  /** 全屏下「单词+释义」：只显示单词和释义文本 */
  const gridCardNodesWordAndMeaning =
    viewMode === "grid"
      ? items.map((entry, index) => {
          const isLastInRow =
            (index + 1) % gridCols === 0 || index === items.length - 1;
          const isLastRow =
            index >= Math.floor((items.length - 1) / gridCols) * gridCols;
          const meaningText =
            entry.meanings
              ?.flatMap((m) => m.meanings)
              .filter(Boolean)
              .join("；") ?? "";
          return (
            <div
              key={entry.id}
              className={cn(
                "overflow-hidden bg-base-200 border-base-300 flex flex-col justify-center p-2 min-h-10",
                "border-r border-b",
                isLastInRow && "border-r-0",
                isLastRow && "border-b-0",
              )}
              onMouseEnter={() => speak(entry.word)}
            >
              <div className="flex items-center gap-1">
                <span className="font-medium text-base">{entry.word}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square p-0 min-h-0 h-6 w-6 text-base-content/50 hover:text-base-content/80"
                  onClick={(e) => {
                    e.stopPropagation();
                    speak(entry.word);
                  }}
                  title="朗读（英式发音）"
                  aria-label="朗读"
                >
                  <Volume2 className="size-3.5" />
                </button>
              </div>
              {meaningText && (
                <span className="text-sm text-base-content/80 mt-0.5 line-clamp-2">
                  {meaningText}
                </span>
              )}
            </div>
          );
        })
      : null;

  const handleEdit = useCallback(
    async (entry: IVocabularyEntryListItem) => {
      await fetchEntryById(
        entry,
        (data) => {
          setEditFormData(data);
          setEditingId(entry.id);
        },
        (msg) => onError?.(msg),
      );
    },
    [fetchEntryById, onError],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: number) => {
      setDeleteLoading(id);
      try {
        await deleteEntry(e, id, onRefresh, (msg) => onError?.(msg));
      } finally {
        setDeleteLoading(null);
      }
    },
    [deleteEntry, onError, onRefresh],
  );

  const handleExportImage = useCallback(async () => {
    const el = fullscreenGridRef.current;
    if (!el) return;
    setExportImageLoading(true);
    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      canvas.toBlob((blob: Blob | null) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `单词列表-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    } finally {
      setExportImageLoading(false);
    }
  }, []);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex flex-wrap items-center gap-3">
        <PaginationBar
          page={currentPage}
          totalPages={totalPages}
          total={total}
          pageSize={pageSize ?? 200}
          pageSizeOptions={[50, 200, 300, 500]}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
        <div className="join">
          <button
            type="button"
            className={cn(
              "btn btn-sm join-item",
              viewMode === "list" && "btn-active",
            )}
            onClick={() => setViewMode("list")}
            title="列表"
            aria-label="列表视图"
          >
            <List className="size-4" />
          </button>
          <button
            type="button"
            className={cn(
              "btn btn-sm join-item",
              viewMode === "grid" && "btn-active",
            )}
            onClick={() => setViewMode("grid")}
            title="单词网格"
            aria-label="网格视图"
          >
            <LayoutGrid className="size-4" />
          </button>
        </div>
        <WordListToolbarExtras
          viewMode={viewMode}
          gridCols={gridCols}
          onGridColsChange={setGridCols}
          isGridFullscreen={isGridFullscreen}
          onGridFullscreenChange={setIsGridFullscreen}
          reciteShuffle={reciteShuffle}
          onReciteShuffleChange={setReciteShuffle}
          reciteActive={reciteActive}
          itemsLength={items.length}
          onStartRecite={() => {
            setReciteItems(reciteShuffle ? shuffleArray(items) : [...items]);
            setReciteIndex(0);
            setReciteRevealed(false);
            setReciteActive(true);
          }}
        />
      </div>

      {reciteActive ? (
        <ReciteView
          items={reciteItems}
          index={reciteIndex}
          revealed={reciteRevealed}
          showFirst={reciteShowFirst}
          speak={speak}
          muted={reciteMuted}
          onMutedChange={setReciteMuted}
          onPrev={() => {
            if (reciteIndex <= 0) return;
            setReciteIndex(reciteIndex - 1);
            setReciteRevealed(false);
          }}
          onReveal={() => setReciteRevealed(true)}
          onNext={() => {
            if (reciteIndex < reciteItems.length - 1) {
              setReciteIndex(reciteIndex + 1);
              setReciteRevealed(false);
            }
          }}
          onExit={() => setReciteActive(false)}
          onShowFirstChange={setReciteShowFirst}
        />
      ) : viewMode === "list" ? (
        <WordListTableView
          items={items}
          onSelectEntry={setSelectedEntry}
          onEdit={handleEdit}
          onDelete={handleDelete}
          deleteLoading={deleteLoading}
        />
      ) : (
        <WordListGridWithFullscreen
          gridCols={gridCols}
          onGridColsChange={setGridCols}
          isGridFullscreen={isGridFullscreen}
          fullscreenGridRef={fullscreenGridRef}
          fullscreenDisplayMode={fullscreenDisplayMode}
          fullscreenHintOpacityLevel={fullscreenHintOpacityLevel}
          onFullscreenHintOpacityLevelChange={setFullscreenHintOpacityLevel}
          onFullscreenDisplayModeChange={setFullscreenDisplayMode}
          onExportImage={handleExportImage}
          exportImageLoading={exportImageLoading}
          itemsLength={items.length}
          onCloseFullscreen={() => setIsGridFullscreen(false)}
          gridCardNodes={gridCardNodes}
          gridCardNodesWordOnly={gridCardNodesWordOnly}
          gridCardNodesWordAndMeaning={gridCardNodesWordAndMeaning}
        />
      )}

      {items.length === 0 && !reciteActive && (
        <p className="text-base-content/60 text-center py-8">
          暂无数据，请调整筛选条件或先录入单词。
        </p>
      )}

      <SimpleModal
        open={selectedEntry != null}
        onClose={() => setSelectedEntry(null)}
      >
        {selectedEntry && (
          <MfpCard
            data={{
              word: selectedEntry.word,
              phonetic: selectedEntry.phonetic,
              mnemonic: selectedEntry.mnemonic,
              meanings: selectedEntry.meanings,
              prefixes: selectedEntry.prefixes,
              suffixes: selectedEntry.suffixes,
              root: selectedEntry.root,
              categoryName: selectedEntry.categoryName,
              collocations: selectedEntry.collocations ?? [],
            }}
            onClose={() => setSelectedEntry(null)}
          />
        )}
      </SimpleModal>

      <SimpleModal
        open={editingId != null && editFormData != null}
        onClose={() => {
          setEditingId(null);
          setEditFormData(null);
        }}
      >
        {editingId != null && editFormData && (
          <EntryForm
            key={editingId}
            aiConfig={aiConfig}
            entryId={editingId}
            initialData={editFormData}
            onSuccess={() => {
              setEditingId(null);
              setEditFormData(null);
              onRefresh?.();
            }}
            onCancel={() => {
              setEditingId(null);
              setEditFormData(null);
            }}
            onError={onError}
          />
        )}
      </SimpleModal>
    </div>
  );
}
