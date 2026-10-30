import headersText from "../../public/_headers?raw";
import manifestText from "../../public/manifest.webmanifest?raw";
import swText from "../../public/sw.js?raw";
import packageText from "../../package.json?raw";
import { describe, expect, it, vi } from "vitest";
import { detectDesktopBridge, launchWindowsApp } from "../platform/desktop";
import { registerServiceWorker } from "../platform/pwa";
import { buildLaunchPlan, detectPlatform, isAllowedRobloxUrl, openRobloxUrl, parsePlaceId, ROBLOX_URLS } from "../platform/roblox";

const UA = {
  iphone: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
  ipad: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15",
  android: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/140.0 Mobile Safari/537.36",
  windows: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
};

describe("Roblox link validation", () => {
  it.each([
    ["920587237", "920587237"],
    ["  606849621 ", "606849621"],
    ["https://www.roblox.com/games/920587237/Adopt-Me", "920587237"],
    ["https://roblox.com/games/606849621", "606849621"],
  ])("accepts %s", (input, id) => {
    expect(parsePlaceId(input)).toEqual({ ok: true, placeId: id });
  });

  it.each([
    "",
    "0123",
    "12a",
    "javascript:alert(1)",
    "roblox://placeId=1",
    "http://www.roblox.com/games/1/x",
    "https://evil.com/games/1",
    "https://www.roblox.com.evil.com/games/1",
    "https://user:pw@www.roblox.com/games/1",
    "https://www.roblox.com:8443/games/1",
    "https://www.roblox.com/users/1/profile",
    "https://www.roblox.com/games/1/x/../../evil",
    "1".repeat(25),
  ])("rejects %s", (input) => {
    expect(parsePlaceId(input).ok).toBe(false);
  });

  it("detects platforms, including iPadOS reporting as a Mac", () => {
    expect(detectPlatform({ userAgent: UA.iphone, maxTouchPoints: 5 })).toBe("ios");
    expect(detectPlatform({ userAgent: UA.ipad, maxTouchPoints: 5 })).toBe("ios");
    expect(detectPlatform({ userAgent: UA.ipad, maxTouchPoints: 0 })).toBe("mac");
    expect(detectPlatform({ userAgent: UA.android, maxTouchPoints: 5 })).toBe("android");
    expect(detectPlatform({ userAgent: UA.windows, maxTouchPoints: 0 })).toBe("windows");
  });

  it("uses the documented deferred deep link on phones and store fallbacks", () => {
    const ios = buildLaunchPlan("ios", "920587237");
    expect(ios.primary).toBe("https://ro.blox.com/Ebh5?af_dp=roblox%3A%2F%2FplaceId%3D920587237&af_web_dp=https%3A%2F%2Fwww.roblox.com%2Fgames%2Fstart%3FplaceId%3D920587237");
    expect(ios.fallbacks.map((f) => f.url)).toContain(ROBLOX_URLS.appStore);
    expect(buildLaunchPlan("android", "1").fallbacks.map((f) => f.url)).toContain(ROBLOX_URLS.playStore);
    expect(buildLaunchPlan("windows", "1").primary).toBe("https://www.roblox.com/games/start?placeId=1");
    const home = buildLaunchPlan("android");
    expect(home.primary).toBe(ROBLOX_URLS.website);
    expect(home.notes.join(" ")).toMatch(/doesn't document/);
  });

  it("every URL in every plan passes the allowlist", () => {
    for (const p of ["ios", "android", "windows", "mac", "other"] as const) {
      for (const id of [undefined, "1", "920587237"]) {
        const plan = buildLaunchPlan(p, id);
        for (const url of [plan.primary, ...plan.fallbacks.map((f) => f.url)]) expect(isAllowedRobloxUrl(url)).toBe(true);
      }
    }
    expect(() => buildLaunchPlan("ios", "1&evil=1")).toThrow();
  });

  it.each(["javascript:alert(1)", "https://evil.example", "roblox://placeId=1&x=2", "intent://x", "https://www.roblox.com/games/start?placeId=1&launchData=x"])("openRobloxUrl blocks %s", async (url) => {
    const win = { location: { assign: vi.fn() }, open: vi.fn() } as unknown as Window;
    await expect(openRobloxUrl(url, "same", { win })).rejects.toThrow(/Blocked/);
    expect((win.location.assign as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it("reports 'left-page' only when the page actually becomes hidden, otherwise 'stayed'", async () => {
    const doc = new EventTarget() as Document & { visibilityState: string };
    Object.defineProperty(doc, "visibilityState", { value: "visible", writable: true });
    const winTarget = new EventTarget();
    const assign = vi.fn();
    const win = Object.assign(winTarget, { location: { assign }, open: vi.fn(), setTimeout, clearTimeout }) as unknown as Window;

    const stayed = openRobloxUrl(ROBLOX_URLS.website, "same", { win, doc, timeoutMs: 20 });
    expect(assign).toHaveBeenCalledWith(ROBLOX_URLS.website);
    await expect(stayed).resolves.toBe("stayed");

    const left = openRobloxUrl(ROBLOX_URLS.website, "same", { win, doc, timeoutMs: 1000 });
    (doc as unknown as { visibilityState: string }).visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    await expect(left).resolves.toBe("left-page");
  });
});

describe("optional Windows desktop bridge", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  it("finds no bridge on static hosting (no /api)", async () => {
    const fetchImpl = vi.fn(async () => new Response("not found", { status: 404 })) as unknown as typeof fetch;
    expect(await detectDesktopBridge(fetchImpl)).toEqual({ available: false, platform: null, canLaunchWindowsApps: false });
  });

  it("enables Windows launching only when the backend reports win32", async () => {
    const make = (platform: string) =>
      vi.fn(async (url: string) =>
        url === "/api/health" ? json({ service: "jarvis" }) : url === "/api/session" ? json({ token: "t" }) : url === "/api/status" ? json({ platform }) : json({ result: { ok: true, status: "started", message: "Notepad is starting." } }),
      ) as unknown as typeof fetch;
    expect((await detectDesktopBridge(make("darwin"))).canLaunchWindowsApps).toBe(false);
    const f = make("win32");
    expect((await detectDesktopBridge(f)).canLaunchWindowsApps).toBe(true);
    expect((await launchWindowsApp("notepad", f)).ok).toBe(true);
    expect((await launchWindowsApp("cmd", f)).status).toBe("not_allowed");
  });
});

describe("PWA and browser security configuration", () => {
  it("does not register a service worker in development", () => {
    expect(registerServiceWorker({ prod: false })).toBe(false);
  });

  it("manifest is installable with maskable icons", () => {
    const m = JSON.parse(manifestText);
    expect(m).toMatchObject({ display: "standalone", start_url: "/", theme_color: "#0B0B10" });
    expect(m.icons.some((i: { purpose: string }) => i.purpose === "maskable")).toBe(true);
    expect(m.icons.some((i: { sizes: string }) => i.sizes === "512x512")).toBe(true);
  });

  it("service worker never caches the desktop API or cross-origin requests", () => {
    const sw = swText;
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain("url.origin !== self.location.origin");
    expect(sw).toMatch(/MAX_ASSET_ENTRIES/);
  });

  it("hosting headers set a strict CSP", () => {
    const h = headersText;
    for (const rule of ["frame-ancestors 'none'", "object-src 'none'", "script-src 'self' 'wasm-unsafe-eval'", "form-action 'none'", "microphone=(self)"]) expect(h).toContain(rule);
    expect(h).not.toContain(" 'unsafe-eval'");
  });

  it("no hosted AI SDK or API key is referenced in the frontend source", () => {
    const pkg = packageText;
    for (const sdk of ["@anthropic-ai", "openai", "@google/generative-ai", "@google/genai"]) expect(pkg).not.toContain(sdk);
  });
});
