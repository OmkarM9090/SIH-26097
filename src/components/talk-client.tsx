// ─────────────────────────────────────────────────────────────────────────────
// JeevikaSetu — VOICE AGENT  (browser-native, quota-proof)
//
//  STT      : window.SpeechRecognition / window.webkitSpeechRecognition  (free)
//  TTS      : window.speechSynthesis                                     (free)
//  AI logic : /api/conversation/message  →  on ANY failure (429 / 5xx / offline)
//             the client-side Mock Conversation State Machine takes over and
//             the interview continues seamlessly.
//  UI       : optimistic — the user's words render the instant they are spoken
//             or typed; a "JeevikaSetu is typing…" loader covers the wait.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, ChatTurn, ConversationReply, LangCode, Stage } from "@/lib/types";
import { QUESTIONS, t, tx, stageLabel, LANGS, LANG_NAME } from "@/data/i18n";
import { RAMESH_PERSONA } from "@/data/personas";
import { STAGES } from "@/lib/conversation";
import {
  createOfflineSession, offlineStep, saveLocalProfile, type OfflineSession,
} from "@/lib/offline-agent";
import {
  listen, speak, stopSpeaking, supportsBrowserSTT, warmUpSpeech,
  setBrowserNativeOnly, tripSpeechBreaker, type ListenHandle,
} from "@/lib/speech-client";
import { useAppLang } from "@/components/page-shell";
import { isForcedMock } from "@/lib/demo-mode";

type Status = "boot" | "idle" | "listening" | "thinking" | "speaking" | "done" | "error";

const QUESTION_STAGES = STAGES.filter((s) => s !== "done") as Stage[];
const FETCH_TIMEOUT = 9000;

