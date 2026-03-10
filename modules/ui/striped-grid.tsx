"use client";

import { cn } from "@/modules/ui/jsx";
import { getGridColsClass } from "@/utils/format";
import { Children, forwardRef, type ReactNode } from "react";

const STRIPE_ROW_EVEN = "bg-orange-50 dark:bg-orange-950/20";
const STRIPE_ROW_ODD = "bg-white dark:bg-base-200";

export interface StripedGridProps {
  /** 网格列数（1–10），与 getGridColsClass 一致 */
  gridCols: number;
  /** 网格容器的额外类名（如 border、rounded） */
  className?: string;
  children: ReactNode;
}

/**
 * 通用条纹网格：按行交替背景色（偶行橙调、奇行白/基色），语料库与词汇网格共用。
 */
export const StripedGrid = forwardRef<HTMLDivElement, StripedGridProps>(
  function StripedGrid({ gridCols, className, children }, ref) {
    const gridColsClass = getGridColsClass(gridCols);
    const items = Children.toArray(children);

    return (
      <div
        ref={ref}
        className={cn("grid p-0", gridColsClass, className)}
        role="list"
      >
        {items.map((child, index) => {
          const rowIndex = Math.floor(index / gridCols);
          const stripeClass =
            rowIndex % 2 === 0 ? STRIPE_ROW_EVEN : STRIPE_ROW_ODD;
          return (
            <div key={index} className={stripeClass}>
              {child}
            </div>
          );
        })}
      </div>
    );
  },
);
