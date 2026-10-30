import "@fontsource/press-start-2p/400.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "katex/dist/katex.min.css";
import "./styles/index.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { JarvisProvider } from "./hooks/useJarvis";
import { registerServiceWorker } from "./platform/pwa";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <JarvisProvider>
      <App />
    </JarvisProvider>
  </StrictMode>,
);

registerServiceWorker();
