import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";

class FakeRecognition {
  static instances: FakeRecognition[] = [];
  lang = "";
  continuous = true;
  interimResults = false;
  maxAlternatives = 0;
  onresult: ((e: unknown) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  start = vi.fn(() => this.onstart?.());
  stop = vi.fn(() => this.onend?.());
  abort = vi.fn();
  constructor() {
    FakeRecognition.instances.push(this);
  }
}

afterEach(() => {
  delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  FakeRecognition.instances = [];
});

describe("useSpeechRecognition", () => {
  it("reports unsupported when the browser lacks speech recognition", () => {
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-US", onFinal: vi.fn() }));
    expect(result.current.state).toBe("unsupported");
    expect(result.current.supported).toBe(false);
  });

  it("never starts the microphone without an explicit start()", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    renderHook(() => useSpeechRecognition({ lang: "en-US", onFinal: vi.fn() }));
    expect(FakeRecognition.instances.length).toBe(0);
  });

  it("push-to-talk: listens once (not continuous) and delivers the final transcript", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const onFinal = vi.fn();
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-GB", onFinal }));
    act(() => result.current.start());
    const rec = FakeRecognition.instances[0];
    expect(rec.continuous).toBe(false);
    expect(rec.lang).toBe("en-GB");
    expect(result.current.state).toBe("listening");
    act(() => {
      rec.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "open roblox" } }] });
      rec.onend?.();
    });
    expect(onFinal).toHaveBeenCalledWith("open roblox");
    expect(result.current.state).toBe("idle");
  });

  it("handles a denied microphone permission", () => {
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition = FakeRecognition;
    const { result } = renderHook(() => useSpeechRecognition({ lang: "en-US", onFinal: vi.fn() }));
    act(() => result.current.start());
    act(() => {
      FakeRecognition.instances[0].onerror?.({ error: "not-allowed" });
      FakeRecognition.instances[0].onend?.();
    });
    expect(result.current.state).toBe("denied");
    expect(result.current.error).toMatch(/permission/i);
  });
});
