"use client";

import { cn } from "@/modules/ui/jsx";
import html2canvas from "html2canvas-pro";
import {
  ImageDown,
  LayoutGrid,
  List,
  Maximize2,
  Minimize2,
  Pencil,
  Trash2,
  Volume2,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { deleteVocabularyEntry, getVocabularyEntryById } from "../actions";
import type {
  IVocabularyEntryFormData,
  IVocabularyEntryListItem,
} from "../core";
import { useVocabulary } from "./context";
import { EntryForm } from "./entry-form";
import { MfpCard } from "./mfp-card";
import { ReciteView } from "./recite-view";
import { useWordSpeech } from "./use-word-speech";

type ViewMode = "list" | "grid";

function shuffleEntries<T>(list: T[]): T[] {
  const next = [...list];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

interface WordListProps {
  className?: string;
}

export function VocabularyWordList({ className }: WordListProps = {}) {
  const ctx = useVocabulary();
  const items = ctx.result?.items ?? [];
  const total = ctx.result?.total ?? 0;
  const {
    page,
    pageSize,
    aiConfig,
    handlePageChange,
    handlePageSizeChange,
    handleRefresh,
    setFormError,
  } = ctx;
  const onPageChange = handlePageChange;
  const onPageSizeChange = handlePageSizeChange;
  const onRefresh = handleRefresh;
  const onError = setFormError;
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [gridCols, setGridCols] = useState(4);
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
  const { speak } = useWordSpeech();

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

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
      const full = await getVocabularyEntryById(entry.id);
      if (!full) {
        onError?.("无法加载该单词");
        return;
      }
      const data: IVocabularyEntryFormData = {
        word: full.word,
        phonetic: full.phonetic ?? "",
        mnemonic: full.mnemonic ?? "",
        meanings: full.meanings,
        prefixIds: full.prefixIds ?? [],
        suffixIds: full.suffixIds ?? [],
        rootId: full.rootId ?? null,
        categoryId: full.categoryId,
        collocations: full.collocations ?? [],
      };
      setEditFormData(data);
      setEditingId(full.id);
    },
    [onError],
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: number) => {
      e.stopPropagation();
      if (!confirm("确定要删除该单词吗？")) return;
      setDeleteLoading(id);
      try {
        const result = await deleteVocabularyEntry(id);
        if ("error" in result) {
          onError?.(result.error);
        } else {
          onRefresh?.();
        }
      } finally {
        setDeleteLoading(null);
      }
    },
    [onError, onRefresh],
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
        <span className="text-sm text-base-content/70">
          共 {total} 条，第 {page} / {totalPages} 页
        </span>
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
        <div className="join">
          <button
            type="button"
            className="btn btn-sm join-item"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="上一页"
          >
            «
          </button>
          <button
            type="button"
            className="btn btn-sm join-item btn-disabled"
            aria-hidden
          >
            {page}
          </button>
          <button
            type="button"
            className="btn btn-sm join-item"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="下一页"
          >
            »
          </button>
        </div>
        {onPageSizeChange && (
          <select
            className="select select-bordered select-sm w-28"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            <option value={50}>50/页</option>
            <option value={200}>200/页</option>
            <option value={300}>300/页</option>
            <option value={500}>500/页</option>
          </select>
        )}
        {viewMode === "grid" && (
          <>
            <label className="flex items-center gap-1.5 text-sm">
              <span className="text-base-content/70">每行</span>
              <input
                type="number"
                min={1}
                max={32}
                className="input input-bordered input-sm w-14 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={gridCols}
                onChange={(e) => {
                  const v =
                    e.target.value === "" ? 1 : parseInt(e.target.value, 10);
                  const n = Number.isNaN(v) ? 1 : Math.min(32, Math.max(1, v));
                  setGridCols(n);
                }}
                title="每行展示数量 (1–32)"
                aria-label="每行展示数量"
              />
              <span className="text-base-content/70">列</span>
            </label>
            <button
              type="button"
              className={cn(
                "btn btn-sm btn-ghost btn-square",
                isGridFullscreen && "btn-active",
              )}
              onClick={() => setIsGridFullscreen((v) => !v)}
              title={isGridFullscreen ? "退出全屏" : "全屏展示"}
              aria-label={isGridFullscreen ? "退出全屏" : "全屏展示"}
            >
              {isGridFullscreen ? (
                <Minimize2 className="size-4" />
              ) : (
                <Maximize2 className="size-4" />
              )}
            </button>
          </>
        )}
        <label className="label cursor-pointer gap-2 py-0 pr-0">
          <input
            type="checkbox"
            className="checkbox checkbox-sm"
            checked={reciteShuffle}
            onChange={(e) => setReciteShuffle(e.target.checked)}
            disabled={reciteActive}
          />
          <span className="label-text whitespace-nowrap">背诵乱序</span>
        </label>
        <button
          type="button"
          className="btn btn-sm"
          disabled={items.length === 0 || reciteActive}
          onClick={() => {
            setReciteItems(reciteShuffle ? shuffleEntries(items) : [...items]);
            setReciteIndex(0);
            setReciteRevealed(false);
            setReciteActive(true);
          }}
          title="背诵模式"
          aria-label="背诵模式"
        >
          背诵模式
        </button>
      </div>

      {reciteActive ? (
        <ReciteView
          items={reciteItems}
          index={reciteIndex}
          revealed={reciteRevealed}
          showFirst={reciteShowFirst}
          onPrev={() => {
            if (reciteIndex <= 0) return;
            setReciteIndex(reciteIndex - 1);
            setReciteRevealed(false);
          }}
          onReveal={() => setReciteRevealed(true)}
          onNext={() => {
            if (!reciteRevealed) setReciteRevealed(true);
            else if (reciteIndex < reciteItems.length - 1) {
              setReciteIndex(reciteIndex + 1);
              setReciteRevealed(false);
            }
          }}
          onExit={() => setReciteActive(false)}
          onShowFirstChange={setReciteShowFirst}
        />
      ) : viewMode === "list" ? (
        <div className="overflow-x-auto">
          <table className="table table-zebra table-sm">
            <thead>
              <tr>
                <th>单词</th>
                <th>音标</th>
                <th>词性/释义</th>
                <th>分类</th>
                <th className="w-20 text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr
                  key={entry.id}
                  className="cursor-pointer hover:bg-base-300"
                  onClick={() => setSelectedEntry(entry)}
                >
                  <td className="font-medium">{entry.word}</td>
                  <td className="font-mono text-sm opacity-80">
                    {entry.phonetic ?? "—"}
                  </td>
                  <td className="text-sm max-w-xs truncate">
                    {entry.meanings
                      .map(
                        (m) =>
                          `${m.partOfSpeech} ${m.meanings.filter(Boolean).join("; ")}`,
                      )
                      .join(" | ") || "—"}
                  </td>
                  <td className="text-sm opacity-80">
                    {entry.categoryName ?? "—"}
                  </td>
                  <td
                    className="text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square"
                        onClick={() => handleEdit(entry)}
                        title="编辑"
                        aria-label="编辑"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs btn-square text-error"
                        onClick={(e) => handleDelete(e, entry.id)}
                        disabled={deleteLoading === entry.id}
                        title="删除"
                        aria-label="删除"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {isGridFullscreen && (
            <div className="fixed inset-0 z-50 bg-base-100 flex flex-col">
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-base-300 px-4 py-2">
                <span className="font-medium">单词网格</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs text-base-content/60 shrink-0 whitespace-nowrap">
                      提示透明度
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={fullscreenHintOpacityLevel}
                      onChange={(e) =>
                        setFullscreenHintOpacityLevel(Number(e.target.value))
                      }
                      className="range range-primary range-xs w-20"
                      title="调节分类、释义等提示的透明度"
                      aria-label="提示透明度"
                    />
                    <span className="text-xs text-base-content/50 tabular-nums w-6 text-right">
                      {fullscreenHintOpacityLevel}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-base-content/70">展示：</span>
                    <select
                      className="select select-sm select-bordered w-auto min-w-0"
                      value={fullscreenDisplayMode}
                      onChange={(e) =>
                        setFullscreenDisplayMode(
                          e.target.value as "full" | "word" | "wordMeaning",
                        )
                      }
                      aria-label="全屏展示内容"
                    >
                      <option value="full">全部</option>
                      <option value="word">仅单词</option>
                      <option value="wordMeaning">单词+释义</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={handleExportImage}
                    disabled={exportImageLoading || items.length === 0}
                    title="导出图片"
                    aria-label="导出图片"
                  >
                    <ImageDown className="size-4 mr-1" />
                    {exportImageLoading ? "导出中…" : "导出图片"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => setIsGridFullscreen(false)}
                    aria-label="退出全屏"
                  >
                    <Minimize2 className="size-4 mr-1" />
                    退出全屏
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto">
                <div
                  ref={fullscreenGridRef}
                  className="grid bg-base-100"
                  style={{
                    gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
                  }}
                >
                  {fullscreenDisplayMode === "word"
                    ? gridCardNodesWordOnly
                    : fullscreenDisplayMode === "wordMeaning"
                      ? gridCardNodesWordAndMeaning
                      : gridCardNodes}
                </div>
              </div>
            </div>
          )}
          <div
            className={cn(
              "grid rounded-lg overflow-hidden p-0 bg-base-200 border border-base-300",
              isGridFullscreen && "hidden",
            )}
            style={{
              gridTemplateColumns: `repeat(${gridCols}, minmax(0, 1fr))`,
            }}
          >
            {gridCardNodes}
          </div>
        </>
      )}

      {items.length === 0 && !reciteActive && (
        <p className="text-base-content/60 text-center py-8">
          暂无数据，请调整筛选条件或先录入单词。
        </p>
      )}

      {selectedEntry && (
        <dialog
          open
          className="modal modal-open"
          onClose={() => setSelectedEntry(null)}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSelectedEntry(null);
          }}
        >
          <div className="modal-box max-w-2xl max-h-[90vh] overflow-auto">
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
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="submit">关闭</button>
          </form>
        </dialog>
      )}

      {editingId != null && editFormData && (
        <dialog
          open
          className="modal modal-open"
          onClose={() => {
            setEditingId(null);
            setEditFormData(null);
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setEditingId(null);
              setEditFormData(null);
            }
          }}
        >
          <div className="modal-box max-w-2xl max-h-[90vh] overflow-auto">
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
          </div>
          <form method="dialog" className="modal-backdrop">
            <button type="submit">关闭</button>
          </form>
        </dialog>
      )}
    </div>
  );
}
