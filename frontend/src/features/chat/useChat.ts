/**
 * Chat state. Answers come from the offline brain; when the user has loaded a
 * local model, it adds a clearly-labelled explanation underneath. If the model
 * fails or isn't available, the checked answer is unaffected.
 */
import { useCallback, useRef, useState } from "react";
import { mathExplainPrompt, openChatPrompt, rephrasePrompt } from "../../ai/prompts";
import { respond } from "../../engine/brain";
import { useJarvis } from "../../hooks/useJarvis";
import type { ChatMessage, Conversation } from "../../platform/storage";

export interface ChatState {
  conversation: Conversation | null;
  messages: ChatMessage[];
  thinking: boolean;
  aiWriting: string | null; // streaming local-AI text
  send: (text: string) => Promise<ChatMessage | null>;
  newConversation: () => void;
  clearConversation: () => void;
  loadConversation: (id: string) => void;
}

export function useChat(onOpenPage?: (page: string) => void): ChatState {
  const { store, prefs, updatePrefs, bridge, ai } = useJarvis();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const [aiWriting, setAiWriting] = useState<string | null>(null);
  const convRef = useRef<Conversation | null>(null);
  convRef.current = conversation;
  const busy = useRef(false);

  const send = useCallback(
    async (raw: string) => {
      const text = raw.trim().slice(0, 2000);
      if (!text || busy.current) return null;
      busy.current = true;
      setThinking(true);
      try {
        let conv = convRef.current;
        if (!conv) {
          conv = store.createConversation(text.replace(/\s+/g, " ").slice(0, 57), prefs.grade);
          setConversation(conv);
          convRef.current = conv;
        }
        const userMsg = store.addMessage(conv.id, { role: "user", content: text, meta: {} });
        setMessages((m) => [...m, userMsg]);

        // Yield so the UI shows the user's message before computing.
        await new Promise((r) => setTimeout(r, 0));
        const reply = respond(text, { grade: prefs.grade, savedPlaces: prefs.robloxPlaces, windowsLaunch: bridge.canLaunchWindowsApps });
        if (reply.settings?.grade) updatePrefs({ grade: reply.settings.grade as 7 });
        if (reply.settings?.open) onOpenPage?.(reply.settings.open);

        let content = reply.content;
        const meta = { ...reply.meta };
        if (reply.aiTask && prefs.localAI.enabled && ai.ready) {
          setThinking(false);
          setAiWriting("");
          try {
            const grade = prefs.grade;
            const history = [...messages, userMsg].slice(-6).map((m) => ({ role: m.role, content: m.content.slice(0, 1200) }));
            const turns =
              reply.aiTask.kind === "math"
                ? mathExplainPrompt(grade, text, reply.aiTask.reference)
                : reply.aiTask.kind === "rephrase"
                  ? rephrasePrompt(grade, text, reply.aiTask.reference)
                  : openChatPrompt(grade, history);
            const aiText = await ai.generate(turns, { onToken: setAiWriting });
            if (aiText) {
              if (reply.aiTask.kind === "open") {
                content = `${aiText}\n\n_(Written by the on-device AI. It can be wrong — check important facts with a teacher.)_`;
                meta.source = "local-ai";
              } else {
                meta.aiNote = aiText;
              }
            }
          } catch {
            meta.aiNote = undefined; // keep the checked answer; the model failed quietly
          } finally {
            setAiWriting(null);
          }
        }
        const botMsg = store.addMessage(conv.id, { role: "assistant", content, meta });
        setMessages((m) => [...m, botMsg]);
        return botMsg;
      } finally {
        busy.current = false;
        setThinking(false);
      }
    },
    [store, prefs, updatePrefs, bridge.canLaunchWindowsApps, ai, messages, onOpenPage],
  );

  const newConversation = useCallback(() => {
    setConversation(null);
    setMessages([]);
  }, []);

  const clearConversation = useCallback(() => {
    if (convRef.current) store.deleteConversation(convRef.current.id);
    newConversation();
  }, [store, newConversation]);

  const loadConversation = useCallback(
    (id: string) => {
      const conv = store.listConversations().find((c) => c.id === id);
      if (!conv) return;
      setConversation(conv);
      setMessages(store.getMessages(id));
    },
    [store],
  );

  return { conversation, messages, thinking, aiWriting, send, newConversation, clearConversation, loadConversation };
}
