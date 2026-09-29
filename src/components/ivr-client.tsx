// IVR channel page — explainer + the self-contained PhoneSimulation.
// The entire interview now happens INSIDE the handset: no redirect to /talk.
"use client";

import PhoneSimulation from "@/components/phone-simulation";
import { useAppLang } from "@/components/page-shell";
import { LANGS } from "@/data/i18n";

export default function IVRClient() {
  const [lang, setLang] = useAppLang();

  const steps: [string, string][] = [
    ["Dial the toll-free number", "Press the green call button — the network connects (simulated ringback tone)."],
    ["Choose a language by keypress", LANGS.map((l, i) => `${i + 1}) ${l.native}`).join("  ")],
    ["Talk — that's it", "The agent asks, you answer out loud. Everything is audio: no screen, no typing, no app."],
  ];

  return (
    <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 py-10 lg:grid-cols-[1fr_auto]">
      {/* explainer */}
      <div className="rise">
        <p className="text-[11px] font-bold uppercase tracking-widest text-saffron-600">
          Channel 2 — zero-internet access
        </p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 md:text-3xl">
          Call via feature phone (IVR simulation)
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Most beneficiaries carry a basic feature phone. JeevikaSetu meets them there — a toll-free
          number, a voice menu in six languages, and the same AI interview over a plain phone call.
          This simulator runs the <b>complete call inside the handset</b>, exactly as it would on a
          ₹1,200 keypad phone.
        </p>

        <ol className="mt-6 space-y-3">
          {steps.map(([h, d], i) => (
            <li key={h} className={`gov-card rise flex gap-4 p-4 rise-${i + 1}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-extrabold text-white">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-bold text-navy-900">{h}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{d}</p>
              </div>
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-xl border border-navy-900/15 bg-navy-50 p-4 text-xs leading-relaxed text-navy-800">
          <b>Speech stack:</b> recognition and playback run on free browser-native APIs
          (<code className="mx-1 rounded bg-white px-1">webkitSpeechRecognition</code> /
          <code className="mx-1 rounded bg-white px-1">speechSynthesis</code>) in the caller&apos;s
          selected locale — hi-IN, en-IN, ta-IN, te-IN, mr-IN, bn-IN.
        </div>

        <div className="mt-3 rounded-xl border border-saffron-500/30 bg-saffron-50 p-4 text-xs leading-relaxed text-saffron-600">
          <b>Production note:</b> the live build binds this flow to a telephony provider
          (Exotel / Twilio / Vapi) whose inbound webhooks hit the same
          <code className="mx-1 rounded bg-white px-1">/api/conversation/message</code> pipeline,
          so the phone and web channels stay in perfect parity.
        </div>
      </div>

      {/* handset */}
      <div className="rise rise-2">
        <PhoneSimulation initialLang={lang} onLangChange={setLang} />
        <p className="mt-3 max-w-[330px] text-center text-[11px] leading-snug text-slate-400">
          Allow microphone access when prompted — the call is fully voice-driven.
        </p>
      </div>
    </div>
  );
}
