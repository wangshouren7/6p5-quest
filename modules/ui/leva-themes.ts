/** Leva 主题片段（colors + shadows），供 Leva 的 theme prop 使用 */
type LevaThemeSlice = {
  colors: Record<string, string>;
  shadows?: Record<string, string>;
};

/** 蓝底按钮上的文字色（Leva 按钮非 disabled 时为 color: highlight3 + backgroundColor: accent2），亮/暗主题均用白字 */
const LEVA_TEXT_ON_ACCENT = "#ffffff";

/** Leva 暗色主题（与默认一致，用于显式传入） */
export const levaDarkTheme: LevaThemeSlice = {
  colors: {
    elevation1: "#292d39",
    elevation2: "#181c20",
    elevation3: "#373c4b",
    accent1: "#0066dc",
    accent2: "#007bff",
    accent3: "#3c93ff",
    highlight1: "#535760",
    highlight2: "#8c92a4",
    /** 按钮等前景文字（蓝底上的白字） */
    highlight3: LEVA_TEXT_ON_ACCENT,
    vivid1: "#ffcc00",
    folderWidgetColor: "#8c92a4",
    folderTextColor: LEVA_TEXT_ON_ACCENT,
    toolTipBackground: LEVA_TEXT_ON_ACCENT,
    toolTipText: "#181c20",
  },
  shadows: {
    level1: "0 0 9px 0 #00000088",
    level2: "0 4px 14px #00000033",
  },
};

/** Leva 亮色主题，随页面 light 主题使用 */
export const levaLightTheme: LevaThemeSlice = {
  colors: {
    elevation1: "#e5e7eb",
    elevation2: "#f3f4f6",
    elevation3: "#ffffff",
    accent1: "#2563eb",
    accent2: "#3b82f6",
    accent3: "#60a5fa",
    highlight1: "#9ca3af",
    highlight2: "#6b7280",
    /** 按钮文字（蓝底上的白字），与暗色主题一致 */
    highlight3: LEVA_TEXT_ON_ACCENT,
    vivid1: "#d97706",
    folderWidgetColor: "#6b7280",
    folderTextColor: "#111827",
    toolTipBackground: "#111827",
    toolTipText: "#f9fafb",
  },
  shadows: {
    level1: "0 0 9px 0 #00000022",
    level2: "0 4px 14px #00000018",
  },
};
