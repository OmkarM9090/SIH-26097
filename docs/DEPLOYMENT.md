# JeevikaSetu deployment

This checkout is a Next.js application. Its server routes under `src/app/api` are the backend, and persistence is MongoDB (the `mongodb` Node driver is used; there is no SQL database).

## Local demo

1. Create a MongoDB Atlas M0 cluster and a database user. For a prototype, allow the deployment IP (or `0.0.0.0/0` temporarily).
2. Copy `.env.example` to `.env.local` and set `MONGODB_URL` and, optionally, `OPENAI_API_KEY`.
3. Run `npm ci`, then `npm run dev`.
4. Visit `/`, `/talk`, `/ivr`, or `/admin`. `/api/health` should return `{ "ok": true }`.
5. Seed the curated demo data with the existing `/api/seed` route (POST) while developing.

## Vercel

Import the repository into Vercel. The project is detected as Next.js; use `npm run build` and leave the output directory as the default `.next`. Add `MONGODB_URL`, `MONGODB_DB`, and `OPENAI_API_KEY` under Project Settings → Environment Variables. Add the deployed Vercel domain to MongoDB Atlas Network Access. No browser code calls localhost; all API calls use relative `/api` URLs.

## Docker / Render / Railway

The root `Dockerfile` builds the Next.js standalone server and binds to `0.0.0.0:3000`. Set `MONGODB_URL`, `MONGODB_DB`, and `OPENAI_API_KEY` as service secrets and expose port 3000. Configure the health check as `/api/health`. The app is stateless apart from MongoDB, so multiple instances are safe.

## Voice requirements

Microphone capture requires HTTPS in production (Vercel provides this) and the user must grant microphone permission. The browser records `audio/webm;codecs=opus`, posts it as multipart form data to `/api/voice/transcribe`, and Whisper receives it server-side. If no OpenAI key is configured, the UI falls back to browser speech recognition and speech synthesis, so judges can still walk through the flow.

Never put `OPENAI_API_KEY` or `MONGODB_URL` in `NEXT_PUBLIC_*` variables or commit `.env.local`.

## Live-demo resilience (built in)

The interview is engine-independent, so a live deployment cannot strand a beneficiary mid-conversation:

* **State travels with every turn.** The client posts `slots` and `stage` alongside `sessionId`, and `/api/conversation/message` also accepts turns with no session at all. If MongoDB is briefly unreachable, the session row was evicted, or the request lands on a cold serverless instance that never saw the conversation, the turn is still answered correctly and the session is recreated with the client state.
* **The deterministic engine owns the flow; GPT-4o only rephrases.** LLM output is validated (language, length, and it must still ask the pending question) — an unusable model reply is discarded and the scripted reply is spoken instead. A model outage can never skip a question or lose an answer.
* **Speech is browser-native by default.** `window.SpeechRecognition` + `window.speechSynthesis` need no keys, no quota and no network. Server Whisper/TTS is only attempted when `/api/config` reports a live key, and any failure permanently trips a circuit breaker back to the free path — including the OpenAI `insufficient_quota` 429 that used to freeze the demo.
* **The greeting is spoken from the client.** The first audio happens inside the user's tap, which is what iOS/Safari require; the server session is created in the background.
* **Final profile always exists.** If `/api/profile/extract` cannot persist (no DB), the profile is stored in `localStorage` and `/profile/[id]` + `/recommendations/[id]` still render it.
