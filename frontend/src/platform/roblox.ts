/**
 * Mobile-friendly Roblox launching using Roblox's documented link formats.
 *
 * Source: https://create.roblox.com/docs/production/promotion/deeplinking
 * (checked 2026-10-30). That page documents three formats that include a place ID:
 *   - web → app:   https://www.roblox.com/games/start?placeId=<id>
 *   - direct:      roblox://placeId=<id>
 *   - deferred (mobile, installs the app first if needed):
 *                  https://ro.blox.com/Ebh5?af_dp=<direct>&af_web_dp=<web>
 * The page marks this process as deprecated in favour of creator-made "share
 * links", which can't be generated from a place ID, so JARVIS uses the formats
 * above and labels them accordingly. No format for opening the app's home
 * screen is documented, so without a place ID JARVIS opens the Roblox website
 * or the official app-store page and never claims the app opened.
 *
 * Security: URLs are only built from constants plus a validated numeric place
 * ID, and every URL is checked against an allowlist before navigation. Links in
 * chat/AI text are never made clickable.
 */

export type DevicePlatform = "ios" | "android" | "windows" | "mac" | "other";

export const ROBLOX_URLS = {
  website: "https://www.roblox.com/home",
  // Store links as published on https://www.roblox.com/download
  appStore: "https://itunes.apple.com/us/app/roblox-mobile/id431946152",
  playStore: "https://play.google.com/store/apps/details?id=com.roblox.client",
  download: "https://www.roblox.com/download",
};

const ALLOWED = [
  /^https:\/\/www\.roblox\.com\/(home|download)$/,
  /^https:\/\/www\.roblox\.com\/games\/start\?placeId=[1-9]\d{0,19}$/,
  /^roblox:\/\/placeId=[1-9]\d{0,19}$/,
  /^https:\/\/ro\.blox\.com\/Ebh5\?af_dp=roblox%3A%2F%2FplaceId%3D[1-9]\d{0,19}&af_web_dp=https%3A%2F%2Fwww\.roblox\.com%2Fgames%2Fstart%3FplaceId%3D[1-9]\d{0,19}$/,
  /^https:\/\/itunes\.apple\.com\/us\/app\/roblox-mobile\/id431946152$/,
  /^https:\/\/play\.google\.com\/store\/apps\/details\?id=com\.roblox\.client$/,
];

export function isAllowedRobloxUrl(url: string): boolean {
  return ALLOWED.some((re) => re.test(url));
}

export function detectPlatform(nav: Pick<Navigator, "userAgent" | "maxTouchPoints"> = navigator): DevicePlatform {
  const ua = nav.userAgent || "";
  if (/android/i.test(ua)) return "android";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  // iPadOS 13+ reports itself as a Mac but has a touch screen.
  if (/macintosh/i.test(ua) && (nav.maxTouchPoints ?? 0) > 1) return "ios";
  if (/windows/i.test(ua)) return "windows";
  if (/macintosh|mac os x/i.test(ua)) return "mac";
  return "other";
}

export const isMobilePlatform = (p: DevicePlatform) => p === "ios" || p === "android";

export type PlaceIdResult = { ok: true; placeId: string } | { ok: false; error: string };

/**
 * Accepts a numeric place ID, or a Roblox experience URL such as
 * https://www.roblox.com/games/920587237/Adopt-Me. Anything else is rejected.
 */
export function parsePlaceId(input: string): PlaceIdResult {
  const text = (input ?? "").trim();
  if (!text) return { ok: false, error: "Please enter a place ID or a Roblox game link." };
  if (text.length > 300) return { ok: false, error: "That's too long to be a Roblox link." };
  if (/^\d+$/.test(text)) {
    return /^[1-9]\d{0,19}$/.test(text) ? { ok: true, placeId: text } : { ok: false, error: "A place ID is a number like 920587237." };
  }
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false, error: "That isn't a number or a valid link." };
  }
  if (url.protocol !== "https:" || !/^(www\.)?roblox\.com$/i.test(url.hostname) || url.username || url.password || url.port) {
    return { ok: false, error: "Only links from https://www.roblox.com are allowed." };
  }
  const m = /^\/games\/([1-9]\d{0,19})(\/[^/]*)?\/?$/.exec(url.pathname);
  if (!m) return { ok: false, error: "That Roblox link doesn't point to a game page (roblox.com/games/…)." };
  return { ok: true, placeId: m[1] };
}

