/** Tailwind 默认断点：sm 640, md 768, lg 1024 */
const GRID_BREAKPOINTS = { sm: 640, md: 768, lg: 1024 } as const;

/**
 * 根据窗口宽度返回默认列数（仅作控件初始默认值，1–10）。
 * 小屏少列、大屏 4 列，与 getGridColsClass 配合使用。
 */
export function getDefaultGridColsForWidth(width: number): number {
  if (width < GRID_BREAKPOINTS.sm) return 1;
  if (width < GRID_BREAKPOINTS.md) return 2;
  if (width < GRID_BREAKPOINTS.lg) return 3;
  return 4;
}

/** 根据 gridCols（1–10）返回 Tailwind grid 类名，供 vocabulary / corpus 网格共用。 */
export function getGridColsClass(gridCols: number): string {
  const n = Math.min(10, Math.max(1, Math.round(gridCols)));
  const classes: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-2",
    3: "grid-cols-3",
    4: "grid-cols-4",
    5: "grid-cols-5",
    6: "grid-cols-6",
    7: "grid-cols-7",
    8: "grid-cols-8",
    9: "grid-cols-9",
    10: "grid-cols-10",
  };
  return classes[n] ?? "grid-cols-4";
}
