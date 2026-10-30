import { BookOpenCheck, Bot, Dumbbell, Monitor, Sparkles, Swords, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { MathText } from "../../components/MathText";
import { Notice, PixelButton } from "../../components/ui";
import { launchWindowsApp, WINDOWS_APPS } from "../../platform/desktop";
import type { ChatMessage } from "../../platform/storage";
import { RobloxLaunchCard } from "../roblox/RobloxLaunchCard";
import { MathResultCard } from "./MathResultCard";

export interface BubbleActions {
  onStartQuiz?: (subject: string, grade: number) => void;
  onPractice?: (topic: string) => void;
  onSpeak?: (text: string) => void;
}

export function MessageBubble({ message, actions = {} }: { message: ChatMessage; actions?: BubbleActions }) {
  const isUser = message.role === "user";
  const { meta } = message;
  const [pc, setPc] = useState<{ ok: boolean; text: string } | null>(null);
  const action = meta.action;

  return (
    <motion.li initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.16 }} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <article
        aria-label={isUser ? "You said" : "JARVIS said"}
        className={`w-fit max-w-[94%] sm:max-w-[82%] ${isUser ? "border-2 border-red-deep bg-red-deep/30 px-3.5 py-2.5" : "border-2 border-[#3a2f48] bg-deck px-3.5 py-3 shadow-[4px_4px_0_0_#0B0B10]"}`}
      >
        <p className={`pixel-title mb-1.5 flex items-center gap-2 text-[0.48rem] ${isUser ? "text-red-hi" : "text-red"}`}>
          {isUser ? (
            "PLAYER"
          ) : (
            <>
              <Sparkles size={11} aria-hidden /> JARVIS
              {meta.source === "curated" && <span className="text-ink-dim">· lesson</span>}
              {meta.source === "engine" && <span className="text-ink-dim">· math engine</span>}
              {meta.source === "local-ai" && <span className="text-warn">· on-device AI</span>}
            </>
          )}
          {!isUser && actions.onSpeak && (
            <button type="button" onClick={() => actions.onSpeak!(message.content)} className="ml-auto grid h-8 w-8 cursor-pointer place-items-center text-ink-dim hover:text-red-hi" aria-label="Read this answer aloud">
              <Volume2 size={15} />
            </button>
          )}
        </p>
        {isUser ? <p className="whitespace-pre-wrap break-words">{message.content}</p> : <MathText content={message.content} />}

        {meta.math && <MathResultCard result={meta.math} />}

        {meta.aiNote && (
          <section className="mt-3 border-2 border-dashed border-warn/50 bg-void/60 p-3" aria-label="On-device AI explanation">
            <p className="pixel-title mb-1 flex items-center gap-2 text-[0.46rem] text-warn">
              <Bot size={12} aria-hidden /> On-device AI says (can be wrong — the checked answer above wins)
            </p>
            <MathText content={meta.aiNote} className="text-sm" />
          </section>
        )}

        {action?.type === "roblox" && (
          <div className="mt-3">
            <RobloxLaunchCard placeId={action.placeId} placeName={action.placeName} compact />
          </div>
        )}
        {action?.type === "windows-launch" && (
          <div className="mt-3 space-y-2">
            <PixelButton variant="primary" onClick={() => void launchWindowsApp(action.appId).then((r) => setPc({ ok: r.ok, text: r.message }))}>
              <Monitor size={14} aria-hidden /> Open {WINDOWS_APPS[action.appId]} on this PC
            </PixelButton>
            {pc && <Notice tone={pc.ok ? "ok" : "warn"}>{pc.text}</Notice>}
          </div>
        )}
        {action?.type === "quiz" && actions.onStartQuiz && (
          <PixelButton variant="primary" className="mt-3" onClick={() => actions.onStartQuiz!(action.subject, action.grade)}>
            <Swords size={14} aria-hidden /> Start quiz
          </PixelButton>
        )}
        {!isUser && meta.practiceTopic && actions.onPractice && (
          <PixelButton className="mt-3 px-3 text-[0.5rem]" onClick={() => actions.onPractice!(meta.practiceTopic!)}>
            <Dumbbell size={13} aria-hidden /> Try a practice problem
          </PixelButton>
        )}
        {!isUser && meta.topicId && actions.onStartQuiz && (
          <PixelButton className="mt-3 ml-0 px-3 text-[0.5rem] sm:ml-2" onClick={() => actions.onStartQuiz!(`topic:${meta.topicId}`, 0)}>
            <BookOpenCheck size={13} aria-hidden /> Quick concept check
          </PixelButton>
        )}
      </article>
    </motion.li>
  );
}
