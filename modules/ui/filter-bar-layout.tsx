"use client";

import { cn } from "@/modules/ui/jsx";

export interface FilterBarCollapseProps {
  /** 折叠标题，如「单词筛选」 */
  title?: string;
  /** 是否默认展开 */
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

/** 筛选栏通用外壳：可折叠面板 + 单列布局（每行一个筛选项） */
export function FilterBarCollapse({
  title = "筛选",
  defaultOpen = false,
  children,
  className,
}: FilterBarCollapseProps) {
  return (
    <div
      className={cn(
        "collapse collapse-arrow rounded-lg border border-base-300 bg-base-200",
        defaultOpen && "collapse-open",
        className,
      )}
    >
      <input type="checkbox" aria-label="展开/收起筛选" />
      <div className="collapse-title min-h-0 py-2 font-medium">{title}</div>
      <div className="collapse-content">
        <div className="grid grid-cols-1 gap-y-4 pt-1 pb-2">{children}</div>
      </div>
    </div>
  );
}

export interface FilterFieldProps {
  /** 筛选项标签，显示在上方 */
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** 单行筛选项：上方标签 + 下方控件，与 SearchableMultiSelect 等布局一致 */
export function FilterField({ label, children, className }: FilterFieldProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <span className="label-text block mb-1">{label}</span>
      {children}
    </div>
  );
}
