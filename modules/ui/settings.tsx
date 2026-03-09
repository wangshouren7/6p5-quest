"use client";

import { useBoolean } from "ahooks";
import { button, Leva, useControls } from "leva";
import { Settings as SettingsIcon } from "lucide-react";
import { levaDarkTheme, levaLightTheme } from "./leva-themes";
import { useResolvedTheme } from "./use-resolved-theme";

export function Settings() {
  const [open, { toggle }] = useBoolean(false);
  const { theme } = useResolvedTheme();
  const levaTheme =
    (theme ?? "light") === "light" ? levaLightTheme : levaDarkTheme;

  useControls({
    Close: button(toggle),
  });

  const isDark = (theme ?? "light") === "dark";

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-square text-base-content"
        aria-label="设置"
        onClick={toggle}
      >
        <SettingsIcon className="size-6" />
      </button>

      {/* 暗色下强制 Leva 面板内按钮等为浅色字，避免被全局 button 样式覆盖 */}
      <div className={isDark ? "text-white" : undefined}>
        <Leva hidden={!open} theme={levaTheme} />
      </div>
    </>
  );
}
