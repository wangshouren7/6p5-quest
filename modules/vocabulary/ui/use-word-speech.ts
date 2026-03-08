"use client";

import { useCallback, useEffect, useState } from "react";

/** * 语音偏好类型
 */
export type VoicePreference = "en-GB" | "en-US";

export function useWordSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredLang, setPreferredLang] = useState<VoicePreference>("en-GB");

  // 初始化和监听语音列表加载
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;

    const updateVoices = () => {
      const availableVoices = synth.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
      }
    };

    // 某些浏览器（如 Chrome）异步加载语音列表，需要监听此事件
    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = updateVoices;
    }

    // 立即尝试获取一次（Safari/Firefox 经常同步返回）
    updateVoices();

    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  /**
   * 核心发音函数
   */
  const speak = useCallback(
    (word: string, overrideLang?: VoicePreference) => {
      const text = word?.trim();
      if (!text || typeof window === "undefined" || !window.speechSynthesis)
        return;

      const synth = window.speechSynthesis;

      // 1. 立即停止当前所有发音
      // 注意：这会触发之前所有 utterance 的 'canceled' 错误
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      const targetLang = overrideLang || preferredLang;

      // 2. 寻找匹配的语音包
      // 优先级：精确匹配 (en-GB) -> 前缀匹配 (en-) -> 列表第一个
      const voice =
        voices.find(
          (v) =>
            v.lang === targetLang || v.lang === targetLang.replace("-", "_"),
        ) ||
        voices.find((v) => v.lang.startsWith("en-")) ||
        voices[0];

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = targetLang;
      }

      // 3. 参数调节
      utterance.rate = 0.9; // 稍微慢一点，听得更清楚
      utterance.pitch = 1.0;

      // 4. 错误处理（过滤掉正常的 cancel 报错）
      utterance.onerror = (event) => {
        if (event.error === "canceled") return;
        console.warn("SpeechSynthesis Error:", event.error);
      };

      // 5. 执行播放
      synth.speak(utterance);
    },
    [voices, preferredLang],
  );

  return {
    speak,
    preferredLang,
    setPreferredLang,
    isReady: voices.length > 0,
    availableVoicesCount: voices.length,
  };
}
