import { MotionConfig } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { BottomNav, Header, type Page } from "./components/Header";
import type { AvatarState } from "./components/PixelAvatar";
import type { QuickAction } from "./components/QuickActions";
import { ChatPanel, type VoiceControls } from "./features/chat/ChatPanel";
import { useChat } from "./features/chat/useChat";
import { useJarvis } from "./hooks/useJarvis";
import { useSound } from "./hooks/useSound";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import { HistoryPage } from "./pages/HistoryPage";
import { HomePage } from "./pages/HomePage";
import { LearnPage, type LearnTab } from "./pages/LearnPage";
import { QuizzesPage, type QuizRequest } from "./pages/QuizzesPage";
import { RobloxPage } from "./pages/RobloxPage";
import { SettingsPage } from "./pages/SettingsPage";

const PAGES: Page[] = ["home", "chat", "learn", "quiz", "roblox", "history", "settings"];

export default function App() {
  const { prefs, updatePrefs } = useJarvis();
  const [page, setPageState] = useState<Page>("home");
  const [learnTab, setLearnTab] = useState<LearnTab>("math");
  const [practiceTopic, setPracticeTopic] = useState<string | undefined>();
  const [quizRequest, setQuizRequest] = useState<QuizRequest | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const setPage = useCallback((p: Page) => {
    setPageState(p);
    window.scrollTo?.({ top: 0 });
  }, []);

  const chat = useChat(useCallback((p: string) => PAGES.includes(p as Page) && setPage(p as Page), [setPage]));
  const sfx = useSound(prefs.soundEffects);
  const tts = useSpeechSynthesis({ rate: prefs.voiceRate, voiceName: prefs.voiceName, lang: prefs.voiceLang });

  const reducedMotion = prefs.reducedMotion;
  useEffect(() => {
    document.documentElement.dataset.reducedMotion = String(reducedMotion);
  }, [reducedMotion]);

  const send = useCallback(
    async (text: string, viaVoice = false) => {
      tts.cancel();
      sfx("send");
      const reply = await chat.send(text);
      if (!reply) return;
      sfx("receive");
      if (viaVoice && !prefs.muteResponses) tts.speak(reply.meta.aiNote ? `${reply.content}\n${reply.meta.aiNote}` : reply.content);
    },
    [chat, prefs.muteResponses, sfx, tts],
  );

  const stt = useSpeechRecognition({
    lang: prefs.voiceLang,
    onFinal: (text) => {
      setPage("chat");
      void send(text, true);
    },
  });

  const startQuiz = useCallback(
    (subject: string, grade: number) => {
      setQuizRequest({ subject, grade, nonce: Date.now() });
      setPage("quiz");
    },
    [setPage],
  );

  const onQuickAction = (a: QuickAction) => {
    sfx("click");
    switch (a) {
      case "roblox":
        setPage("roblox");
        break;
      case "study":
        setPage("chat");
        window.setTimeout(() => inputRef.current?.focus(), 50);
        break;
      case "math":
        setLearnTab("math");
        setPage("learn");
        break;
      case "science":
        setLearnTab("science");
        setPage("learn");
        break;
      case "voice":
        setPage("chat");
        stt.start(); // still inside the tap handler: a real user gesture
        break;
      case "quizzes":
        setQuizRequest(null);
        setPage("quiz");
        break;
    }
  };

  const avatarState: AvatarState = stt.state === "listening" ? "listening" : chat.thinking || chat.aiWriting !== null ? "thinking" : tts.speaking ? "speaking" : "idle";

  const voice: VoiceControls = {
    micState: stt.state,
    interim: stt.interim,
    micError: stt.error,
    startListening: stt.start,
    stopListening: stt.stop,
    speaking: tts.speaking,
    stopSpeaking: tts.cancel,
    speak: tts.speak,
    ttsSupported: tts.supported,
    muted: prefs.muteResponses,
    toggleMute: () => updatePrefs({ muteResponses: !prefs.muteResponses }),
    voiceEnabled: prefs.voiceEnabled,
  };

  return (
    <MotionConfig reducedMotion={reducedMotion ? "always" : "user"}>
      <div className="scanline" aria-hidden />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-red focus:p-2 focus:text-void">
        Skip to content
      </a>
      <Header page={page} onNavigate={setPage} />
      <main id="main" className={`mx-auto max-w-7xl px-3 pt-4 pb-[calc(6rem+env(safe-area-inset-bottom))] sm:px-4 md:pb-8 ${page === "chat" ? "flex h-[calc(100dvh-7.5rem)] flex-col md:h-[calc(100dvh-8.5rem)]" : ""}`}>
        {page === "home" && <HomePage avatarState={avatarState} onQuickAction={onQuickAction} voiceAvailable={prefs.voiceEnabled && stt.supported} />}
        {page === "chat" && (
          <ChatPanel
            chat={chat}
            voice={voice}
            inputRef={inputRef}
            actions={{
              onStartQuiz: startQuiz,
              onPractice: (topic) => {
                setPracticeTopic(topic);
                setLearnTab("math");
                setPage("learn");
              },
            }}
          />
        )}
        {page === "learn" && <LearnPage tab={learnTab} onTab={setLearnTab} initialPractice={practiceTopic} onQuizTopic={(id) => startQuiz(`topic:${id}`, prefs.grade)} />}
        {page === "quiz" && <QuizzesPage request={quizRequest} onSfx={sfx} />}
        {page === "roblox" && <RobloxPage />}
        {page === "history" && (
          <HistoryPage
            activeId={chat.conversation?.id ?? null}
            onOpen={(id) => {
              chat.loadConversation(id);
              setPage("chat");
            }}
          />
        )}
        {page === "settings" && <SettingsPage voices={tts.voices} ttsSupported={tts.supported} sttSupported={stt.supported} onNavigate={setPage} />}
      </main>
      <BottomNav page={page} onNavigate={setPage} />
    </MotionConfig>
  );
}
