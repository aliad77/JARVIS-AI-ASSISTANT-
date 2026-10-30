/**
 * Push-to-talk speech recognition using the browser's Web Speech API.
 *
 * - Feature-detected: browsers without SpeechRecognition get state "unsupported".
 * - The microphone is only used after an explicit start() from a user click.
 * - Recognition is single-shot (continuous = false); there is no always-on listening.
 * - Note: in Chrome and Edge, recognition audio is processed by the browser
 *   vendor's online speech service.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "unsupported" | "idle" | "listening" | "denied" | "error";

interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface RecognitionErrorEvent {
  error: string;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

export function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "Microphone permission was blocked. Allow the microphone for this page in your browser settings.",
  "service-not-allowed": "Speech recognition isn't allowed in this browser. You can still type!",
  "no-speech": "I didn't hear anything. Click the mic and try again.",
  "audio-capture": "No microphone was found. Check that one is plugged in.",
  network: "Speech recognition needs an internet connection in this browser.",
  aborted: "",
};

export function useSpeechRecognition({ lang, onFinal }: { lang: string; onFinal: (text: string) => void }) {
  const Ctor = getRecognitionCtor();
  const [state, setState] = useState<MicState>(Ctor ? "idle" : "unsupported");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<Recognition | null>(null);
  const finalRef = useRef("");
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  const stop = useCallback(() => {
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    if (!Ctor) return;
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    finalRef.current = "";
    setInterim("");
    setError(null);
    rec.onstart = () => setState("listening");
    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalRef.current += r[0].transcript;
        else interimText += r[0].transcript;
      }
      setInterim((finalRef.current + " " + interimText).trim());
    };
    rec.onerror = (e) => {
      const msg = ERROR_TEXT[e.error] ?? "Voice input had a problem. You can keep typing instead.";
      if (msg) setError(msg);
      setState(e.error === "not-allowed" || e.error === "service-not-allowed" ? "denied" : "error");
    };
    rec.onend = () => {
      recRef.current = null;
      setState((s) => (s === "listening" ? "idle" : s));
      const text = finalRef.current.trim();
      setInterim("");
      if (text) onFinalRef.current(text);
    };
    recRef.current = rec;
    try {
      rec.start();
    } catch {
      setState("error");
      setError("Voice input couldn't start. Try again in a moment.");
    }
  }, [Ctor, lang]);

  useEffect(() => () => recRef.current?.abort(), []);

  return { state, interim, error, start, stop, supported: Boolean(Ctor), clearError: () => setError(null) };
}
