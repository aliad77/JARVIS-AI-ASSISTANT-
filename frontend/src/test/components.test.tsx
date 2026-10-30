import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { LocalAI, MODELS, type EngineLike } from "../ai/localModel";
import { PixelAvatar } from "../components/PixelAvatar";
import { QuickActions } from "../components/QuickActions";
import { MathResultCard } from "../features/chat/MathResultCard";
import { MessageBubble } from "../features/chat/MessageBubble";
import { JarvisProvider } from "../hooks/useJarvis";
import { NO_BRIDGE } from "../platform/desktop";
import { LocalStore, MemoryStorage } from "../platform/storage";

function renderApp(opts: { ai?: LocalAI; store?: LocalStore } = {}) {
  const store = opts.store ?? new LocalStore(new MemoryStorage());
  const ai = opts.ai ?? new LocalAI(async () => {
    throw new Error("should not load");
  });
  const utils = render(
    <JarvisProvider store={store} ai={ai} detectBridge={async () => NO_BRIDGE}>
      <App />
    </JarvisProvider>,
  );
  return { ...utils, store, ai };
}

async function sendChat(text: string) {
  const input = screen.getByLabelText("Message JARVIS");
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.submit(input.closest("form")!);
    await new Promise((r) => setTimeout(r, 10));
  });
}

