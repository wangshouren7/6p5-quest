"use client";

import type { EnVoiceOption } from "@/modules/speech";
import { Square } from "lucide-react";

export interface ListenModeBarProps {
  listenIndex: number;
  listenTotal: number;
  enVoices: EnVoiceOption[];
  preferredVoiceName: string | null;
  preferredLang: string;
  onVoiceChange: (value: string | null) => void;
  onStop: () => void;
}

export function ListenModeBar({
  listenIndex,
  listenTotal,
  enVoices,
  preferredVoiceName,
  preferredLang,
  onVoiceChange,
  onStop,
}: ListenModeBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-base-300 bg-base-200 px-3 py-2">
      <span className="text-sm text-base-content/80">
        正在播放 第 {listenIndex + 1} / {listenTotal}
      </span>
      <label className="flex items-center gap-1.5 text-sm">
        <span className="text-base-content/60 shrink-0">英文语音</span>
        <select
          className="select select-sm select-bordered min-w-0 max-w-48"
          value={preferredVoiceName ?? ""}
          onChange={(e) => onVoiceChange(e.target.value || null)}
          aria-label="选择英文发音"
        >
          <option value="">默认（{preferredLang}）</option>
          {enVoices.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.name} ({opt.lang})
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="btn btn-sm btn-ghost"
        onClick={onStop}
        aria-label="停止"
      >
        <Square className="size-3.5 mr-1 inline" />
        停止
      </button>
    </div>
  );
}
