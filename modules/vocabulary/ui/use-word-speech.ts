"use client";

import { useCallback } from "react";

/** 优先使用英式发音（en-GB）的浏览器语音；getVoices() 可能异步加载 */
function getPreferredVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const enGB =
    voices.find((v) => v.lang === "en-GB") ??
    voices.find((v) => v.lang.startsWith("en-GB"));
  const en = voices.find((v) => v.lang.startsWith("en"));
  return enGB ?? en ?? voices[0] ?? null;
}

export function useWordSpeech() {
  const speak = useCallback((word: string) => {
    const w = typeof word === "string" ? word.trim() : "";
    if (!w) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(w);
    u.lang = "en-GB";
    const voice = getPreferredVoice();
    if (voice) u.voice = voice;
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  }, []);

  return { speak };
}
