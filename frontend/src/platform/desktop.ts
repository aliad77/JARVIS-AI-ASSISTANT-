/**
 * Optional bridge to the Windows desktop backend (FastAPI on 127.0.0.1).
 *
 * The phone/PWA build never needs it. When JARVIS is opened from the local
 * backend on a Windows PC, this enables launching the approved Windows apps
 * through the backend's guarded /api/launch endpoint. Detection is a same-origin
 * request, so a hosted (HTTPS) copy of JARVIS simply finds no backend.
 */

export interface DesktopBridge {
  available: boolean;
  platform: string | null;
  canLaunchWindowsApps: boolean;
}

export const NO_BRIDGE: DesktopBridge = { available: false, platform: null, canLaunchWindowsApps: false };

let token: string | null = null;

async function getJson(url: string, init?: RequestInit, fetchImpl: typeof fetch = fetch, timeoutMs = 3000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetchImpl(url, { credentials: "same-origin", ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

export async function detectDesktopBridge(fetchImpl: typeof fetch = fetch): Promise<DesktopBridge> {
  try {
    const health = (await getJson("/api/health", undefined, fetchImpl)) as { service?: string };
    if (health?.service !== "jarvis") return NO_BRIDGE;
    const session = (await getJson("/api/session", undefined, fetchImpl)) as { token?: string };
    if (typeof session?.token !== "string") return NO_BRIDGE;
    token = session.token;
    const status = (await getJson("/api/status", { headers: { "X-Jarvis-Token": token } }, fetchImpl)) as { platform?: string };
    const platform = typeof status?.platform === "string" ? status.platform : null;
    return { available: true, platform, canLaunchWindowsApps: platform === "win32" };
  } catch {
    return NO_BRIDGE;
  }
}

export const WINDOWS_APPS: Record<string, string> = {
  roblox: "Roblox",
  chrome: "Google Chrome",
  edge: "Microsoft Edge",
  calculator: "Calculator",
  notepad: "Notepad",
  paint: "Paint",
};

export interface WindowsLaunchResult {
  ok: boolean;
  status: string;
  message: string;
}

export async function launchWindowsApp(appId: string, fetchImpl: typeof fetch = fetch): Promise<WindowsLaunchResult> {
  if (!(appId in WINDOWS_APPS)) return { ok: false, status: "not_allowed", message: "That app isn't on the approved list." };
  if (!token) return { ok: false, status: "no_backend", message: "The JARVIS desktop service isn't connected." };
  try {
    const data = (await getJson(
      "/api/launch",
      { method: "POST", headers: { "Content-Type": "application/json", "X-Jarvis-Token": token }, body: JSON.stringify({ app_id: appId }) },
      fetchImpl,
      10000,
    )) as { result?: WindowsLaunchResult };
    return data.result ?? { ok: false, status: "failed", message: "Unexpected reply from the desktop service." };
  } catch {
    return { ok: false, status: "failed", message: "Couldn't reach the JARVIS desktop service." };
  }
}
