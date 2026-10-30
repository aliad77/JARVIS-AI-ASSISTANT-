# On-device AI (optional)

JARVIS works fully **without** any AI model. The math engine, curated science lessons, quizzes and practice are all deterministic and offline. The local model is an optional extra that re-explains checked answers in different words.

## Technology

- **WebLLM** (`@mlc-ai/web-llm` 0.2.87, Apache-2.0) runs models in the browser through **WebGPU**. Inference happens entirely on the device. There is no API key and no remote inference.
- The WebLLM library is loaded with a dynamic `import()`, so it is only downloaded when the user starts local AI.

## Models

Sizes were measured on 2026-10-30 from the Hugging Face file listings plus the WebGPU library file on GitHub. GPU memory figures come from WebLLM's `prebuiltAppConfig` (`vram_required_MB`).

| Model (WebLLM id) | Base model & license | Download | GPU memory | Needs `shader-f16` | Role |
|---|---|---|---|---|---|
| `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | Qwen/Qwen2.5-0.5B-Instruct, Apache-2.0 | ≈ 295 MB (289.7 MB weights + 5.7 MB library) | ≈ 945 MB | yes | default |
| `Qwen2.5-0.5B-Instruct-q4f32_1-MLC` | same | ≈ 296 MB | ≈ 1,060 MB | no | compatibility (no f16) |
| `SmolLM2-360M-Instruct-q4f16_1-MLC` | HuggingFaceTB/SmolLM2-360M-Instruct, Apache-2.0 | ≈ 214 MB (207.2 MB + 6.6 MB) | ≈ 376 MB | yes | lite, preferred on phones |

Downloads come from `huggingface.co` (weights, served through its CDN `*.hf.co`) and `raw.githubusercontent.com` (WebGPU library). WebLLM caches them in the browser's Cache Storage.

## Safeguards (implemented in `frontend/src/ai/localModel.ts`)

- **Capability detection.** Checks:
  - secure context
  - `navigator.gpu` and a WebGPU adapter
  - the `shader-f16` feature
  - max buffer size
  - `navigator.deviceMemory`, a Chrome-only hint
  - free storage from `navigator.storage.estimate()`
  - phone vs desktop
- **Suitability.** Each device gets a level: `unsupported`, `insufficient`, `uncertain` or `likely`, always with reasons. Phones are never rated better than `uncertain`.
- **Consent.** The download size is shown first. Starting needs two taps ("Download & start" → "Yes, download 295 MB"). `LocalAI.load()` throws if consent is false.
- **No automatic downloads or loads.** The model never starts on page load, even if it was downloaded before.
- **Progress.** WebLLM progress is shown, and the load can be cancelled.
- **Ready means ready.** Status only becomes `ready` after `CreateMLCEngine` resolves. A cancelled load never becomes ready.
- **Failures** are classified (memory, unsupported, network) and the app falls back silently to the checked lessons.
- **Generation limits.** 350 output tokens, temperature 0.3 and a 60 s timeout, after which `interruptGenerate()` stops it.
- **Grounding.** The model gets the curated lesson or math-engine result as a REFERENCE and is told not to add facts or change answers.
- **Labelling.** Its output is shown separately as "On-device AI says (can be wrong — the checked answer above wins)".
- **Output sanitising.** Links, URL schemes and markup are stripped, and the text is rendered without HTML.

## Not verified

None of these models has been run on a physical phone during development. Test results use simulated `navigator.gpu` objects. Whether a given iPhone or Android device can load them depends on its browser's WebGPU support, its memory, and how aggressively the OS kills the tab.
