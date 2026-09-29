# Demo-day guide — running with ZERO API credits

JeevikaSetu now runs its full interview, in all six languages, with **no OpenAI
key, no MongoDB and no internet**. Nothing hangs, nothing blocks on a 429.

## 1. Start it

```bash
npm install
npm run dev          # http://localhost:3000
```

No `.env` needed. Missing `MONGODB_URL` falls back to the in-memory store;
missing `OPENAI_API_KEY` falls back to the on-device engine.

## 2. Guaranteed-offline mode (recommended for judging)

Force the client-side mock engine so not a single backend call is made:

| Method | How |
|---|---|
| URL | `/talk?mock=1` · `/ivr?mock=1` · `/whatsapp?mock=1` (sticky per browser) |
| Console | `localStorage.setItem("js_force_mock", "1")` |
| Build env | `NEXT_PUBLIC_FORCE_OFFLINE=1` |

Turn it off with `localStorage.removeItem("js_force_mock")`.

## 3. What replaced what

| Layer | Was | Now |
|---|---|---|
| Speech-to-text | OpenAI Whisper (`/api/voice/transcribe`) | `window.SpeechRecognition` / `webkitSpeechRecognition` — free, local, per-locale (`hi-IN`, `en-IN`, `ta-IN`, `te-IN`, `mr-IN`, `bn-IN`) |
| Text-to-speech | OpenAI TTS (`/api/voice/synthesize`) | `window.speechSynthesis`, best-matching Indian voice, long text auto-chunked |
| Dialogue | GPT-4o via `/api/conversation/message` | Same endpoint **first**; on 429/5xx/timeout/offline the browser-side **Mock Conversation State Machine** (`src/lib/offline-agent.ts`) takes over mid-interview without losing state |
| Profile + recommendations | MongoDB + `/api/recommend` | Falls back to `localStorage` + the deterministic matcher running in the browser |

A **circuit breaker** (`tripSpeechBreaker`) means one failure is enough — the app
never retries a dead endpoint during the session.

## 4. Browser support

Speech recognition needs **Chrome / Edge** (or Chrome on Android).
Firefox and Safari fall back to the text input, which works identically.
Serve over `http://localhost` or HTTPS — the mic is blocked on plain HTTP hosts.

Click the green **Call** button (or the mic once) before expecting audio:
browsers only unlock `speechSynthesis` after a user gesture. This is handled by
`warmUpSpeech()`.

## 5. Suggested 3-minute run-through

1. **`/`** — landing, pick हिन्दी.
2. **`/talk`** — hold *बोलने के लिए दबाए रखें* and answer in Hindi.
   Your words appear **instantly**; "JeevikaSetu लिख रही है…" shows while it thinks.
   Switch language mid-interview from the sidebar — UI, recognition locale and
   voice all change on the spot and the current question is re-asked.
3. **`/ivr`** — dial, press **1**, and do the whole interview **inside the
   handset**: live call timer, speaker/mute, red End Call. No chat bubbles.
4. **`/profile/:id` → `/recommendations/:id` → `/report/:id`** — NSQF pathways,
   RPL route, centres and GIA benefits, all computed locally.
5. Fallback proof: open DevTools → Network → **Offline**, keep talking. The
   interview continues; an amber "offline engine" banner appears.

## 6. Logos

Placeholder artwork lives in `public/assets/` (see the README there). Drop the
official PNGs over the same filenames — `emblem.png`, `pmajay-logo.png`,
`mosje-logo.png`, `skill-india.png`, `nsdc-logo.png`, `digital-india.png` — and
the header and footer pick them up with no code change.
