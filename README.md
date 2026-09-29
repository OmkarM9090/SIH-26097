# JeevikaSetu — जीविकासेतु

**AI-driven, multilingual voice assistant for livelihood mapping and NSQF-aligned skilling
recommendations for SC communities under the GIA component of PM-AJAY.**

Smart India Hackathon 2026 · Problem Statement **26097** · Ministry of Social Justice & Empowerment.

---

## What it does

1. **Voice-first AI interview (Module 1-2)** — A warm, field-worker-style AI agent conducts a
   structured livelihood interview by voice in **Hindi, English, Tamil, Telugu, Marathi, Bengali**
   (auto language detection; same-language spoken replies). No forms, no typing.
2. **Beneficiary profiling (Module 3)** — The conversation is converted into a structured
   beneficiary profile: informal/traditional skills are mapped to formal competency tags.
3. **NSQF mapping & skill-gap analysis (Module 4)** — 44 curated Qualification Packs across 15
   sectors; ranking by `skill_overlap×0.3 + interest×0.3 + income×0.2 + accessibility×0.2`,
   explicit skill-gap lists, and **RPL detection** when prior-experience overlap ≥ 80%.
4. **Opportunity matching (Module 5)** — 22 PMKK-style training centres, 50 curated job &
   self-employment opportunities, and per-pathway **PM-AJAY GIA benefit mapping** (training
   support, wage compensation, toolkit grants, RPL support, enterprise capital).
5. **Channels (Modules 6 & 8)** — Progressive web app, **IVR feature-phone simulator** with real
   DTMF tones, and a **WhatsApp voice-note** interface — sharing one pipeline.
6. **Officials dashboard (Module 6)** — Live aggregates: language/channel mix, sector demand,
   district heat, RPL share, beneficiary registry, GIA instruments.
7. **Printable report** — One-click PDF/print recommendation report per beneficiary.

## AI modes (demo-safe by design)

| Mode | When | STT | Dialogue | TTS |
| --- | --- | --- | --- | --- |
| **GPT-4o live** | `OPENAI_API_KEY` set | Whisper API | GPT-4o | OpenAI TTS |
| **Offline engine** | no key (default) | Browser SpeechRecognition | Built-in multilingual interview engine + NLU | Browser speechSynthesis |

Either way, the full pipeline (profile → NSQF matching → RPL → GIA → dashboard) is identical
and always works — **perfect for presentation rooms without reliable internet**.

## Run locally

```bash
npm install
npx drizzle-kit push     # create tables (PostgreSQL via DATABASE_URL)
npm run build && npm run start
# open http://localhost:3000
```

Optional: add `OPENAI_API_KEY=sk-...` to `.env` for live GPT-4o/Whisper/TTS.

For the SIH demo: project runs with zero keys. Press **Run auto-demo** on the landing page for a
hands-free walkthrough (Ramesh Kumar, Varanasi) across the entire pipeline.

## Demo script (3–5 min)

Landing → Voice conversation (Hindi) → live transcript → extracted profile → NSQF
recommendations with skill gaps → **RPL eligibility for leather work** → nearest centres on map →
GIA benefits → IVR simulation → WhatsApp voice notes → officials dashboard.

## API surface

```
POST /api/voice/transcribe        audio blob → transcript (Whisper)
POST /api/voice/synthesize        text + lang → audio/mpeg
POST /api/conversation/message    one interview turn (slots + stage + reply)
POST /api/profile/extract         slots → BeneficiaryProfile (persisted)
POST /api/recommend               profile → ranked NSQF recommendations
GET  /api/beneficiaries/:id       profile + recommendations (PATCH to correct)
GET  /api/training-centers        ?district&qp&sector filters
GET  /api/opportunities           ?district&type=job|self
GET  /api/nsqf                    qualification packs, sector facets
GET  /api/dashboard/stats         program-monitoring aggregates
POST /api/seed                    idempotent demo persona seeding
GET  /api/health                  healthcheck
```

## Stack

Next.js (App Router, TypeScript) · Tailwind CSS · PostgreSQL + Drizzle ORM ·
OpenAI GPT-4o/Whisper/TTS (optional) · Web Speech APIs · custom SVG charts/maps
(offline-safe, zero heavy dependencies).

---

*Prototype with curated sample data for hackathon evaluation. Production build roadmap:
Bhashini ASR/TTS, Twilio/Vapi telephony, SIDH/NCS/UDYAM integration, backward and forward
linkage (BFL) pipelines with PMJAY/NSFDC disbursement rails.*
