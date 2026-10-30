import "@testing-library/jest-dom/vitest";

// jsdom lacks these browser APIs; provide inert versions for UI tests.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({ matches: false, media: query, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false }) as unknown as MediaQueryList;
}
window.scrollTo = () => undefined;
