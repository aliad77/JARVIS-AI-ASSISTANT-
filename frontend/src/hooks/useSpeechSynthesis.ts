/** Spoken responses via the browser's SpeechSynthesis API (feature-detected). */
import { useCallback, useEffect, useState } from "react";
import { toSpeech } from "../components/MathText";

export function speechSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

export function useSpeechSynthesis({ rate, voiceName, lang }: { rate: number; voiceName: string; lang: string }) {
  const supported = speechSupported();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!supported) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, [supported]);

  const speak = useCallback(
    (content: string) => {
      if (!supported) return;
      const text = toSpeech(content).slice(0, 1500);
      if (!text) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.lang = lang;
      const voice = voices.find((v) => v.name === voiceName) ?? voices.find((v) => v.lang === lang);
      if (voice) u.voice = voice;
      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(u);
    },
    [supported, rate, lang, voiceName, voices],
  );

  return { supported, voices, speaking, speak, cancel };
}