export interface RobloxLaunchPlan {
  /** Main URL to open on a tap. */
  primary: string;
  primaryLabel: string;
  /** How it is opened: same tab (lets the OS hand off to the app) or a new tab. */
  primaryTarget: "same" | "new";
  fallbacks: { label: string; url: string }[];
  notes: string[];
}

export function buildLaunchPlan(platform: DevicePlatform, placeId?: string | null): RobloxLaunchPlan {
  const store = platform === "ios" ? ROBLOX_URLS.appStore : platform === "android" ? ROBLOX_URLS.playStore : null;
  const storeFallback = store ? [{ label: platform === "ios" ? "Get Roblox on the App Store" : "Get Roblox on Google Play", url: store }] : [{ label: "Download Roblox", url: ROBLOX_URLS.download }];
  if (placeId) {
    if (!/^[1-9]\d{0,19}$/.test(placeId)) throw new Error("invalid place id");
    const web = `https://www.roblox.com/games/start?placeId=${placeId}`;
    const direct = `roblox://placeId=${placeId}`;
    const deferred = `https://ro.blox.com/Ebh5?af_dp=${encodeURIComponent(direct)}&af_web_dp=${encodeURIComponent(web)}`;
    if (isMobilePlatform(platform)) {
      return {
        primary: deferred,
        primaryLabel: "Play in Roblox",
        primaryTarget: "same",
        fallbacks: [{ label: "Open the game page on roblox.com", url: web }, ...storeFallback],
        notes: ["Uses Roblox's documented mobile deep link. If Roblox isn't installed, it should offer to install it first."],
      };
    }
    return {
      primary: web,
      primaryLabel: "Play in Roblox",
      primaryTarget: "new",
      fallbacks: [{ label: "Try opening the Roblox app directly", url: direct }, ...storeFallback],
      notes: ["Opens the game page, which then asks your browser to open Roblox."],
    };
  }
  return {
    primary: ROBLOX_URLS.website,
    primaryLabel: "Open Roblox",
    primaryTarget: isMobilePlatform(platform) ? "same" : "new",
    fallbacks: storeFallback,
    notes: [
      "Roblox doesn't document a link that opens the app's home screen. This opens roblox.com — on some phones that hands over to the app if it's installed.",
      "Tip: add a favourite game in Settings to launch it directly.",
    ],
  };
}

export type HandoffOutcome = "left-page" | "stayed";

/**
 * Must be called synchronously inside a tap/click handler (browsers block
 * navigation to apps without a user gesture). Resolves "left-page" if the page
 * was hidden soon after (the OS likely switched apps), otherwise "stayed".
 * Neither outcome proves Roblox actually started.
 */
export function openRobloxUrl(url: string, target: "same" | "new", opts: { win?: Window; doc?: Document; timeoutMs?: number } = {}): Promise<HandoffOutcome> {
  if (!isAllowedRobloxUrl(url)) return Promise.reject(new Error("Blocked: not an approved Roblox link."));
  const win = opts.win ?? window;
  const doc = opts.doc ?? document;
  return new Promise((resolve) => {
    let done = false;
    const finish = (o: HandoffOutcome) => {
      if (done) return;
      done = true;
      doc.removeEventListener("visibilitychange", onVis);
      win.removeEventListener("pagehide", onHide);
      win.clearTimeout(timer);
      resolve(o);
    };
    const onVis = () => doc.visibilityState === "hidden" && finish("left-page");
    const onHide = () => finish("left-page");
    doc.addEventListener("visibilitychange", onVis);
    win.addEventListener("pagehide", onHide);
    const timer = win.setTimeout(() => finish("stayed"), opts.timeoutMs ?? 2500);
    if (target === "same") win.location.assign(url);
    else win.open(url, "_blank", "noopener,noreferrer");
  });
}
