"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/** 语音偏好类型 */
export type VoicePreference = "en-GB" | "en-US";

export interface SpeakSegment {
  text: string;
  lang?: string;
}

/**
 * 各平台/浏览器上音质较好的 en-GB 发音名称（按优先级尝试）。
 * - Chrome：Google 云端英音，通常比本地更自然
 * - macOS：Daniel、Kate 为系统英音
 * - Windows：Microsoft 英音
 */
const PREFERRED_EN_GB_VOICE_NAMES = [
  "Arthur", // 部分 macOS
  "Google UK English Female",
  "Google UK English Male",
  "Microsoft Zira - English (United Kingdom)",
  "Microsoft George - English (United Kingdom)",
  "Microsoft Susan - English (United Kingdom)",
  "Eddy",
  "Arthur",
  "Karen",
  "Kate", // macOS 英音女
];

/**
 * en-US 优先名称（若以后切换美音可优先选这些）
 */
const PREFERRED_EN_US_VOICE_NAMES = [
  "Samantha", // macOS 美音女
  "Alex", // macOS 美音男
  "Google US English",
  "Microsoft Zira - English (United States)",
  "Microsoft David - English (United States)",
];

function pickVoice(
  voices: SpeechSynthesisVoice[],
  lang: string,
  preferredNames?: string[],
): SpeechSynthesisVoice | null {
  const normalized = lang.replace("_", "-");
  const langMatch = (v: SpeechSynthesisVoice) =>
    v.lang === normalized ||
    v.lang === lang ||
    v.lang.startsWith(normalized.split("-")[0] + "-");

  if (preferredNames?.length) {
    for (const name of preferredNames) {
      const v = voices.find(
        (x) => langMatch(x) && (x.name === name || x.name.includes(name)),
      );
      if (v) return v;
    }
  }

  return (
    voices.find(langMatch) ||
    voices.find((v) => v.lang.startsWith(normalized.split("-")[0])) ||
    null
  );
}

/** 供下拉框展示的英文语音项 */
export interface EnVoiceOption {
  name: string;
  lang: string;
  /** 用于 select value，name 可能重复故用 name+lang */
  value: string;
}

