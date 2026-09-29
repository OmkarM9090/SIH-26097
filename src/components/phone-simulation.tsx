// ─────────────────────────────────────────────────────────────────────────────
// JeevikaSetu — PHONE SIMULATION (IVR / feature-phone channel)
//
// SELF-CONTAINED: the whole interview happens INSIDE the handset UI. There is
// no redirect to the web voice agent and deliberately NO chat bubbles — a
// feature-phone user only hears audio. The screen shows what a real call shows:
// caller, live duration timer, speaker state and a red End Call button.
//
// Voice: window.speechSynthesis (out) + webkitSpeechRecognition (in) — free.
// Brain: /api/conversation/message with an automatic client-side mock fallback.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConversationReply, LangCode, Stage } from "@/lib/types";
import { IVR_MENU, LANGS, t, tx, stageLabel, LANG_NAME } from "@/data/i18n";
import { STAGES } from "@/lib/conversation";
import { createOfflineSession, offlineStep, saveLocalProfile, type OfflineSession } from "@/lib/offline-agent";
import {
  listen, speak, stopSpeaking, supportsBrowserSTT, warmUpSpeech, tripSpeechBreaker,
  type ListenHandle,
} from "@/lib/speech-client";
import { isForcedMock } from "@/lib/demo-mode";

type Phase = "dial" | "ringing" | "menu" | "incall" | "ended";
type Line = "idle" | "speaking" | "listening" | "thinking";

const KEY_TO_LANG: Record<string, LangCode> = {
  "1": "hi", "2": "en", "3": "ta", "4": "te", "5": "mr", "6": "bn",
};
const TOLL_FREE = "1800 102 6060";
const QUESTION_STAGES = STAGES.filter((s) => s !== "done") as Stage[];

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

