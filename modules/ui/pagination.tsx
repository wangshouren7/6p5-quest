"use client";

import { cn } from "@/modules/ui/jsx";

export interface PaginationBarProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  pageSizeOptions?: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
}

const DEFAULT_PAGE_SIZE_OPTIONS = [50, 200, 300, 500];

export function PaginationBar({
  page,
  totalPages,
  total,
  pageSize,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationBarProps) {
  const currentPage = page ?? 1;
  return (
    <div className={cn("flex flex-wrap items-center gap-3", className)}>
      <span className="text-sm text-base-content/70">
        共 {total} 条，第 {currentPage} / {totalPages} 页
      </span>
      <div className="join">
        <button
          type="button"
          className="btn btn-sm join-item"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="上一页"
        >
          «
        </button>
        <button
          type="button"
          className="btn btn-sm join-item btn-disabled"
          aria-hidden
        >
          {currentPage}
        </button>
        <button
          type="button"
          className="btn btn-sm join-item"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="下一页"
        >
          »
        </button>
      </div>
      {onPageSizeChange != null && pageSize != null && (
        <select
          className="select select-bordered select-sm w-full min-w-0 sm:w-28"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="每页条数"
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}/页
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