describe("mobile layout", () => {
  it("has a bottom navigation with five large touch targets", () => {
    renderApp();
    const nav = screen.getByTestId("bottom-nav");
    expect(nav.className).toContain("md:hidden"); // phones only
    expect(nav.className).toContain("safe-area-inset-bottom");
    const buttons = within(nav).getAllByRole("button");
    expect(buttons.map((b) => b.textContent)).toEqual(["Base", "Chat", "Learn", "Quizzes", "More"]);
    for (const b of buttons) expect(b.className).toContain("min-h-14"); // ≥ 56 px tall
  });

  it("navigates between pages from the bottom bar", () => {
    renderApp();
    const nav = screen.getByTestId("bottom-nav");
    fireEvent.click(within(nav).getByText("Learn"));
    expect(screen.getByRole("tab", { name: /math helper/i })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(within(nav).getByText("More"));
    expect(screen.getByRole("radiogroup", { name: "School grade" })).toBeInTheDocument();
  });

  it("shows the dashboard with avatar, greeting, status and the six quick actions", () => {
    renderApp();
    expect(screen.getByRole("img", { name: "JARVIS is ready" })).toBeInTheDocument();
    expect(screen.getByText(/Hello, Player!/)).toBeInTheDocument();
    expect(screen.getAllByText("System online").length).toBeGreaterThan(0);
    for (const label of ["Open Roblox", "Study Mode", "Math Helper", "Science Lab", "Voice Mode", "My Quizzes"]) {
      expect(screen.getByRole("button", { name: new RegExp(label, "i") })).toBeInTheDocument();
    }
  });

  it("grade selection persists to local storage", () => {
    const { store } = renderApp();
    fireEvent.click(within(screen.getByTestId("bottom-nav")).getByText("More"));
    fireEvent.click(screen.getByRole("radio", { name: "11" }));
    expect(store.getPrefs().grade).toBe(11);
    expect(screen.getByRole("radio", { name: "11" })).toHaveAttribute("aria-checked", "true");
  });
});

describe("chat without any AI model", () => {
  it("answers math with a verified engine card and saves history", async () => {
    const { store } = renderApp();
    fireEvent.click(within(screen.getByTestId("bottom-nav")).getByText("Chat"));
    await sendChat("Solve 3x + 7 = 22");
    expect(await screen.findByText(/VERIFIED BY MATH ENGINE/)).toBeInTheDocument();
    expect(store.listConversations()[0].messageCount).toBe(2);
  });

  it("keeps the checked answer when the local model fails mid-answer", async () => {
    const engine: EngineLike = {
      chat: { completions: { create: async () => Promise.reject(new Error("GPU device lost")) } },
      interruptGenerate: vi.fn(),
      unload: vi.fn(async () => undefined),
    };
    const ai = new LocalAI(async () => engine);
    const store = new LocalStore(new MemoryStorage());
    store.setPrefs({ localAI: { enabled: true, modelId: MODELS[0].id, consentedModelId: MODELS[0].id } });
    await ai.load(MODELS[0].id, true);
    renderApp({ ai, store });
    fireEvent.click(within(screen.getByTestId("bottom-nav")).getByText("Chat"));
    await sendChat("Explain photosynthesis");
    expect((await screen.findAllByText(/6CO₂ \+ 6H₂O/)).length).toBeGreaterThan(0);
    expect(screen.queryByText(/On-device AI says/)).toBeNull();
  });

  it("adds a clearly labelled on-device explanation when the model works", async () => {
    const engine: EngineLike = {
      chat: {
        completions: {
          create: async () =>
            (async function* () {
              yield { choices: [{ delta: { content: "Plants use sunlight to make sugar." } }] };
            })(),
        },
      },
      interruptGenerate: vi.fn(),
      unload: vi.fn(async () => undefined),
    };
    const ai = new LocalAI(async () => engine);
    const store = new LocalStore(new MemoryStorage());
    store.setPrefs({ localAI: { enabled: true, modelId: MODELS[0].id, consentedModelId: MODELS[0].id } });
    await ai.load(MODELS[0].id, true);
    renderApp({ ai, store });
    fireEvent.click(within(screen.getByTestId("bottom-nav")).getByText("Chat"));
    await sendChat("Explain photosynthesis");
    expect(await screen.findByText(/On-device AI says/)).toBeInTheDocument();
    expect(screen.getByText("Plants use sunlight to make sugar.")).toBeInTheDocument();
  });

  it("never auto-loads the model on startup", () => {
    const factory = vi.fn();
    const store = new LocalStore(new MemoryStorage());
    store.setPrefs({ localAI: { enabled: true, modelId: MODELS[0].id, consentedModelId: MODELS[0].id } });
    renderApp({ ai: new LocalAI(factory), store });
    expect(factory).not.toHaveBeenCalled();
  });

  it("“open Roblox” shows a tap-to-launch button instead of navigating", async () => {
    const before = window.location.href;
    renderApp();
    fireEvent.click(within(screen.getByTestId("bottom-nav")).getByText("Chat"));
    await sendChat("Jarvis, open Roblox");
    expect(await screen.findByRole("button", { name: /Open Roblox/ })).toBeInTheDocument();
    expect(window.location.href).toBe(before);
  });
});

describe("components", () => {
  it("QuickActions disables voice when unavailable", () => {
    const onAction = vi.fn();
    render(<QuickActions onAction={onAction} voiceAvailable={false} />);
    expect(screen.getByRole("button", { name: /voice mode/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /open roblox/i }));
    expect(onAction).toHaveBeenCalledWith("roblox");
  });

  it("PixelAvatar announces its state", () => {
    render(<PixelAvatar state="listening" />);
    expect(screen.getByRole("img", { name: "JARVIS is listening" })).toBeInTheDocument();
  });

  it("MathResultCard distinguishes verified, approximate and unsupported", () => {
    const { rerender } = render(<MathResultCard result={{ status: "verified", result_latex: "x = 5" }} />);
    expect(screen.getByText(/VERIFIED BY MATH ENGINE/)).toBeInTheDocument();
    rerender(<MathResultCard result={{ status: "approximate", result_latex: "\\approx 0.34" }} />);
    expect(screen.queryByText(/VERIFIED/)).toBeNull();
    expect(screen.getByText(/APPROXIMATE/)).toBeInTheDocument();
    rerender(<MathResultCard result={{ status: "unsupported", message: "no" }} />);
    expect(screen.getByText(/NOT SUPPORTED YET/)).toBeInTheDocument();
  });

  it("MessageBubble quiz action only fires on tap", () => {
    const onStartQuiz = vi.fn();
    render(
      <ul>
        <MessageBubble actions={{ onStartQuiz }} message={{ id: "1", role: "assistant", content: "Quiz time!", createdAt: "", meta: { action: { type: "quiz", subject: "science", grade: 8 } } }} />
      </ul>,
    );
    expect(onStartQuiz).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /start quiz/i }));
    expect(onStartQuiz).toHaveBeenCalledWith("science", 8);
  });
});
