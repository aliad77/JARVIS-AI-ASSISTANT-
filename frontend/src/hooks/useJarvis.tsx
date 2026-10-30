/** App-wide state. Everything runs in the browser; the desktop backend is optional. */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { localAI, type LocalAI, type LocalAIStatus } from "../ai/localModel";
import { detectDesktopBridge, NO_BRIDGE, type DesktopBridge } from "../platform/desktop";
import { detectPlatform, type DevicePlatform } from "../platform/roblox";
import { store as defaultStore, type LocalStore, type Preferences } from "../platform/storage";

interface JarvisContextValue {
  prefs: Preferences;
  updatePrefs: (changes: Partial<Preferences>) => void;
  store: LocalStore;
  platform: DevicePlatform;
  bridge: DesktopBridge;
  online: boolean;
  ai: LocalAI;
  aiStatus: LocalAIStatus;
}

const JarvisContext = createContext<JarvisContextValue | null>(null);

export function JarvisProvider({
  children,
  store = defaultStore,
  ai = localAI,
  detectBridge = detectDesktopBridge,
}: {
  children: ReactNode;
  store?: LocalStore;
  ai?: LocalAI;
  detectBridge?: () => Promise<DesktopBridge>;
}) {
  const [prefs, setPrefs] = useState<Preferences>(() => store.getPrefs());
  const [bridge, setBridge] = useState<DesktopBridge>(NO_BRIDGE);
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));
  const [aiStatus, setAiStatus] = useState<LocalAIStatus>(ai.status);
  const platform = useMemo(() => (typeof navigator === "undefined" ? "other" : detectPlatform(navigator)), []);

  useEffect(() => ai.subscribe(setAiStatus), [ai]);

  useEffect(() => {
    let cancelled = false;
    void detectBridge().then((b) => !cancelled && setBridge(b));
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      cancelled = true;
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [detectBridge]);

  const updatePrefs = useCallback((changes: Partial<Preferences>) => setPrefs(store.setPrefs(changes)), [store]);

  const value = useMemo(
    () => ({ prefs, updatePrefs, store, platform, bridge, online, ai, aiStatus }),
    [prefs, updatePrefs, store, platform, bridge, online, ai, aiStatus],
  );
  return <JarvisContext.Provider value={value}>{children}</JarvisContext.Provider>;
}

export function useJarvis(): JarvisContextValue {
  const ctx = useContext(JarvisContext);
  if (!ctx) throw new Error("useJarvis must be used inside JarvisProvider");
  return ctx;
}
