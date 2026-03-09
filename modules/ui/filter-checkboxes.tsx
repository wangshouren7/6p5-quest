"use client";

import { cn } from "@/modules/ui/jsx";

export interface FilterCheckboxesProps<T extends string | number> {
  label: string;
  options: T[];
  selected: T[];
  onToggle: (value: T) => void;
  onReset?: () => void;
  renderOption: (value: T) => string;
  /** 最多展示的选项数，0 表示全部；默认 20 */
  maxVisible?: number;
  disabled?: boolean;
  /** label 宽度类名，默认 w-14 */
  labelWidth?: string;
}

export function FilterCheckboxes<T extends string | number>({
  label,
  options,
  selected,
  onToggle,
  onReset,
  renderOption,
  maxVisible = 20,
  disabled = false,
  labelWidth = "w-14",
}: FilterCheckboxesProps<T>) {
  const visible = maxVisible <= 0 ? options : options.slice(0, maxVisible);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={cn("label-text shrink-0", labelWidth)}>{label}</span>
      <div className="flex flex-wrap gap-1">
        {visible.map((value) => (
          <label key={String(value)} className="label cursor-pointer gap-1">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={selected.includes(value)}
              onChange={() => onToggle(value)}
              disabled={disabled}
            />
            <span className="label-text text-xs">{renderOption(value)}</span>
          </label>
        ))}
        {maxVisible > 0 && options.length > maxVisible && (
          <span className="text-xs text-base-content/60">
            等 {options.length} 项
          </span>
        )}
        {onReset && (
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={onReset}
            disabled={disabled}
            aria-label={`清空${label}`}
          >
            清空
          </button>
        )}
      </div>
    </div>
  );
}