export default function PhoneSimulation({
  initialLang = "hi",
  onLangChange,
}: {
  initialLang?: LangCode;
  onLangChange?: (l: LangCode) => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("dial");
  const [line, setLine] = useState<Line>("idle");
  const [dialed, setDialed] = useState("");
  const [lang, setLang] = useState<LangCode>(initialLang);
  const [seconds, setSeconds] = useState(0);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  const [stage, setStage] = useState<Stage>("name");
  const [offline, setOffline] = useState(false);
  const [notice, setNotice] = useState("");
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(null);

  const langRef = useRef<LangCode>(initialLang);
  const sessionRef = useRef<string | null>(null);
  const mockRef = useRef<OfflineSession | null>(null);
  const offlineRef = useRef(false);
  const listenRef = useRef<ListenHandle | null>(null);
  const liveRef = useRef(false);            // call is active
  const speakerRef = useRef(true);
  const micMutedRef = useRef(false);
  const actxRef = useRef<AudioContext | null>(null);
  langRef.current = lang;
  speakerRef.current = speakerOn;
  micMutedRef.current = micMuted;

  // ───────────────────────────────────────────────────── call duration timer
  useEffect(() => {
    if (phase !== "incall" && phase !== "menu") return;
    const id = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // ─────────────────────────────────────────────────────────── telephony SFX
  const ctx = () => {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    actxRef.current ??= new AC();
    void actxRef.current.resume();
    return actxRef.current;
  };

  const dtmf = useCallback((key: string) => {
    try {
      const c = ctx();
      const table: Record<string, [number, number]> = {
        "1": [697, 1209], "2": [697, 1336], "3": [697, 1477],
        "4": [770, 1209], "5": [770, 1336], "6": [770, 1477],
        "7": [852, 1209], "8": [852, 1336], "9": [852, 1477],
        "*": [941, 1209], "0": [941, 1336], "#": [941, 1477],
      };
      const [f1, f2] = table[key] ?? [600, 800];
      [f1, f2].forEach((f) => {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.frequency.value = f;
        g.gain.setValueAtTime(0.07, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.16);
        osc.connect(g).connect(c.destination);
        osc.start();
        osc.stop(c.currentTime + 0.17);
      });
    } catch { /* audio blocked */ }
  }, []);

  /** Indian ringback: 400+425 Hz, 0.4s on / 0.2s off / 0.4s on. */
  const ringback = useCallback(() => {
    try {
      const c = ctx();
      const beep = (start: number, dur: number) => {
        const g = c.createGain();
        g.gain.setValueAtTime(0, start);
        g.gain.linearRampToValueAtTime(0.09, start + 0.04);
        g.gain.setValueAtTime(0.09, start + dur - 0.04);
        g.gain.linearRampToValueAtTime(0, start + dur);
        g.connect(c.destination);
        [400, 425].forEach((f) => {
          const o = c.createOscillator();
          o.frequency.value = f;
          o.connect(g);
          o.start(start);
          o.stop(start + dur);
        });
      };
      const now = c.currentTime;
      beep(now, 0.4);
      beep(now + 0.6, 0.4);
    } catch { /* noop */ }
  }, []);

  const hangupTone = useCallback(() => {
    try {
      const c = ctx();
      const o = c.createOscillator();
      const g = c.createGain();
      o.frequency.value = 480;
      g.gain.setValueAtTime(0.08, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.5);
      o.connect(g).connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.52);
    } catch { /* noop */ }
  }, []);

  // ───────────────────────────────────────────────── speak over the "line"
  const say = useCallback(async (text: string, l: LangCode) => {
    if (!liveRef.current) return;
    setLine("speaking");
    if (speakerRef.current) await speak(text, l);
    if (liveRef.current) setLine("idle");
  }, []);

  const goOffline = useCallback((reason: string) => {
    if (offlineRef.current) return;
    offlineRef.current = true;
    setOffline(true);
    tripSpeechBreaker(reason);
  }, []);

  // ───────────────────────────────────────────────────────────── one turn
  const turn = useCallback(async (userText: string): Promise<ConversationReply | null> => {
    if (!userText.trim() || !liveRef.current) return null;
    setLine("thinking");
    const l = langRef.current;
    let data: ConversationReply | null = null;

    if (!offlineRef.current && sessionRef.current && !sessionRef.current.startsWith("local-")) {
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 9000);
        const res = await fetch("/api/conversation/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionRef.current, channel: "ivr", lang: l, userText }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as ConversationReply & { error?: string };
        if (j.error || !j.reply) throw new Error(j.error ?? "empty");
        data = j;
        if (mockRef.current) {
          mockRef.current = { ...mockRef.current, slots: j.slots ?? {}, stage: j.stage, done: j.done, lang: j.language };
        }
      } catch (e) {
        goOffline(String(e));
      }
    }

    if (!data) {
      if (!mockRef.current) mockRef.current = createOfflineSession(l).session;
      const stepped = offlineStep(mockRef.current, userText, l);
      mockRef.current = stepped.session;
      data = stepped.reply;
      await new Promise((r) => setTimeout(r, 350));
    }

    if (!liveRef.current) return data;
    setStage(data.stage);
    await say(data.reply, data.language);
    return data;
  }, [goOffline, say]);

  // ─────────────────────────────────────────────────────────── hang up
  const hangUp = useCallback((completed = false) => {
    liveRef.current = false;
    listenRef.current?.abort();
    listenRef.current = null;
    stopSpeaking();
    hangupTone();
    setLine("idle");
    setPhase(completed ? "ended" : "dial");
    if (!completed) {
      setSeconds(0);
      setStage("name");
      sessionRef.current = null;
      mockRef.current = null;
    }
  }, [hangupTone]);

  // ─────────────────────────────────────────────────── end of the interview
  const finishCall = useCallback(async () => {
    const slots = mockRef.current?.slots ?? {};
    let id: string | null = null;
    if (!offlineRef.current) {
      try {
        const res = await fetch("/api/profile/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            sessionRef.current && !sessionRef.current.startsWith("local-")
              ? { conversationId: sessionRef.current, lang: langRef.current, channel: "ivr" }
              : { slots, lang: langRef.current, channel: "ivr" },
          ),
        });
        if (res.ok) id = ((await res.json()) as { id?: string }).id ?? null;
      } catch { /* local fallback below */ }
    }
    if (!id) id = saveLocalProfile(slots, langRef.current, "ivr");
    setBeneficiaryId(id);
    hangUp(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────────────────────────────────────────── hands-free listening loop
  const listenOnce = useCallback(() => {
    if (!liveRef.current || micMutedRef.current) return;
    if (!supportsBrowserSTT()) { setNotice(tx("stt_unsupported", langRef.current)); return; }
    listenRef.current?.abort();

    const handle = listen(langRef.current, {
      onFinal: async (txt) => {
        listenRef.current = null;
        if (!liveRef.current) return;
        const res = await turn(txt);
        if (res?.done) { await finishCall(); return; }
        if (liveRef.current) window.setTimeout(listenOnceRef.current!, 350);
      },
      onEnd: () => {
        if (listenRef.current) {
          listenRef.current = null;
          if (liveRef.current) {
            setLine("idle");
            // caller stayed silent — re-open the line (like a real IVR would)
            window.setTimeout(() => { if (liveRef.current) listenOnceRef.current?.(); }, 600);
          }
        }
      },
      onError: (err) => {
        listenRef.current = null;
        if (err === "not-allowed" || err === "service-not-allowed") {
          setNotice(tx("mic_denied", langRef.current));
          return;
        }
        if (liveRef.current && err !== "aborted") {
          window.setTimeout(() => { if (liveRef.current) listenOnceRef.current?.(); }, 700);
        }
      },
    });
    if (handle) { listenRef.current = handle; setLine("listening"); }
  }, [turn]);

  const listenOnceRef = useRef<typeof listenOnce | null>(null);
  listenOnceRef.current = listenOnce;

  // ─────────────────────────────────────────────────────────── call control
  const startCall = useCallback(async () => {
    warmUpSpeech();             // unlock audio on this user gesture
    setNotice("");
    setSeconds(0);
    setPhase("ringing");
    ringback();
    await new Promise((r) => setTimeout(r, 1500));
    ringback();
    await new Promise((r) => setTimeout(r, 1300));

    liveRef.current = true;
    setPhase("menu");
    setLine("speaking");
    await speak(IVR_MENU[langRef.current] ?? IVR_MENU.en, langRef.current);
    if (liveRef.current) setLine("idle");
  }, [ringback]);

  const chooseLanguage = useCallback(async (code: LangCode) => {
    stopSpeaking();
    setLang(code);
    langRef.current = code;
    onLangChange?.(code);
    setPhase("incall");
    liveRef.current = true;

    // open the interview (backend first, mock engine on any failure)
    const seed = createOfflineSession(code);
    mockRef.current = seed.session;
    let reply: ConversationReply = seed.reply;
    try {
      if (isForcedMock()) throw new Error("forced mock mode");
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);
      const res = await fetch("/api/conversation/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "ivr", lang: code }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as ConversationReply & { error?: string };
      if (j.error || !j.reply) throw new Error(j.error ?? "empty");
      sessionRef.current = j.id;
      reply = j;
    } catch (e) {
      goOffline(String(e));
      sessionRef.current = seed.session.id;
    }

    setStage(reply.stage);
    await say(reply.reply, reply.language);
    if (liveRef.current) listenOnceRef.current?.();
  }, [goOffline, onLangChange, say]);

  useEffect(() => () => {
    liveRef.current = false;
    listenRef.current?.abort();
    stopSpeaking();
  }, []);

  // ─────────────────────────────────────────────────────────────── keypad
  const pressKey = (k: string) => {
    dtmf(k);
    if (phase === "dial") { setDialed((d) => (d + k).slice(0, 14)); return; }
    if (phase === "menu") {
      const code = KEY_TO_LANG[k];
      if (!code) { setNotice("Press 1–6"); return; }
      setNotice("");
      void chooseLanguage(code);
    }
  };

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];
  const stageIdx = QUESTION_STAGES.indexOf(stage === "done" ? "confirm" : stage);
  const lineLabel =
    line === "speaking" ? t("speaking", lang) :
    line === "listening" ? tx("speak_now", lang) :
    line === "thinking" ? "•••" : tx("in_call", lang);

  return (
    <div className="flex justify-center">
      {/* ───────────────────────────── handset */}
      <div className="w-[330px] select-none rounded-[2.4rem] border-[12px] border-navy-950 bg-navy-950 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.6)]">
        {/* speaker grille */}
        <div className="mx-auto mb-2 mt-1 h-1 w-14 rounded-full bg-white/20" />

        {/* ── SCREEN */}
        <div
          className={`relative overflow-hidden rounded-[1.5rem] px-4 pb-4 pt-4 transition-colors duration-500 ${
            phase === "incall" || phase === "menu"
              ? "bg-gradient-to-b from-navy-900 to-navy-950"
              : phase === "ended"
                ? "bg-gradient-to-b from-greenIndia-600 to-navy-950"
                : "bg-gradient-to-b from-slate-100 to-slate-200"
          }`}
        >
          {/* status bar */}
          <div className={`mb-3 flex items-center justify-between text-[10px] font-bold ${phase === "dial" ? "text-slate-500" : "text-white/70"}`}>
            <span className="flex items-center gap-1">
              <span className="flex items-end gap-[1.5px]">
                {[3, 5, 7, 9].map((h) => (
                  <span key={h} className={`w-[3px] rounded-sm ${phase === "dial" ? "bg-slate-500" : "bg-white/70"}`} style={{ height: h }} />
                ))}
              </span>
              BSNL 2G
            </span>
            <span suppressHydrationWarning>
              {phase === "dial" ? "IVR SIM" : mmss(seconds)}
            </span>
            <span>🔋 82%</span>
          </div>

          {/* ─────────────── DIAL SCREEN */}
          {phase === "dial" && (
            <div className="rounded-2xl bg-white/90 p-4 text-center shadow-inner">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Toll-free</p>
              <p className="mt-1 min-h-[28px] font-mono text-xl font-extrabold tracking-widest text-navy-900">
                {dialed || TOLL_FREE}
              </p>
              <p className="mt-2 text-[11px] leading-snug text-slate-500">
                PM-AJAY JeevikaSetu · 24×7 · {LANGS.length} languages
              </p>
            </div>
          )}

          {/* ─────────────── RINGING / IN CALL */}
          {(phase === "ringing" || phase === "menu" || phase === "incall") && (
            <div className="text-center text-white">
              <div className="relative mx-auto mb-3 grid h-20 w-20 place-items-center rounded-full bg-white/10">
                {(line === "speaking" || phase === "ringing") && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-saffron-500/30" />
                )}
                <span className="text-3xl">🇮🇳</span>
              </div>
              <p className="text-base font-extrabold tracking-tight">JeevikaSetu IVR</p>
              <p className="font-mono text-[11px] text-white/60">{TOLL_FREE}</p>

              <p className="mt-3 text-[13px] font-bold text-saffron-400">
                {phase === "ringing" ? tx("calling", lang) : lineLabel}
              </p>
              <p className="mt-0.5 font-mono text-2xl font-black tabular-nums tracking-wider text-white">
                {phase === "ringing" ? "00:00" : mmss(seconds)}
              </p>

              {/* voice activity bars — the only "visualisation" a phone gets */}
              <div className="mt-3 flex h-8 items-end justify-center gap-[3px]">
                {Array.from({ length: 13 }).map((_, i) => (
                  <span
                    key={i}
                    className={`w-[4px] rounded-full transition-all ${
                      line === "listening" ? "speak-bar bg-red-400"
                        : line === "speaking" ? "speak-bar bg-saffron-400"
                          : "bg-white/20"
                    }`}
                    style={{
                      height: line === "idle" || line === "thinking" ? 6 : 8 + ((i * 7) % 20),
                      animationDelay: `${i * 0.07}s`,
                    }}
                  />
                ))}
              </div>

              {phase === "menu" && (
                <div className="mt-3 rounded-xl bg-black/25 p-2.5 text-left">
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-white/50">
                    Press a key
                  </p>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[11px] font-semibold text-white/90">
                    {LANGS.map((l, i) => (
                      <span key={l.code}>{i + 1} · {l.native}</span>
                    ))}
                  </div>
                </div>
              )}

              {phase === "incall" && (
                <div className="mt-3 rounded-xl bg-black/25 px-3 py-2">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-white/50">
                    <span>{LANG_NAME[lang]}</span>
                    <span>{stageLabel(stage, lang)}</span>
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {QUESTION_STAGES.map((s, i) => (
                      <span key={s} className={`h-1 flex-1 rounded-full ${i <= stageIdx ? "bg-saffron-400" : "bg-white/20"}`} />
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] leading-snug text-white/50">{tx("ivr_hint", lang)}</p>
                </div>
              )}

              {offline && (
                <p className="mt-2 text-[9px] font-bold uppercase tracking-wider text-saffron-400/80">
                  on-device engine
                </p>
              )}
            </div>
          )}

          {/* ─────────────── CALL ENDED */}
          {phase === "ended" && (
            <div className="py-3 text-center text-white">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/15 text-3xl">✓</span>
              <p className="mt-3 text-base font-extrabold">{tx("call_ended", lang)}</p>
              <p className="font-mono text-sm text-white/70">{mmss(seconds)}</p>
              <p className="mt-2 text-[12px] font-semibold text-white/90">{tx("profile_ready", lang)}</p>
              {beneficiaryId && (
                <button
                  onClick={() => router.push(`/profile/${beneficiaryId}`)}
                  className="mt-3 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-extrabold text-navy-900 shadow-lg transition hover:bg-saffron-100"
                >
                  {tx("profile_ready", lang)} →
                </button>
              )}
              <button
                onClick={() => { setPhase("dial"); setSeconds(0); setBeneficiaryId(null); setStage("name"); setDialed(""); }}
                className="mt-2 w-full rounded-xl border border-white/30 px-4 py-2 text-xs font-bold text-white/80"
              >
                {tx("restart", lang)}
              </button>
            </div>
          )}

          {notice && (
            <p className="mt-2 rounded-lg bg-red-500/90 px-2 py-1.5 text-center text-[10px] font-bold text-white">
              {notice}
            </p>
          )}
        </div>

        {/* ── IN-CALL CONTROLS (speaker / mute) */}
        {(phase === "incall" || phase === "menu") && (
          <div className="grid grid-cols-3 gap-2 px-4 pt-3">
            <button
              onClick={() => { const n = !speakerOn; setSpeakerOn(n); if (!n) stopSpeaking(); }}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold transition ${speakerOn ? "bg-white text-navy-900" : "bg-white/10 text-white/70"}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
                <path d="M4 9v6h4l5 4V5L8 9H4z" />
                {speakerOn && <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
              </svg>
              {tx("speaker", lang)}
            </button>
            <button
              onClick={() => {
                const n = !micMuted;
                setMicMuted(n);
                micMutedRef.current = n;
                if (n) { listenRef.current?.abort(); listenRef.current = null; setLine("idle"); }
                else if (phase === "incall") listenOnceRef.current?.();
              }}
              className={`flex flex-col items-center gap-1 rounded-xl py-2 text-[10px] font-bold transition ${micMuted ? "bg-red-500 text-white" : "bg-white/10 text-white/70"}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
                {micMuted && <path d="M4 4l16 16" strokeLinecap="round" />}
              </svg>
              Mute
            </button>
            <button
              onClick={() => { listenRef.current?.abort(); listenRef.current = null; stopSpeaking(); if (phase === "incall") listenOnceRef.current?.(); }}
              className="flex flex-col items-center gap-1 rounded-xl bg-white/10 py-2 text-[10px] font-bold text-white/70 transition hover:bg-white/20"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12a9 9 0 019-9 9 9 0 016.7 3M21 12a9 9 0 01-9 9 9 9 0 01-6.7-3" strokeLinecap="round" /><path d="M18 3v4h-4M6 21v-4h4" strokeLinecap="round" />
              </svg>
              Retry
            </button>
          </div>
        )}

        {/* ── KEYPAD (dial + IVR menu) */}
        {(phase === "dial" || phase === "menu") && (
          <div className="grid grid-cols-3 gap-2 p-4">
            {keys.map((k, i) => (
              <button
                key={k}
                onClick={() => pressKey(k)}
                className={`aspect-square rounded-2xl text-xl font-extrabold transition active:scale-95 ${
                  phase === "menu" && KEY_TO_LANG[k]
                    ? "bg-saffron-500/90 text-white hover:bg-saffron-500"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                {k}
                <span className="block text-[8px] font-medium tracking-widest text-white/50">
                  {phase === "menu" && KEY_TO_LANG[k]
                    ? LANGS.find((l) => l.code === KEY_TO_LANG[k])?.native
                    : "ABC DEF GHI JKL MNO PQRS TUV WXYZ".split(" ")[i - 1] ?? ""}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* ── CALL BUTTONS */}
        <div className="flex items-center justify-center gap-6 px-4 pb-6 pt-3">
          {phase === "dial" || phase === "ended" ? (
            <button
              onClick={() => void startCall()}
              className="grid h-16 w-16 place-items-center rounded-full bg-greenIndia-500 text-white shadow-lg shadow-greenIndia-500/40 transition hover:brightness-110 active:scale-95"
              title={tx("start_call", lang)}
              aria-label={tx("start_call", lang)}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor">
                <path d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => hangUp(false)}
              className="flex h-16 w-full items-center justify-center gap-2 rounded-full bg-red-600 text-white shadow-lg shadow-red-600/40 transition hover:brightness-110 active:scale-95"
              title={tx("end_call", lang)}
              aria-label={tx("end_call", lang)}
            >
              <svg viewBox="0 0 24 24" className="h-7 w-7 rotate-[135deg]" fill="currentColor">
                <path d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
              </svg>
              <span className="text-sm font-extrabold">{tx("end_call", lang)}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
