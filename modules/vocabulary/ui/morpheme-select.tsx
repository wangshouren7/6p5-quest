"use client";

import { cn } from "@/modules/ui/jsx";
import { normalizeWord } from "@/utils/string";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IMorphemeOption } from "../core";

const DROPDOWN_Z_INDEX = 100;

function formatMorphemeLabel(opt: IMorphemeOption): string {
  if (opt.meanings.length === 0) return opt.text;
  return `${opt.text} — ${opt.meanings.slice(0, 2).join("；")}`;
}

function matchQuery(opt: IMorphemeOption, q: string): boolean {
  if (!q.trim()) return true;
  const lower = normalizeWord(q);
  if (opt.text.toLowerCase().includes(lower)) return true;
  return opt.meanings.some((m) => m.toLowerCase().includes(lower));
}

interface MorphemeMultiSelectProps {
  options: IMorphemeOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  /** 最多展示的已选 tag 数量，超出显示「已选 N 项」；0 表示全部展示；默认 5 */
  maxVisibleTags?: number;
}

export function MorphemeMultiSelect({
  options,
  selectedIds,
  onChange,
  placeholder = "搜索并选择…",
  label,
  className,
  maxVisibleTags = 5,
}: MorphemeMultiSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => options.filter((o) => matchQuery(o, query)),
    [options, query],
  );

  const selected = useMemo(
    () => options.filter((o) => selectedIds.includes(o.id)),
    [options, selectedIds],
  );

  const visibleTags =
    maxVisibleTags <= 0 ? selected : selected.slice(0, maxVisibleTags);
  const overflowCount =
    maxVisibleTags > 0 && selected.length > maxVisibleTags
      ? selected.length - maxVisibleTags
      : 0;

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setDropdownRect(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    setDropdownRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  }, [open, filtered.length]);

  const handleSelect = useCallback(
    (id: number) => {
      if (selectedIds.includes(id)) {
        onChange(selectedIds.filter((x) => x !== id));
      } else {
        onChange([...selectedIds, id]);
      }
      setQuery("");
    },
    [onChange, selectedIds],
  );

  const handleRemove = useCallback(
    (id: number) => {
      onChange(selectedIds.filter((x) => x !== id));
    },
    [onChange, selectedIds],
  );

  const dropdownList =
    open && filtered.length > 0 && dropdownRect ? (
      <ul
        className="max-h-48 overflow-auto rounded-md border border-base-300 bg-base-100 shadow-lg"
        role="listbox"
        style={{
          position: "fixed",
          zIndex: DROPDOWN_Z_INDEX,
          top: dropdownRect.top,
          left: dropdownRect.left,
          width: dropdownRect.width,
        }}
      >
        {filtered.slice(0, 50).map((opt) => (
          <li
            key={opt.id}
            role="option"
            aria-selected={selectedIds.includes(opt.id)}
            className={cn(
              "px-3 py-2 text-sm cursor-pointer hover:bg-base-200 truncate",
              selectedIds.includes(opt.id) && "bg-base-200",
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(opt.id);
            }}
            title={formatMorphemeLabel(opt)}
          >
            {formatMorphemeLabel(opt)}
          </li>
        ))}
        {filtered.length > 50 && (
          <li className="px-3 py-1 text-xs text-base-content/60">
            仅显示前 50 条，请缩小搜索范围
          </li>
        )}
      </ul>
    ) : null;

  return (
    <div className={cn("space-y-1", className)}>
      {label && <span className="label-text block mb-1">{label}</span>}
      <div className="flex flex-wrap items-center gap-1">
        {visibleTags.map((opt) => (
          <span
            key={opt.id}
            className="badge badge-sm badge-outline gap-1 pr-0.5"
          >
            <span
              className="max-w-32 truncate"
              title={formatMorphemeLabel(opt)}
            >
              {opt.text}
              {opt.meanings.length > 0 && (
                <span className="opacity-70 ml-0.5">
                  — {opt.meanings.slice(0, 1).join("；")}
                </span>
              )}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle min-h-0 h-4 w-4 p-0"
              onClick={() => handleRemove(opt.id)}
              aria-label={`移除 ${opt.text}`}
            >
              ×
            </button>
          </span>
        ))}
        {overflowCount > 0 && (
          <span className="text-xs text-base-content/60">
            已选 {selected.length} 项
          </span>
        )}
        {selected.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => onChange([])}
            aria-label="清空已选"
          >
            清空
          </button>
        )}
      </div>
      <div className="relative" ref={triggerRef}>
        <input
          type="text"
          className="input input-bordered input-sm w-full"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>
      {dropdownList != null && createPortal(dropdownList, document.body)}
      {options.length === 0 && (
        <p className="text-sm text-base-content/60">暂无，可点右侧 AI 补全</p>
      )}
    </div>
  );
}

interface MorphemeSingleSelectProps {
  options: IMorphemeOption[];
  value: number | null;
  onChange: (id: number | null) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function MorphemeSingleSelect({
  options,
  value,
  onChange,
  placeholder = "搜索并选择…",
  label,
  className,
}: MorphemeSingleSelectProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const filtered = useMemo(
    () => options.filter((o) => matchQuery(o, query)),
    [options, query],
  );

  const selectedOpt = useMemo(
    () => options.find((o) => o.id === value),
    [options, value],
  );

  const handleSelect = useCallback(
    (id: number) => {
      onChange(id);
      setQuery("");
      setOpen(false);
    },
    [onChange],
  );

  return (
    <div className={cn("space-y-1", className)}>
      {label && <span className="label-text block mb-1">{label}</span>}
      {selectedOpt && !open && (
        <div className="flex items-center gap-2">
          <span
            className="badge badge-sm badge-outline max-w-full truncate"
            title={formatMorphemeLabel(selectedOpt)}
          >
            {selectedOpt.text}
            {selectedOpt.meanings.length > 0 && (
              <span className="opacity-70 ml-0.5">
                — {selectedOpt.meanings.slice(0, 1).join("；")}
              </span>
            )}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={() => onChange(null)}
          >
            清除
          </button>
        </div>
      )}
      <div className="relative">
        <input
          type="text"
          className="input input-bordered input-sm w-full"
          placeholder={selectedOpt ? "重新搜索" : placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && filtered.length > 0 && (
          <ul
            className="absolute z-10 mt-1 max-h-48 overflow-auto rounded-md border border-base-300 bg-base-100 shadow-lg w-full"
            role="listbox"
          >
            {filtered.slice(0, 50).map((opt) => (
              <li
                key={opt.id}
                role="option"
                aria-selected={value === opt.id}
                className={cn(
                  "px-3 py-2 text-sm cursor-pointer hover:bg-base-200 truncate",
                  value === opt.id && "bg-base-200",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelect(opt.id);
                }}
                title={formatMorphemeLabel(opt)}
              >
                {formatMorphemeLabel(opt)}
              </li>
            ))}
            {filtered.length > 50 && (
              <li className="px-3 py-1 text-xs text-base-content/60">
                仅显示前 50 条，请缩小搜索范围
              </li>
            )}
          </ul>
        )}
      </div>
      {options.length === 0 && (
        <p className="text-sm text-base-content/60">暂无，可点右侧 AI 补全</p>
      )}
    </div>
  );
}
