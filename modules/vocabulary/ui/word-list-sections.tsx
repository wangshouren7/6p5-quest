"use client";

import { GridColsControl } from "@/modules/ui/grid-cols-control";
import { cn } from "@/modules/ui/jsx";
import { StripedGrid } from "@/modules/ui/striped-grid";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  AlertCircle,
  ImageDown,
  Maximize2,
  Minimize2,
  Pencil,
  Trash2,
} from "lucide-react";
import { useMemo, type ReactNode } from "react";
import type { IVocabularyEntryListItem } from "../core";

type ViewMode = "list" | "grid";

/** 工具栏右侧：网格时显示每行列数+全屏按钮，以及背诵乱序+背诵模式+听单词按钮。列数控件展示与当前视口有效列数一致。 */
export function WordListToolbarExtras({
  viewMode,
  gridCols,
  onGridColsChange,
  isGridFullscreen,
  onGridFullscreenChange,
  reciteShuffle,
  onReciteShuffleChange,
  reciteActive,
  listenActive,
  itemsLength,
  onStartRecite,
  onStartListen,
}: {
  viewMode: ViewMode;
  gridCols: number;
  onGridColsChange: (v: number) => void;
  isGridFullscreen: boolean;
  onGridFullscreenChange: (v: boolean) => void;
  reciteShuffle: boolean;
  onReciteShuffleChange: (v: boolean) => void;
  reciteActive: boolean;
  listenActive: boolean;
  itemsLength: number;
  onStartRecite: () => void;
  onStartListen: () => void;
}) {
  return (
    <>
      {viewMode === "grid" && (
        <>
          <GridColsControl value={gridCols} onChange={onGridColsChange} />
          <button
            type="button"
            className={cn(
              "btn btn-sm btn-ghost btn-square",
              isGridFullscreen && "btn-active",
            )}
            onClick={() => onGridFullscreenChange(!isGridFullscreen)}
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
          onChange={(e) => onReciteShuffleChange(e.target.checked)}
          disabled={reciteActive}
        />
        <span className="label-text whitespace-nowrap">背诵乱序</span>
      </label>
      <button
        type="button"
        className="btn btn-sm"
        disabled={itemsLength === 0 || reciteActive || listenActive}
        onClick={onStartRecite}
        title="背诵模式"
        aria-label="背诵模式"
      >
        背诵模式
      </button>
      <button
        type="button"
        className="btn btn-sm"
        disabled={itemsLength === 0 || reciteActive || listenActive}
        onClick={onStartListen}
        title="按顺序播放单词发音、拼写与中文释义"
        aria-label="听单词"
      >
        听单词
      </button>
    </>
  );
}

const columnHelper = createColumnHelper<IVocabularyEntryListItem>();

export interface WordListTableViewProps {
  items: IVocabularyEntryListItem[];
  onSelectEntry: (entry: IVocabularyEntryListItem) => void;
  onEdit: (entry: IVocabularyEntryListItem) => void;
  onDelete: (e: React.MouseEvent, id: number) => void;
  onForget?: (entryId: number) => void;
  deleteLoading: number | null;
}

export function WordListTableView({
  items,
  onSelectEntry,
  onEdit,
  onDelete,
  onForget,
  deleteLoading,
}: WordListTableViewProps) {
  const columns = useMemo(
    () => [
      columnHelper.accessor("word", {
        header: "单词",
        cell: ({ getValue }) => (
          <span className="font-medium">{getValue()}</span>
        ),
      }),
      columnHelper.accessor("phonetic", {
        header: "音标",
        cell: ({ getValue }) => (
          <span className="font-mono text-sm opacity-80">
            {getValue() ?? "—"}
          </span>
        ),
      }),
      columnHelper.accessor((row) => row.meanings, {
        id: "meanings",
        header: "词性/释义",
        cell: ({ getValue }) => {
          const meanings = getValue();
          const text =
            meanings
              .map(
                (m) =>
                  `${m.partOfSpeech} ${m.meanings.filter(Boolean).join("; ")}`,
              )
              .join(" | ") || "—";
          return (
            <span className="text-sm max-w-xs truncate block">{text}</span>
          );
        },
      }),
      columnHelper.accessor("categoryName", {
        header: "分类",
        cell: ({ getValue }) => (
          <span className="text-sm opacity-80">{getValue() ?? "—"}</span>
        ),
      }),
      columnHelper.accessor("forgetCount", {
        header: "遗忘",
        cell: ({ getValue }) => {
          const n = getValue() ?? 0;
          return (
            <span className="text-sm tabular-nums" title={`遗忘 ${n} 次`}>
              {n > 0 ? n : "—"}
            </span>
          );
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <span className="w-20 text-right block">操作</span>,
        cell: ({ row }) => {
          const entry = row.original;
          return (
            <div
              className="text-right"
              onClick={(e: React.MouseEvent) => e.stopPropagation()}
            >
              <div className="flex justify-end gap-1">
                {onForget && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs btn-square"
                    onClick={() => onForget(entry.id)}
                    title={
                      entry.forgetCount != null && entry.forgetCount > 0
                        ? `忘了 +1（当前 ${entry.forgetCount}）`
                        : "忘了 +1"
                    }
                    aria-label="忘了 +1"
                  >
                    <AlertCircle className="size-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square"
                  onClick={() => onEdit(entry)}
                  title="编辑"
                  aria-label="编辑"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-xs btn-square text-error"
                  onClick={(e) => onDelete(e, entry.id)}
                  disabled={deleteLoading === entry.id}
                  title="删除"
                  aria-label="删除"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          );
        },
      }),
    ],
    [onEdit, onDelete, onForget, deleteLoading],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto">
      <table className="table table-zebra table-sm">
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(
                    header.column.columnDef.header,
                    header.getContext(),
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              className="cursor-pointer hover:bg-base-300"
              onClick={() => onSelectEntry(row.original)}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface WordListGridWithFullscreenProps {
  gridCols: number;
  onGridColsChange: (v: number) => void;
  isGridFullscreen: boolean;
  fullscreenGridRef: React.RefObject<HTMLDivElement | null>;
  fullscreenDisplayMode: "full" | "word" | "wordMeaning";
  fullscreenHintOpacityLevel: number;
  onFullscreenHintOpacityLevelChange: (v: number) => void;
  onFullscreenDisplayModeChange: (v: "full" | "word" | "wordMeaning") => void;
  onExportImage: () => void;
  exportImageLoading: boolean;
  itemsLength: number;
  onCloseFullscreen: () => void;
  gridCardNodes: ReactNode;
  gridCardNodesWordOnly: ReactNode;
  gridCardNodesWordAndMeaning: ReactNode;
}

export function WordListGridWithFullscreen({
  gridCols,
  onGridColsChange,
  isGridFullscreen,
  fullscreenGridRef,
  fullscreenDisplayMode,
  fullscreenHintOpacityLevel,
  onFullscreenHintOpacityLevelChange,
  onFullscreenDisplayModeChange,
  onExportImage,
  exportImageLoading,
  itemsLength,
  onCloseFullscreen,
  gridCardNodes,
  gridCardNodesWordOnly,
  gridCardNodesWordAndMeaning,
}: WordListGridWithFullscreenProps) {
  return (
    <>
      {isGridFullscreen && (
        <div className="fixed inset-0 z-50 bg-base-100 flex flex-col">
          <div className="flex shrink-0 flex-col gap-2 border-b border-base-300 px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:px-4">
            <span className="font-medium shrink-0">单词网格</span>
            <div className="flex flex-wrap items-center gap-2 min-w-0 sm:gap-3">
              <button
                type="button"
                className="btn btn-sm btn-ghost shrink-0"
                onClick={onCloseFullscreen}
                aria-label="退出全屏"
              >
                <Minimize2 className="size-4 sm:mr-1" />
                <span>退出全屏</span>
              </button>
              <GridColsControl value={gridCols} onChange={onGridColsChange} />
              <div className="flex items-center gap-1.5 min-w-0 sm:gap-2">
                <span className="text-xs text-base-content/60 shrink-0 whitespace-nowrap hidden sm:inline">
                  提示透明度
                </span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={fullscreenHintOpacityLevel}
                  onChange={(e) =>
                    onFullscreenHintOpacityLevelChange(Number(e.target.value))
                  }
                  className="range range-primary range-xs w-14 sm:w-20"
                  title="调节分类、释义等提示的透明度"
                  aria-label="提示透明度"
                />
                <span className="text-xs text-base-content/50 tabular-nums w-5 text-right shrink-0 sm:w-6">
                  {fullscreenHintOpacityLevel}
                </span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0 sm:gap-2">
                <span className="text-sm text-base-content/70 shrink-0 hidden sm:inline">
                  展示：
                </span>
                <select
                  className="select select-sm select-bordered w-auto min-w-0 max-w-24 sm:max-w-none"
                  value={fullscreenDisplayMode}
                  onChange={(e) =>
                    onFullscreenDisplayModeChange(
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
                className="btn btn-sm btn-ghost shrink-0"
                onClick={onExportImage}
                disabled={exportImageLoading || itemsLength === 0}
                title="导出图片"
                aria-label="导出图片"
              >
                <ImageDown className="size-4 sm:mr-1" />
                <span className="hidden sm:inline">
                  {exportImageLoading ? "导出中…" : "导出图片"}
                </span>
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <StripedGrid
              ref={fullscreenGridRef}
              gridCols={gridCols}
              className="bg-base-100"
            >
              {fullscreenDisplayMode === "word"
                ? gridCardNodesWordOnly
                : fullscreenDisplayMode === "wordMeaning"
                  ? gridCardNodesWordAndMeaning
                  : gridCardNodes}
            </StripedGrid>
          </div>
        </div>
      )}
      <StripedGrid
        gridCols={gridCols}
        className={cn(
          "rounded-lg overflow-hidden border border-base-300",
          isGridFullscreen && "hidden",
        )}
      >
        {gridCardNodes}
      </StripedGrid>
    </>
  );
}
