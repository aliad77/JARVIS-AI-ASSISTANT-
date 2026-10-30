import { Eraser, Mic, MicOff, Plus, SendHorizontal, Square, Volume2, VolumeX } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { MathText } from "../../components/MathText";
import { Notice, PixelButton } from "../../components/ui";
import { Waveform } from "../../components/Waveform";
import type { MicState } from "../../hooks/useSpeechRecognition";
import { MessageBubble, type BubbleActions } from "./MessageBubble";
import type { ChatState } from "./useChat";

export interface VoiceControls {
  micState: MicState;
  interim: string;
  micError: string | null;
  startListening: () => void;
  stopListening: () => void;
  speaking: boolean;
  stopSpeaking: () => void;
  speak: (text: string) => void;
  ttsSupported: boolean;
  muted: boolean;
  toggleMute: () => void;
  voiceEnabled: boolean;
}

const SUGGESTIONS = ["Solve 3x + 7 = 22", "Explain photosynthesis", "What is 20% of 50?", "Quiz me on grade 8 science", "Open Roblox"];

export function ChatPanel({ chat, voice, actions, inputRef }: { chat: ChatState; voice: VoiceControls; actions: BubbleActions; inputRef: RefObject<HTMLTextAreaElement | null> }) {
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const listening = voice.micState === "listening";
  const busy = chat.thinking || chat.aiWriting !== null;

  useEffect(() => {
    listRef.current?.lastElementChild?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [chat.messages.length, chat.thinking, chat.aiWriting]);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (!draft.trim() || busy) return;
    void chat.send(draft);
    setDraft("");
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) submit(e);
  };

  const micUnavailable = !voice.voiceEnabled || voice.micState === "unsupported";
  const micTitle = !voice.voiceEnabled ? "Voice is turned off in Settings" : voice.micState === "unsupported" ? "Voice input isn't supported in this browser" : listening ? "Stop listening" : "Tap to talk (push-to-talk)";

  return (
    <section className="pixel-frame flex min-h-0 flex-1 flex-col p-3 sm:p-4" aria-label="Chat with JARVIS">
      <header className="mb-3 flex items-center gap-2">
        <h2 className="pixel-title min-w-0 flex-1 truncate text-[0.6rem] text-red">{chat.conversation?.title ?? "New mission"}</h2>
        <PixelButton onClick={chat.newConversation} aria-label="New conversation" className="h-10 px-3">
          <Plus size={14} aria-hidden /> <span className="hidden sm:inline">New</span>
        </PixelButton>
        <PixelButton onClick={chat.clearConversation} aria-label="Clear conversation" className="h-10 px-3" disabled={!chat.messages.length}>
          <Eraser size={14} aria-hidden /> <span className="hidden sm:inline">Clear</span>
        </PixelButton>
      </header>

      <ol ref={listRef} aria-live="polite" aria-label="Conversation" className="min-h-[240px] flex-1 space-y-3 overflow-y-auto overscroll-contain border-2 border-[#2a2438] bg-void/60 p-2.5 sm:p-4">
        {chat.messages.length === 0 && !busy && (
          <li className="py-6 text-center text-ink-dim">
            <p className="pixel-title text-[0.55rem] text-red-hi">No messages yet</p>
            <p className="mt-2 text-sm">Try one of these:</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => void chat.send(s)} className="min-h-10 cursor-pointer border-2 border-[#3a2f48] bg-deck px-3 py-2 text-sm text-ink hover:border-red">
                  {s}
                </button>
              ))}
            </div>
          </li>
        )}
        <AnimatePresence initial={false}>
          {chat.messages.map((m) => (
            <MessageBubble key={m.id} message={m} actions={{ ...actions, onSpeak: voice.ttsSupported ? voice.speak : undefined }} />
          ))}
        </AnimatePresence>
        {chat.thinking && (
          <li className="flex items-center gap-3 text-ink-dim" role="status">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <span key={i} className="wave-bar block h-3 w-3 bg-red" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </span>
            <span className="pixel-title text-[0.48rem]">JARVIS is thinking…</span>
          </li>
        )}
        {chat.aiWriting !== null && (
          <li className="border-2 border-dashed border-warn/50 bg-deck p-3" role="status" aria-label="On-device AI is writing">
            <p className="pixel-title mb-1 text-[0.46rem] text-warn">On-device AI is writing…</p>
            <MathText content={chat.aiWriting || "…"} className="text-sm" />
          </li>
        )}
      </ol>

      {voice.micError && (
        <div className="mt-2">
          <Notice tone="warn">{voice.micError}</Notice>
        </div>
      )}
      {(listening || voice.speaking) && (
        <div className="mt-2 flex items-center gap-2 border-2 border-red-deep bg-deck px-2 py-1">
          <Waveform active bars={12} label={listening ? "Listening" : "Speaking"} />
          <span className="pixel-title min-w-0 flex-1 truncate text-[0.48rem] text-red-hi">{listening ? voice.interim || "Listening… speak now" : "Speaking…"}</span>
          {voice.speaking && (
            <PixelButton onClick={voice.stopSpeaking} className="h-10 w-10 px-0" aria-label="Stop speaking">
              <Square size={12} aria-hidden />
            </PixelButton>
          )}
        </div>
      )}

      <form onSubmit={submit} className="mt-2 flex items-end gap-2">
        <label htmlFor="chat-input" className="sr-only">
          Message JARVIS
        </label>
        <textarea
          id="chat-input"
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          maxLength={2000}
          rows={1}
          enterKeyHint="send"
          placeholder="Ask JARVIS…"
          className="min-h-12 flex-1 resize-none border-2 border-[#3a2f48] bg-void px-3 py-3 text-base text-ink placeholder:text-ink-dim/70 focus:border-red focus:outline-none"
        />
        <PixelButton
          onClick={listening ? voice.stopListening : voice.startListening}
          disabled={micUnavailable || busy}
          aria-label={micTitle}
          title={micTitle}
          aria-pressed={listening}
          variant={listening ? "primary" : "ghost"}
          className="h-12 w-12 px-0"
        >
          {micUnavailable ? <MicOff size={18} /> : <Mic size={18} />}
        </PixelButton>
        <PixelButton onClick={voice.toggleMute} aria-label={voice.muted ? "Turn spoken answers on" : "Turn spoken answers off"} aria-pressed={!voice.muted} disabled={!voice.ttsSupported} className="hidden h-12 w-12 px-0 sm:inline-flex">
          {voice.muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </PixelButton>
        <PixelButton type="submit" variant="primary" disabled={!draft.trim() || busy} className="h-12 w-12 px-0 sm:w-auto sm:px-4" aria-label="Send message">
          <SendHorizontal size={16} aria-hidden /> <span className="hidden sm:inline">Send</span>
        </PixelButton>
      </form>
    </section>
  );
}
