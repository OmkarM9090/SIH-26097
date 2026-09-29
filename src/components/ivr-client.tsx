// IVR Simulation (Module 6.6) — feature-phone dial pad with real DTMF tones.
// Flow: dial → connect → spoken IVR menu → keypress language choice →
// hands over to the live voice interview with channel=ivr.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LangCode } from "@/lib/types";
import { IVR_MENU, LANGS, t } from "@/data/i18n";
import { speak, stopSpeaking } from "@/lib/speech-client";
import { useAppLang } from "@/components/page-shell";

type Phase = "idle" | "dialing" | "menu" | "chosen" | "connecting";

const KEY_TO_LANG: Record<string, LangCode> = {
  "1": "hi", "2": "en", "3": "ta", "4": "te", "5": "mr", "6": "bn",
};

export default function IVRClient() {
  const router = useRouter();
  const [lang] = useAppLang();
  const [phase, setPhase] = useState<Phase>("idle");
  const [dialed, setDialed] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [selected, setSelected] = useState<LangCode | null>(null);
  const actxRef = useRef<AudioContext | null>(null);

  const pushLog = (line: string) => setLog((p) => [...p.slice(-5), line]);

  // classic DTMF dual-tone beep
  const tone = useCallback((key: string) => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      actxRef.current ??= new AC();
      const ctx = actxRef.current;
      const table: Record<string, [number, number]> = {
        "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
        "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
        "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
        "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
      };
      const [f1, f2] = table[key] ?? [600, 800];
      [f1, f2].forEach((f) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.17);
      });
    } catch { /* audio blocked */ }
  }, []);

  // India ringback tone (400Hz + 425Hz, 0.4s on, 0.2s off, 0.4s on, 2s off)
  const ringback = useCallback(() => {
    try {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      actxRef.current ??= new AC();
      const ctx = actxRef.current;
      
      const playTone = (start: number, duration: number) => {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();
        osc1.frequency.value = 400;
        osc2.frequency.value = 425;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.1, start + 0.05);
        gain.gain.setValueAtTime(0.1, start + duration - 0.05);
        gain.gain.linearRampToValueAtTime(0, start + duration);
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);
        osc1.start(start);
        osc2.start(start);
        osc1.stop(start + duration);
        osc2.stop(start + duration);
      };

      const now = ctx.currentTime;
      playTone(now, 0.4);
      playTone(now + 0.6, 0.4);
    } catch { /* audio blocked */ }
  }, []);

  const startCall = useCallback(async () => {
    stopSpeaking();
    setPhase("dialing");
    pushLog(`Dialing 1800-102-PMAJ (toll-free)…`);
    ringback();
    await new Promise((r) => setTimeout(r, 1400));
    ringback();
    await new Promise((r) => setTimeout(r, 1200));
    pushLog("Connected · PM-AJAY JeevikaSetu seva");
    setPhase("menu");
    await speak(IVR_MENU[lang] ?? IVR_MENU.en, lang);
  }, [lang]);

  const pressKey = useCallback(
    async (k: string) => {
      tone(k);
      if (phase === "idle") {
        setDialed((d) => (d + k).slice(0, 12));
        return;
      }
      if (phase === "menu" || phase === "chosen") {
        const code = KEY_TO_LANG[k];
        if (!code) { pushLog("Invalid option — dabayen 1–6"); return; }
        stopSpeaking();
        setSelected(code);
        setPhase("chosen");
        const name = LANGS.find((l) => l.code === code)?.english ?? "Hindi";
        pushLog(`Selected: ${name} — connecting to AI agent…`);
        setPhase("connecting");
        await new Promise((r) => setTimeout(r, 900));
        router.push(`/talk?channel=ivr&lang=${code}`);
      }
    },
    [phase, router, tone],
  );

  useEffect(() => () => stopSpeaking(), []);

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 lg:grid-cols-[1fr_auto]">
      {/* explainer */}
      <div className="rise">
        <p className="text-[11px] font-bold uppercase tracking-widest text-saffron-600">Channel 2 — Zero-internet access</p>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 md:text-3xl">
          IVR तoll-free simulation
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-600">
          Most beneficiaries carry basic feature phones. JeevikaSetu meets them there:
          a missed-call / toll-free number, voice menu in six languages, and the same
          AI interview over a plain phone call — no smartphone, no app, no data.
        </p>
        <ol className="mt-6 space-y-3">
          {[
            ["Dial the toll-free number", "Press the call button — the network connects instantly (simulated)."],
            ["Choose language by keypress", "1) हिन्दी  2) English  3) தமிழ்  4) తెలుగు  5) मराठी  6) বাংলা"],
            ["Talk naturally", "The same AI agent continues the interview — answers are simply spoken."],
          ].map(([h, d], i) => (
            <li key={h} className={`gov-card rise flex gap-4 p-4 rise-${i + 1}`}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-navy-900 text-sm font-extrabold text-white">{i + 1}</span>
              <div>
                <p className="text-sm font-bold text-navy-900">{h}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{d}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-6 rounded-xl border border-saffron-500/30 bg-saffron-50 p-4 text-xs leading-relaxed text-saffron-600">
          <b>Production note:</b> the live build connects this flow to a telephony provider
          (Twilio/Vapi/Exotel-style) with inbound webhooks hitting the same
          <code className="mx-1 rounded bg-white px-1">/api/conversation/message</code> pipeline.
        </div>
      </div>

      {/* phone */}
      <div className="rise rise-2 flex justify-center">
        <div className="w-[300px] rounded-[2.2rem] border-[10px] border-navy-950 bg-navy-950 shadow-2xl">
          {/* screen */}
          <div className="rounded-[1.4rem] bg-gradient-to-b from-emerald-50 to-teal-50 px-4 pb-3 pt-5">
            <div className="mb-3 flex items-center justify-between text-[10px] font-bold text-slate-500">
              <span className="flex items-center gap-1">
                <span className="flex items-end gap-[1.5px]">
                  {[3, 5, 7, 9].map((h) => <span key={h} className="w-[3px] rounded-sm bg-slate-500" style={{ height: h }} />)}
                </span>
                AirTel
              </span>
              <span>{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="rounded-xl bg-white/80 p-3 text-center shadow-inner">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {phase === "idle" ? "Dial toll-free" : phase === "dialing" ? "Connecting…" : "In call · 00:" + String(Math.floor(Math.random() * 50) + 10).padStart(2, "0")}
              </p>
              <p className="mt-1 font-mono text-lg font-extrabold tracking-widest text-navy-900">
                {dialed || "1800-102-6060"}
              </p>
              {phase !== "idle" && (
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className="speak-bar h-4 w-1 rounded bg-greenIndia-500" style={{ animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
              )}
              {selected && <p className="mt-1 text-xs font-bold text-greenIndia-600">✓ {LANGS.find((l) => l.code === selected)?.english} selected</p>}
            </div>
            {/* call log */}
            <div className="nice-scroll mt-2 h-20 space-y-1 overflow-y-auto rounded-lg bg-navy-950/90 p-2 font-mono text-[10px] leading-relaxed text-emerald-300">
              {log.length ? log.map((l, i) => <p key={i}>&gt; {l}</p>) : <p className="text-emerald-600/60">&gt; JeevikaSetu IVR ready…</p>}
            </div>
          </div>

          {/* keypad */}
          <div className="grid grid-cols-3 gap-2 p-4">
            {keys.map((k) => (
              <button
                key={k}
                onClick={() => void pressKey(k)}
                className="aspect-square rounded-2xl bg-white/10 text-xl font-extrabold text-white transition hover:bg-white/20 active:scale-95"
              >
                {k}
                <span className="block text-[8px] font-medium tracking-widest text-white/40">
                  {"ABC DEF GHI JKL MNO PQRS TUV WXYZ".split(" ")[keys.indexOf(k) - 1] ?? ""}
                </span>
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3 pb-6">
            <button
              onClick={() => void startCall()}
              disabled={phase !== "idle"}
              className="grid h-14 w-14 place-items-center rounded-full bg-greenIndia-500 text-white shadow-lg shadow-greenIndia-500/40 transition hover:brightness-110 active:scale-95 disabled:opacity-40"
              title={t("press_connect", lang)}
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor"><path d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" /></svg>
            </button>
            <button
              onClick={() => { stopSpeaking(); setPhase("idle"); setDialed(""); setSelected(null); pushLog("Call ended"); }}
              className="grid h-14 w-14 place-items-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/40 transition hover:brightness-110 active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 rotate-[135deg]" fill="currentColor"><path d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" /></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
