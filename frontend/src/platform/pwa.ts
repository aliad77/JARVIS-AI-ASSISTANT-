/**
 * Service-worker registration for offline use and "Add to Home Screen".
 * Only in production builds served over HTTPS (or localhost): in development
 * a service worker would cache stale modules.
 */
export function registerServiceWorker(env: { prod: boolean } = { prod: import.meta.env.PROD }): boolean {
  if (!env.prod || typeof navigator === "undefined" || !("serviceWorker" in navigator) || !globalThis.isSecureContext) return false;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  });
  return true;
}
