import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, LIMITS, LocalStore, MemoryStorage, sanitizePrefs } from "../platform/storage";

describe("local persistence", () => {
  it("persists preferences and history across a 'restart' (new store, same storage)", () => {
    const kv = new MemoryStorage();
    const a = new LocalStore(kv);
    a.setPrefs({ grade: 11, voiceRate: 1.4 });
    const conv = a.createConversation("Photosynthesis", 11);
    a.addMessage(conv.id, { role: "user", content: "Explain photosynthesis", meta: {} });
    a.addQuizAttempt({ title: "Q", subject: "math", grade: 11, score: 3, total: 5 });

    const b = new LocalStore(kv);
    expect(b.getPrefs()).toMatchObject({ grade: 11, voiceRate: 1.4 });
    expect(b.listConversations()[0]).toMatchObject({ id: conv.id, messageCount: 1 });
    expect(b.getMessages(conv.id)[0].content).toBe("Explain photosynthesis");
    expect(b.getProgress()).toEqual([{ subject: "math", correct: 3, attempted: 5 }]);
  });

  it("validates and repairs stored preferences", () => {
    expect(sanitizePrefs({ grade: 99, voiceRate: 50, voiceLang: "<script>", robloxPlaces: [{ name: "x", placeId: "javascript:alert(1)" }, { name: "ok", placeId: "123" }] })).toMatchObject({
      grade: DEFAULT_PREFS.grade,
      voiceRate: 1,
      voiceLang: "en-US",
      robloxPlaces: [{ name: "ok", placeId: "123" }],
    });
    const kv = new MemoryStorage();
    kv.setItem("jarvis.v2.prefs", "{not json");
    expect(new LocalStore(kv).getPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("caps conversations and messages", () => {
    const s = new LocalStore(new MemoryStorage());
    let last = "";
    for (let i = 0; i < LIMITS.conversations + 5; i++) last = s.createConversation(`c${i}`, 7).id;
    expect(s.listConversations().length).toBe(LIMITS.conversations);
    for (let i = 0; i < LIMITS.messagesPerConversation + 10; i++) s.addMessage(last, { role: "user", content: `m${i}`, meta: {} });
    const msgs = s.getMessages(last);
    expect(msgs.length).toBe(LIMITS.messagesPerConversation);
    expect(msgs.at(-1)?.content).toBe(`m${LIMITS.messagesPerConversation + 9}`);
    expect(s.addMessage(last, { role: "user", content: "x".repeat(20000), meta: {} }).content.length).toBe(LIMITS.messageChars);
  });

  it("prunes the oldest conversation when storage is full instead of failing", () => {
    const kv = new MemoryStorage();
    kv.quota = 6000;
    const s = new LocalStore(kv);
    const first = s.createConversation("first", 7);
    s.addMessage(first.id, { role: "user", content: "a".repeat(3200), meta: {} });
    const second = s.createConversation("second", 7);
    s.addMessage(second.id, { role: "user", content: "b".repeat(3200), meta: {} });
    expect(s.getMessages(second.id).length).toBe(1);
    expect(s.listConversations().some((c) => c.id === first.id)).toBe(false);
  });

  it("stores nothing when history saving is off", () => {
    const kv = new MemoryStorage();
    const s = new LocalStore(kv);
    s.setPrefs({ saveHistory: false });
    const c = s.createConversation("secret", 7);
    s.addMessage(c.id, { role: "user", content: "hello", meta: {} });
    expect(s.listConversations()).toEqual([]);
    expect(s.getMessages(c.id)).toEqual([]);
  });

  it("deletes individual conversations and everything", () => {
    const kv = new MemoryStorage();
    const s = new LocalStore(kv);
    const a = s.createConversation("a", 7);
    s.createConversation("b", 7);
    s.deleteConversation(a.id);
    expect(s.listConversations().map((c) => c.title)).toEqual(["b"]);
    s.clearAll();
    expect(kv.length).toBe(0);
  });

  it("drops malformed messages", () => {
    const kv = new MemoryStorage();
    const s = new LocalStore(kv);
    const c = s.createConversation("t", 7);
    kv.setItem(`jarvis.v2.conv.${c.id}`, JSON.stringify([{ role: "hacker" }, { id: "1", role: "user", content: "ok", meta: {}, createdAt: "x" }]));
    expect(s.getMessages(c.id).map((m) => m.content)).toEqual(["ok"]);
  });
});
