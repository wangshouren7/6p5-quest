"use client";

import { useEffect, useState } from "react";
import type { VoiceItem } from "./types";

export function useVoices(): VoiceItem[] {
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  useEffect(() => {
    const load = () =>
      setVoices(
        window.speechSynthesis
          .getVoices()
          .map((v) => ({ name: v.name, lang: v.lang })),
      );
    if (window.speechSynthesis.getVoices().length) load();
    else window.speechSynthesis.onvoiceschanged = load;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);
  return voices;
}