/** fetch with a hard timeout — a hanging backend must never freeze the demo. */
async function fetchWithTimeout(url: string, init: RequestInit, ms = FETCH_TIMEOUT): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default function TalkClient({
  channel, langOverride, demo,
}: {
  channel: Channel;
  langOverride?: LangCode;
  demo: boolean;
}) {
  const router = useRouter();
  const [appLang, setAppLang] = useAppLang();
  const [lang, setLang] = useState<LangCode>(langOverride ?? appLang);
  const langRef = useRef<LangCode>(langOverride ?? appLang);
  langRef.current = lang;

  const [status, setStatus] = useState<Status>("boot");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [stage, setStage] = useState<Stage>("name");
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [muted, setMuted] = useState(false);
  const [offline, setOffline] = useState(false);      // mock engine engaged
  const [aiPowered, setAiPowered] = useState(false);  // GPT-4o live
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [browserSTT, setBrowserSTT] = useState(true);
  const [micMode, setMicMode] = useState<"ptt" | "continuous">("ptt");

  const sessionRef = useRef<string | null>(null);
  const mockRef = useRef<OfflineSession | null>(null); // mirror of interview state
  const offlineRef = useRef(false);
  const listenRef = useRef<ListenHandle | null>(null);
  const micModeRef = useRef<"ptt" | "continuous">("ptt");
  const mutedRef = useRef(muted);
  const stageRef = useRef<Stage>("name");
  const startedRef = useRef(false);
  const stopDemoRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sendingRef = useRef(false);
  mutedRef.current = muted;
  stageRef.current = stage;

  useEffect(() => { setBrowserSTT(supportsBrowserSTT()); }, []);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e6, behavior: "smooth" }));
  }, []);

  // ──────────────────────────────────────────────────────────── speaking
  const speakAI = useCallback(async (text: string, l: LangCode) => {
    if (mutedRef.current) { setStatus((s) => (s === "done" ? s : "idle")); return; }
    setStatus((s) => (s === "done" ? s : "speaking"));
    await speak(text, l);
    setStatus((s) => (s === "speaking" ? "idle" : s));
  }, []);

  // ──────────────────────────────────────── engage the offline mock engine
  const goOffline = useCallback((reason: string) => {
    if (offlineRef.current) return;
    offlineRef.current = true;
    setOffline(true);
    setAiPowered(false);
    tripSpeechBreaker(reason);
    console.warn(`[JeevikaSetu] Backend unavailable (${reason}). Mock conversation engine engaged.`);
  }, []);

  // ───────────────────────────────────────────────────────── one full turn
  /**
   * OPTIMISTIC: the user bubble is appended before any network call.
   * Then: backend → on failure the local state machine answers instead.
   */
  const sendTurn = useCallback(
    async (rawText: string): Promise<ConversationReply | null> => {
      const userText = rawText.trim();
      if (!userText || sendingRef.current) return null;
      sendingRef.current = true;

      // 1 ── optimistic UI (instant, zero latency)
      setTurns((p) => [...p, { role: "user", text: userText, lang: langRef.current, at: Date.now() }]);
      setInterim("");
      setTyped("");
      setErrorMsg("");
      setStatus("thinking");
      scrollBottom();

      const l = langRef.current;
      let data: ConversationReply | null = null;

      // 2 ── try the real backend (skipped once we are in mock mode)
      if (!offlineRef.current && sessionRef.current && !sessionRef.current.startsWith("local-")) {
        try {
          const res = await fetchWithTimeout("/api/conversation/message", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId: sessionRef.current, channel, lang: l, userText }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const j = (await res.json()) as ConversationReply & { error?: string };
          if (j.error || !j.reply) throw new Error(j.error ?? "empty reply");
          data = j;
          // keep the mock mirror in sync so a mid-interview failover is seamless
          if (mockRef.current) {
            mockRef.current = { ...mockRef.current, slots: j.slots ?? {}, stage: j.stage, done: j.done, lang: j.language };
          }
        } catch (e) {
          goOffline(String(e));
        }
      }

      // 3 ── MOCK FALLBACK ENGINE
      if (!data) {
        if (!mockRef.current) mockRef.current = createOfflineSession(l).session;
        const stepped = offlineStep(mockRef.current, userText, l);
        mockRef.current = stepped.session;
        data = stepped.reply;
        // small human-like delay so the "typing…" loader reads naturally
        await new Promise((r) => setTimeout(r, 420));
      }

      setStage(data.stage);
      setAiPowered(data.aiPowered);
      if (data.language !== langRef.current) { langRef.current = data.language; setLang(data.language); }
      setTurns((p) => [...p, { role: "assistant", text: data!.reply, lang: data!.language, at: Date.now() }]);
      scrollBottom();
      sendingRef.current = false;

      if (data.done) {
        setStatus("done");
        if (!mutedRef.current) await speak(data.reply, data.language);
        await finalizeProfileRef.current?.();
        setStatus("done");
      } else {
        await speakAI(data.reply, data.language);
      }
      return data;
    },
    [channel, goOffline, scrollBottom, speakAI],
  );

  const sendTurnRef = useRef<typeof sendTurn | null>(null);
  sendTurnRef.current = sendTurn;

  // ──────────────────────────────────────────────── profile finalisation
  const finalizeProfile = useCallback(async () => {
    const slots = mockRef.current?.slots ?? {};
    // A) server extraction (works with either the session id or raw slots)
    if (!offlineRef.current) {
      try {
        const res = await fetchWithTimeout("/api/profile/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            sessionRef.current && !sessionRef.current.startsWith("local-")
              ? { conversationId: sessionRef.current, lang: langRef.current, channel }
              : { slots, lang: langRef.current, channel },
          ),
        });
        if (res.ok) {
          const j = (await res.json()) as { id?: string };
          if (j.id) {
            setBeneficiaryId(j.id);
            window.localStorage.setItem("js_beneficiary", j.id);
            return j.id;
          }
        }
      } catch { /* fall through */ }
    }
    // B) 100% local profile — demo never dead-ends
    const localId = saveLocalProfile(slots, langRef.current, channel);
    setBeneficiaryId(localId);
    return localId;
  }, [channel]);

  const finalizeProfileRef = useRef<typeof finalizeProfile | null>(null);
  finalizeProfileRef.current = finalizeProfile;

  // ───────────────────────────────────────────── instant language switching
  const applyLang = useCallback(
    (next: LangCode, propagate = true) => {
      if (next === langRef.current) return;
      langRef.current = next;
      setLang(next);                    // ← all UI strings re-render instantly
      if (propagate) setAppLang(next);

      stopSpeaking();                   // kill old-language audio
      listenRef.current?.abort();       // recogniser is recreated with the new
      listenRef.current = null;         //   locale on the next press
      setInterim("");
      setErrorMsg("");
      setStatus((s) => (s === "listening" || s === "speaking" ? "idle" : s));
      if (mockRef.current) mockRef.current = { ...mockRef.current, lang: next };

      // re-ask the pending question in the new language
      setTurns((prev) => {
        const revIdx = [...prev].reverse().findIndex((x) => x.role === "assistant");
        if (revIdx === -1) return prev;
        const at = prev.length - 1 - revIdx;
        const st = stageRef.current;
        const q = st !== "done" ? QUESTIONS[st as Exclude<Stage, "done">]?.[next] : undefined;
        if (!q) return prev;
        const copy = [...prev];
        copy[at] = { ...copy[at], text: q, lang: next };
        void speakAI(q, next);
        return copy;
      });
    },
    [setAppLang, speakAI],
  );

  useEffect(() => {
    if (!langOverride) applyLang(appLang, false);
  }, [appLang, langOverride, applyLang]);

  // ──────────────────────────────────────────────────────────────── boot
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    (async () => {
      const l = langRef.current;
      // Local mirror is created up-front so the mock engine is ALWAYS ready.
      const seed = createOfflineSession(l);
      mockRef.current = seed.session;

      let reply: ConversationReply = seed.reply;

      // Forced mock mode (?mock=1 / NEXT_PUBLIC_FORCE_OFFLINE=1): skip the
      // network entirely — guaranteed-working offline demo.
      if (isForcedMock()) {
        goOffline("forced mock mode");
        sessionRef.current = seed.session.id;
        setStage(reply.stage);
        setTurns([{ role: "assistant", text: reply.reply, lang: reply.language, at: Date.now() }]);
        setStatus("idle");
        scrollBottom();
        await speakAI(reply.reply, reply.language);
        if (demo) void runDemo();
        return;
      }

      try {
        const cfg = await fetchWithTimeout("/api/config", { method: "GET" }, 4000)
          .then((r) => r.json() as Promise<{ ai: boolean }>)
          .catch(() => ({ ai: false }));
        setAiPowered(Boolean(cfg.ai));
        setBrowserNativeOnly(!cfg.ai);   // only use OpenAI TTS if a key is live

        const res = await fetchWithTimeout("/api/conversation/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel, lang: l }),
        }, 6000);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = (await res.json()) as ConversationReply & { error?: string };
        if (j.error || !j.reply) throw new Error(j.error ?? "no reply");
        sessionRef.current = j.id;
        reply = j;
      } catch (e) {
        goOffline(String(e));
        sessionRef.current = seed.session.id;
      }

      setStage(reply.stage);
      setTurns([{ role: "assistant", text: reply.reply, lang: reply.language, at: Date.now() }]);
      setStatus("idle");                // ← never stuck on "boot"
      scrollBottom();
      await speakAI(reply.reply, reply.language);
      if (demo) void runDemo();
    })();

    return () => {
      stopDemoRef.current = true;
      stopSpeaking();
      listenRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ───────────────────────────────────────────────────────── demo autoplay
  const runDemo = async () => {
    const queue = QUESTION_STAGES
      .map((s) => RAMESH_PERSONA.script[s])
      .filter((x): x is string => Boolean(x));
    for (const answer of queue) {
      if (stopDemoRef.current) return;
      await new Promise((r) => setTimeout(r, 1100));
      if (stopDemoRef.current) return;
      const res = await sendTurnRef.current?.(answer);
      if (!res || res.done) break;
    }
    if (stopDemoRef.current) return;
    await new Promise((r) => setTimeout(r, 1500));
    const id = beneficiaryId ?? window.localStorage.getItem("js_beneficiary");
    if (id) router.push(`/profile/${id}?demo=1`);
  };

  // ─────────────────────────────────────────── microphone (browser-native)
  const startListening = useCallback(async () => {
    if (status === "thinking" || status === "done") return;
    setErrorMsg("");
    setInterim("");
    stopSpeaking();
    warmUpSpeech();

    if (!supportsBrowserSTT()) {
      setErrorMsg(tx("stt_unsupported", langRef.current));
      setStatus("idle");
      return;
    }

    const handle = listen(langRef.current, {
      continuous: micModeRef.current === "continuous",
      // live partial transcript → shows on screen WHILE speaking
      onInterim: (txt) => setInterim(txt),
      onFinal: async (txt) => {
        listenRef.current = null;
        setInterim("");
        if (!txt.trim()) { setStatus("idle"); return; }
        const res = await sendTurnRef.current?.(txt);
        if (micModeRef.current === "continuous" && res && !res.done) {
          void startListeningRef.current?.();
        }
      },
      onEnd: () => {
        if (listenRef.current) {
          listenRef.current = null;
          setStatus((s) => (s === "listening" ? "idle" : s));
        }
      },
      onError: (err) => {
        listenRef.current = null;
        if (err === "not-allowed" || err === "service-not-allowed") setErrorMsg(tx("mic_denied", langRef.current));
        else if (err === "no-speech") setErrorMsg(tx("no_speech", langRef.current));
        else if (err !== "aborted") setErrorMsg(tx("stt_failed", langRef.current));
        setStatus((s) => (s === "listening" ? "idle" : s));
      },
    });

    if (!handle) {
      setErrorMsg(tx("stt_unsupported", langRef.current));
      setStatus("idle");
      return;
    }
    listenRef.current = handle;
    setStatus("listening");
  }, [status]);

  const startListeningRef = useRef<typeof startListening | null>(null);
  startListeningRef.current = startListening;

  const stopListening = useCallback(() => {
    const h = listenRef.current;
    if (!h) return;
    listenRef.current = null;
    h.stop();
    // onFinal fires shortly after; if nothing arrives, return to idle
    setStatus((s) => (s === "listening" ? "thinking" : s));
    window.setTimeout(() => {
      setStatus((s) => (s === "thinking" && !sendingRef.current ? "idle" : s));
    }, 1800);
  }, []);

  // push-to-talk via pointer events (mouse + touch + pen, one code path)
  const onPressStart = (e: React.PointerEvent) => {
    e.preventDefault();
    if (micMode !== "ptt") return;
    // capture the pointer so sliding a finger off the button doesn't cut the
    // recording short — release is the only thing that sends.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    if (status === "speaking") { stopSpeaking(); setStatus("idle"); }
    if (status === "idle" || status === "error") void startListening();
  };
  const onPressEnd = (e: React.PointerEvent) => {
    e.preventDefault();
    if (micMode !== "ptt") return;
    if (status === "listening") stopListening();
  };
  const onTap = () => {
    if (micMode !== "continuous") return;
    if (status === "listening") stopListening();
    else if (status === "speaking") { stopSpeaking(); setStatus("idle"); }
    else void startListening();
  };

  // ──────────────────────────────────────────────────────────────── view
  const lastAI = [...turns].reverse().find((x) => x.role === "assistant");
  const stageIdx = QUESTION_STAGES.indexOf(stage === "done" ? "confirm" : stage);
  const progress = Math.round(((stageIdx + (stage === "done" ? 1 : 0)) / QUESTION_STAGES.length) * 100);
  const recording = status === "listening";

  const statusMeta: Record<Status, { text: string; cls: string }> = {
    boot: { text: tx("connecting", lang), cls: "bg-slate-200 text-slate-600" },
    idle: { text: t("tap_speak", lang), cls: "bg-white/15 text-white" },
    listening: { text: t("listening", lang), cls: "bg-red-500 text-white" },
    thinking: { text: t("processing", lang), cls: "bg-saffron-500 text-white" },
    speaking: { text: t("speaking", lang), cls: "bg-emerald-500 text-white" },
    done: { text: tx("profile_ready", lang), cls: "bg-greenIndia-500 text-white" },
    error: { text: tx("retry", lang), cls: "bg-red-100 text-red-700" },
  };

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-3 py-4 md:px-4 md:py-6">
      {/* offline banner */}
      {offline && (
        <div className="flex items-center gap-2 rounded-lg border border-saffron-500/40 bg-saffron-50 px-3 py-2 text-[12px] font-semibold text-saffron-600">
          <span className="grid h-5 w-5 place-items-center rounded-full bg-saffron-500 text-[10px] text-white">⚡</span>
          {tx("offline_engine", lang)}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[250px_1fr]">
        {/* ───────────────────────────── sidebar: progress + language */}
        <aside className="gov-card order-2 h-fit p-4 lg:order-1 lg:sticky lg:top-24">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{tx("interview", lang)}</p>
            <span className="text-[11px] font-extrabold text-navy-900">{progress}%</span>
          </div>
          <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-gradient-to-r from-saffron-500 to-navy-900 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>

          <ol className="space-y-1.5 text-[12px]">
            {QUESTION_STAGES.map((s, i) => {
              const state = stage === "done" || i < stageIdx ? "done" : i === stageIdx ? "active" : "todo";
              return (
                <li key={s} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${state === "active" ? "bg-saffron-50 text-navy-900" : state === "done" ? "text-greenIndia-600" : "text-slate-400"}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${state === "done" ? "bg-greenIndia-500 text-white" : state === "active" ? "bg-saffron-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className={state === "active" ? "font-bold" : "font-semibold"}>{stageLabel(s, lang)}</span>
                </li>
              );
            })}
          </ol>

          {/* language — switching re-renders UI, STT locale and TTS voice */}
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>{t("select_lang", lang)}</span>
              <span className="rounded bg-navy-50 px-1.5 py-0.5 font-bold text-navy-800">{LANG_NAME[lang]}</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => applyLang(l.code)}
                  className={`rounded-md px-1.5 py-1.5 text-[11px] font-bold transition ${l.code === lang ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  title={`${l.english} · ${l.bcp}`}
                >
                  {l.native}
                </button>
              ))}
            </div>
            <p className="pt-1 text-[10px] text-slate-400">
              STT/TTS: <b className="font-mono">{LANGS.find((l) => l.code === lang)?.bcp}</b>
            </p>

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <span>{aiPowered ? tx("ai_live", lang) : tx("ai_offline", lang)}</span>
              <button onClick={() => { if (!muted) stopSpeaking(); setMuted((m) => !m); }} className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-600">
                {muted ? tx("voice_off", lang) : tx("voice_on", lang)}
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{tx("mic_mode", lang)}</span>
              <button
                onClick={() => setMicMode((m) => { const n = m === "ptt" ? "continuous" : "ptt"; micModeRef.current = n; return n; })}
                className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-600"
              >
                {micMode === "ptt" ? tx("ptt", lang) : tx("continuous", lang)}
              </button>
            </div>
          </div>
        </aside>

        {/* ───────────────────────────── conversation */}
        <section className="gov-card order-1 flex min-h-[62dvh] flex-col overflow-hidden lg:order-2">
          <div className="flex items-center gap-3 bg-gradient-to-r from-navy-900 to-navy-700 px-4 py-3 text-white md:px-5">
            <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/10">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3a4 4 0 014 4v5a4 4 0 01-8 0V7a4 4 0 014-4z" /><path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
              </svg>
              {status === "speaking" && (
                <span className="absolute inset-0 flex items-center justify-center gap-[2px]">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="speak-bar w-[3px] rounded bg-saffron-400" style={{ height: 12, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">JeevikaSetu <span className="font-medium text-white/60">जीविकासेतु</span></p>
              <p className="truncate text-[11px] text-white/60">{t("tagline", lang)}</p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-bold ${statusMeta[status].cls}`}>
              {statusMeta[status].text}
            </span>
          </div>

          {/* transcript */}
          <div ref={scrollRef} className="nice-scroll flex-1 space-y-3 overflow-y-auto bg-paper px-4 py-4 md:px-5">
            {turns.map((turn, i) => (
              <div key={i} className={`rise flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] px-4 py-2.5 text-[15px] leading-relaxed shadow-sm md:max-w-[72%] ${turn.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                  {turn.text}
                </div>
              </div>
            ))}

            {/* live partial transcript — visible the instant the user speaks */}
            {interim && (
              <div className="flex justify-end">
                <div className="bubble-user max-w-[88%] px-4 py-2.5 text-[15px] opacity-70">
                  {interim}<span className="animate-pulse">▌</span>
                </div>
              </div>
            )}

            {/* "JeevikaSetu is typing…" */}
            {status === "thinking" && (
              <div className="flex justify-start">
                <div className="bubble-ai flex items-center gap-2 px-4 py-3">
                  <span className="flex items-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-navy-900/50" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">{tx("typing", lang)}</span>
                </div>
              </div>
            )}

            {status === "done" && beneficiaryId && (
              <div className="rise flex justify-center pt-2">
                <div className="gov-card flex flex-col items-center gap-3 border-greenIndia-500/30 bg-greenIndia-50 px-6 py-5 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-greenIndia-500 text-2xl text-white">✓</span>
                  <p className="text-sm font-bold text-greenIndia-600">{tx("profile_ready", lang)}</p>
                  <button
                    onClick={() => router.push(`/profile/${beneficiaryId}${demo ? "?demo=1" : ""}`)}
                    className="rounded-xl bg-navy-900 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-navy-700"
                  >
                    {t("view_profile", lang)} →
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ───────────────── composer */}
          <div className="border-t border-slate-100 bg-white px-4 pb-4 pt-3 md:px-5">
            {errorMsg && <p className="pb-2 text-center text-xs font-semibold text-red-600">{errorMsg}</p>}

            <div className="flex items-center gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) void sendTurn(typed); }}
                placeholder={t("type_instead", lang)}
                disabled={status === "done"}
                className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-paper px-4 py-3 text-[15px] text-navy-900 outline-none transition focus:border-navy-900 focus:bg-white disabled:opacity-50"
              />
              <button
                onClick={() => typed.trim() && void sendTurn(typed)}
                disabled={!typed.trim()}
                className="shrink-0 rounded-xl border-2 border-navy-900 px-4 py-3 text-sm font-bold text-navy-900 transition hover:bg-navy-900 hover:text-white disabled:opacity-40"
              >
                {t("send", lang)}
              </button>
              {lastAI && (
                <button
                  onClick={() => void speakAI(lastAI.text, (lastAI.lang as LangCode | undefined) ?? lang)}
                  title={tx("replay", lang)}
                  className="grid h-[50px] w-[50px] shrink-0 place-items-center rounded-xl border-2 border-slate-200 text-navy-900 transition hover:bg-navy-50"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </button>
              )}
            </div>

            {/* ── BIG hold-to-speak button */}
            <button
              onPointerDown={onPressStart}
              onPointerUp={onPressEnd}
              onPointerCancel={onPressEnd}
              onClick={onTap}
              onContextMenu={(e) => e.preventDefault()}
              disabled={status === "boot" || status === "thinking" || status === "done"}
              className={`mt-3 flex h-[76px] w-full select-none items-center justify-center gap-3 rounded-2xl text-white shadow-xl transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                recording
                  ? "bg-red-600 ring-8 ring-red-500/25 mic-pulse"
                  : "bg-gradient-to-br from-saffron-500 to-saffron-600 hover:brightness-105"
              }`}
              style={{ WebkitUserSelect: "none", userSelect: "none", touchAction: "none" }}
            >
              <span className={`grid h-11 w-11 place-items-center rounded-full bg-white/20 ${recording ? "animate-pulse" : ""}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
                </svg>
              </span>
              <span className="text-lg font-extrabold tracking-tight md:text-xl">
                {recording
                  ? `${tx("listening_now", lang)} — ${tx("release_to_send", lang)}`
                  : micMode === "ptt" ? tx("hold_speak", lang) : tx("tap_speak_btn", lang)}
              </span>
            </button>

            <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
              {browserSTT
                ? `${LANG_NAME[lang]} • ${LANGS.find((l) => l.code === lang)?.bcp} • Web Speech API`
                : tx("stt_unsupported", lang)}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
