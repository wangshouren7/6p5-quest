"use client";

import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/**
 * 返回「已挂载后的当前主题」，避免 next-themes 在 SSR/水合前 resolvedTheme 为 undefined。
 * 官方推荐：依赖主题的 UI 应在 mounted 后再渲染，见
 * https://github.com/pacocoursey/next-themes#avoid-hydration-mismatch
 *
 * @returns mounted 为 false 时不要用 theme 做 UI（可渲染占位）；为 true 时 theme 为 "light" | "dark"
 */
export function useResolvedTheme(): {
  mounted: boolean;
  theme: "light" | "dark" | undefined;
} {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const { resolvedTheme } = useTheme();

  const theme =
    mounted && (resolvedTheme === "light" || resolvedTheme === "dark")
      ? resolvedTheme
      : undefined;

  return { mounted, theme };
}
