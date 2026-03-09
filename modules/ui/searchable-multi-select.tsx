"use client";

import { cn } from "@/modules/ui/jsx";
import { normalizeWord } from "@/utils/string";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface SearchableMultiSelectOption<T extends string | number> {
  value: T;
  label: string;
}

export interface SearchableMultiSelectProps<T extends string | number> {
  options: SearchableMultiSelectOption<T>[];
  selected: T[];
  onChange: (selected: T[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  /** 最多展示的已选 tag 数量，超出显示「已选 N 项」；0 表示全部展示；默认 5 */
  maxVisibleTags?: number;
  /** 默认按 label 模糊匹配；返回 true 表示保留 */
  filterOption?: (
    option: SearchableMultiSelectOption<T>,
    query: string,
  ) => boolean;
}

function defaultFilterOption<T extends string | number>(
  option: SearchableMultiSelectOption<T>,
  query: string,
): boolean {
  if (!query.trim()) return true;
  const lower = normalizeWord(query);
  return option.label.toLowerCase().includes(lower);
}

const DROPDOWN_Z_INDEX = 100;

export function SearchableMultiSelect<T extends string | number>({
  options,
  selected,
  onChange,
  placeholder = "搜索并选择…",
  label,
  className,
  maxVisibleTags = 5,
  filterOption = defaultFilterOption,
}: SearchableMultiSelectProps<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [dropdownRect, setDropdownRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => options.filter((o) => filterOption(o, query)),
    [options, query, filterOption],
  );

  const selectedOptions = useMemo(
    () => options.filter((o) => selected.includes(o.value)),
    [options, selected],
  );

  const visibleTags =
    maxVisibleTags <= 0
      ? selectedOptions
      : selectedOptions.slice(0, maxVisibleTags);
  const overflowCount =
    maxVisibleTags > 0 && selectedOptions.length > maxVisibleTags
      ? selectedOptions.length - maxVisibleTags
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
    (value: T) => {
      if (selected.includes(value)) {
        onChange(selected.filter((x) => x !== value));
      } else {
        onChange([...selected, value]);
      }
      setQuery("");
    },
    [onChange, selected],
  );

  const handleRemove = useCallback(
    (value: T) => {
      onChange(selected.filter((x) => x !== value));
    },
    [onChange, selected],
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
            key={String(opt.value)}
            role="option"
            aria-selected={selected.includes(opt.value)}
            className={cn(
              "px-3 py-2 text-sm cursor-pointer hover:bg-base-200 truncate",
              selected.includes(opt.value) && "bg-base-200",
            )}
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelect(opt.value);
            }}
            title={opt.label}
          >
            {opt.label}
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
            key={String(opt.value)}
            className="badge badge-sm badge-outline gap-1 pr-0.5"
          >
            <span className="max-w-32 truncate" title={opt.label}>
              {opt.label}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-xs btn-circle min-h-0 h-4 w-4 p-0"
              onClick={() => handleRemove(opt.value)}
              aria-label={`移除 ${opt.label}`}
            >
              ×
            </button>
          </span>
        ))}
        {overflowCount > 0 && (
          <span className="text-xs text-base-content/60">
            已选 {selectedOptions.length} 项
          </span>
        )}
        {selectedOptions.length > 0 && (
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
    </div>
  );
}