export function useWordSpeech() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preferredLang, setPreferredLang] = useState<VoicePreference>("en-GB");
  /** 听单词等场景下指定英文语音名称，为空则按 preferredLang + 优先级列表选择 */
  const [preferredVoiceName, setPreferredVoiceName] = useState<string | null>(
    null,
  );
  const sequenceCancelledRef = useRef(false);
  const sequenceIdRef = useRef(0);
  const preferredVoiceNameRef = useRef<string | null>(null);
  useEffect(() => {
    preferredVoiceNameRef.current = preferredVoiceName;
  }, [preferredVoiceName]);

  /** 仅英国（en-GB）与美国（en-US）英文语音，供下拉框使用 */
  const enVoices: EnVoiceOption[] = useMemo(() => {
    const list = voices.filter(
      (v) => v.lang.startsWith("en-GB") || v.lang.startsWith("en-US"),
    );
    return list.map((v) => ({
      name: v.name,
      lang: v.lang,
      value: `${v.name}\n${v.lang}`,
    }));
  }, [voices]);

  /** 每次调用时读取当前 ref，使播放中切换下拉框能对下一段生效 */
  const getEnglishVoice = useCallback((): SpeechSynthesisVoice | null => {
    const current = preferredVoiceNameRef.current;
    if (current && voices.length > 0) {
      const v = voices.find(
        (x) =>
          (x.lang.startsWith("en-GB") || x.lang.startsWith("en-US")) &&
          `${x.name}\n${x.lang}` === current,
      );
      if (v) return v;
    }
    return pickVoice(
      voices,
      preferredLang,
      preferredLang === "en-GB"
        ? PREFERRED_EN_GB_VOICE_NAMES
        : PREFERRED_EN_US_VOICE_NAMES,
    );
  }, [voices, preferredLang]);

  // 初始化和监听语音列表加载
  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const synth = window.speechSynthesis;

    const updateVoices = () => {
      const availableVoices = synth.getVoices();
      if (availableVoices.length > 0) {
        setVoices(availableVoices);
        console.log(
          "[Speech] 浏览器支持的声音列表:",
          availableVoices.map((v) => ({
            name: v.name,
            lang: v.lang,
            localService: v.localService,
            default: v.default,
          })),
        );
      }
    };

    if (synth.onvoiceschanged !== undefined) {
      synth.onvoiceschanged = updateVoices;
    }
    updateVoices();

    return () => {
      synth.onvoiceschanged = null;
    };
  }, []);

  /**
   * 按指定语言朗读任意文本（用于中文释义等）
   */
  const speakText = useCallback(
    (text: string, options?: { lang?: string }) => {
      const t = text?.trim();
      if (!t || typeof window === "undefined" || !window.speechSynthesis)
        return;

      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(t);
      const targetLang = options?.lang ?? preferredLang;

      const voice = targetLang.startsWith("zh")
        ? (pickVoice(voices, "zh-CN") ?? pickVoice(voices, "zh-TW") ?? null)
        : (getEnglishVoice() ??
          voices.find((v) => v.lang.startsWith("en-")) ??
          voices[0] ??
          null);

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
        console.log(
          "[Speech] 当前播放使用的声音:",
          voice.name,
          "lang:",
          voice.lang,
        );
      } else {
        utterance.lang = targetLang;
        console.log(
          "[Speech] 当前播放使用的声音: (未匹配到语音，使用系统默认) lang:",
          targetLang,
        );
      }

      utterance.rate = 0.9;
      utterance.pitch = 1.0;
      utterance.onerror = (event) => {
        if (event.error === "canceled") return;
        console.warn("SpeechSynthesis Error:", event.error);
      };
      synth.speak(utterance);
    },
    [voices, preferredLang, getEnglishVoice],
  );

  /**
   * 串行播放多段文本，全部结束后调用 onAllEnd。支持 cancelSequence 中止。
   */
  const speakSequence = useCallback(
    (segments: SpeakSegment[], onAllEnd?: () => void) => {
      if (
        typeof window === "undefined" ||
        !window.speechSynthesis ||
        segments.length === 0
      ) {
        onAllEnd?.();
        return;
      }

      const synth = window.speechSynthesis;
      synth.cancel();
      sequenceCancelledRef.current = false;
      const myId = ++sequenceIdRef.current;

      let index = 0;

      const playNext = () => {
        if (sequenceCancelledRef.current || sequenceIdRef.current !== myId)
          return;
        if (index >= segments.length) {
          onAllEnd?.();
          return;
        }

        const seg = segments[index];
        const text = seg.text?.trim();
        index += 1;

        if (!text) {
          playNext();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(text);
        const targetLang = seg.lang ?? preferredLang;

        const voice = targetLang.startsWith("zh")
          ? (pickVoice(voices, "zh-CN") ?? pickVoice(voices, "zh-TW") ?? null)
          : (getEnglishVoice() ??
            voices.find((v) => v.lang.startsWith("en-")) ??
            voices[0] ??
            null);

        if (voice) {
          utterance.voice = voice;
          utterance.lang = voice.lang;
          console.log(
            "[Speech] 当前播放使用的声音:",
            voice.name,
            "lang:",
            voice.lang,
          );
        } else {
          utterance.lang = targetLang;
          console.log(
            "[Speech] 当前播放使用的声音: (未匹配到语音，使用系统默认) lang:",
            targetLang,
          );
        }

        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.onerror = (event) => {
          if (event.error === "canceled") return;
          console.warn("SpeechSynthesis Error:", event.error);
        };
        utterance.onend = () => {
          if (sequenceCancelledRef.current || sequenceIdRef.current !== myId)
            return;
          playNext();
        };
        synth.speak(utterance);
      };

      playNext();
    },
    [voices, preferredLang, getEnglishVoice],
  );

  const cancelSequence = useCallback(() => {
    sequenceCancelledRef.current = true;
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }, []);

  /**
   * 核心发音函数（单次，会先 cancel 当前）
   */
  const speak = useCallback(
    (word: string, overrideLang?: VoicePreference) => {
      speakText(word, { lang: overrideLang ?? preferredLang });
    },
    [speakText, preferredLang],
  );

  return {
    speak,
    speakText,
    speakSequence,
    cancelSequence,
    preferredLang,
    setPreferredLang,
    enVoices,
    preferredVoiceName,
    setPreferredVoiceName,
    isReady: voices.length > 0,
    availableVoicesCount: voices.length,
  };
}
