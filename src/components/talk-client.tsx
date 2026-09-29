// JeevikaSetu — Voice Conversation Screen (Module 1 + 2 front-end).
// Channels: web (mic) / ivr (arrives pre-selected) / whatsapp (separate UI).
// STT: OpenAI Whisper (when keyed) → browser SpeechRecognition fallback.
// TTS: OpenAI → speechSynthesis fallback. Demo mode plays Ramesh's script.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, ChatTurn, ConversationReply, LangCode, Stage } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/conversation";
import { RAMESH_PERSONA } from "@/data/personas";
import { STAGES } from "@/lib/conversation";
import { t, LANGS, LANG_NAME } from "@/data/i18n";
import {
  getMicStream, listen, record, speak, stopSpeaking, supportsBrowserSTT,
  type ListenHandle, type RecorderHandle,
} from "@/lib/speech-client";
import { useAppLang } from "@/components/page-shell";

type Status = "boot" | "idle" | "listening" | "processing" | "speaking" | "done" | "error";

const QUESTION_STAGES = STAGES.filter((s) => s !== "done") as Stage[];

export default function TalkClient({
  channel, langOverride, demo,
}: {
  channel: Channel;
  langOverride?: LangCode;
  demo: boolean;
}) {
  const router = useRouter();
  const [appLang] = useAppLang();
  const [lang, setLang] = useState<LangCode>(langOverride ?? appLang);

  // honour global language selector when the deep-link didn't pin a language
  useEffect(() => {
    if (!langOverride) setLang(appLang);
  }, [appLang, langOverride]);
  const [status, setStatus] = useState<Status>("boot");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [stage, setStage] = useState<Stage>("name");
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [sttMode, setSttMode] = useState<"whisper" | "webspeech">("webspeech");
  const [micMode, setMicMode] = useState<"ptt" | "continuous">("ptt");
  const micModeRef = useRef<"ptt" | "continuous">("ptt");
  const [aiPowered, setAiPowered] = useState(false);
  const [muted, setMuted] = useState(false);
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [browserSTT, setBrowserSTT] = useState(false);
  useEffect(() => setBrowserSTT(supportsBrowserSTT()), []);

  const sessionRef = useRef<string | null>(null);
  const listenRef = useRef<ListenHandle | null>(null);
  const recRef = useRef<RecorderHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stopDemoRef = useRef(false);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;

  // ---------------------------------------------------------------- audio viz
  const rafRef = useRef(0);
  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#c7c2b2";
    const bars = 32;
    for (let i = 0; i < bars; i++) {
      const h = 4 + Math.abs(Math.sin(i * 0.7)) * (height * 0.22);
      ctx.fillRect((i * width) / bars + 2, height / 2 - h / 2, width / bars - 4, h);
    }
  }, []);

  const drawLive = useCallback((analyser: AnalyserNode) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = new Uint8Array(analyser.frequencyBinCount);
    const render = () => {
      analyser.getByteFrequencyData(data);
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);
      const bars = 32;
      for (let i = 0; i < bars; i++) {
        const v = data[Math.floor((i * data.length) / bars)] / 255;
        const h = Math.max(4, v * height * 0.92);
        ctx.fillStyle = `rgba(255,153,51,${0.45 + v * 0.55})`;
        ctx.fillRect((i * width) / bars + 2, height / 2 - h / 2, width / bars - 4, h);
      }
      rafRef.current = requestAnimationFrame(render);
    };
    render();
  }, []);

  const stopViz = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    drawIdle();
  }, [drawIdle]);

  // ---------------------------------------------------------------- helpers
  const scrollBottom = () =>
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }));

  const speakAI = useCallback(
    async (text: string, l: LangCode) => {
      if (mutedRef.current) { setStatus("idle"); return; }
      setStatus("speaking");
      await speak(text, l);
      setStatus((s) => (s === "speaking" ? "idle" : s));
    },
    [],
  );

  const finalizeProfile = useCallback(async () => {
    if (!sessionRef.current) return;
    setStatus("processing");
    try {
      const res = await fetch("/api/profile/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: sessionRef.current, lang, channel }),
      });
      const data = (await res.json()) as { id?: string };
      if (data.id) {
        setBeneficiaryId(data.id);
        window.localStorage.setItem("js_beneficiary", data.id);
        return data.id;
      }
    } catch { /* surface via error state */ }
    setStatus("done");
    return null;
  }, [channel, lang]);

  // ------------------------------------------------------- one conversation turn
  const sendTurn = useCallback(
    async (userText: string): Promise<ConversationReply | null> => {
      if (!sessionRef.current || !userText.trim()) return null;
      setInterim("");
      setTyped("");
      setStatus("processing");
      setTurns((p) => [...p, { role: "user", text: userText, at: Date.now() }]);
      scrollBottom();
      try {
        const res = await fetch("/api/conversation/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionRef.current, channel, lang, userText }),
        });
        const data = (await res.json()) as ConversationReply & { error?: string };
        if (data.error) throw new Error(data.error);
        setStage(data.stage);
        if (data.language !== lang) setLang(data.language);
        setAiPowered(data.aiPowered);
        setTurns((p) => [...p, { role: "assistant", text: data.reply, lang: data.language, at: Date.now() }]);
        scrollBottom();
        if (data.done) {
          setStatus("done");
          if (!mutedRef.current) await speak(data.reply, data.language);
          await finalizeProfile();
          setStatus("done");
        } else {
          await speakAI(data.reply, data.language);
        }
        return data;
      } catch (e) {
        setErrorMsg(String(e));
        setStatus("error");
        return null;
      }
    },
    [channel, lang, speakAI, finalizeProfile],
  );

  // ---------------------------------------------------------------- boot
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const cfg = await fetch("/api/config").then((r) => r.json()) as { ai: boolean; stt: string };
        setSttMode(cfg.stt === "whisper" ? "whisper" : "webspeech");
        setAiPowered(cfg.ai);
        const res = await fetch("/api/conversation/message", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channel, lang }),
        });
        const data = (await res.json()) as ConversationReply & { error?: string, detail?: string };
        if (!res.ok || data.error) {
          throw new Error(data.detail ?? data.error ?? "Failed to start conversation");
        }
        sessionRef.current = data.id;
        setStage(data.stage);
        setStatus("idle");
        setTurns([{ role: "assistant", text: data.reply, lang: data.language, at: Date.now() }]);
        scrollBottom();
        await speakAI(data.reply, data.language);
        if (demo) void runDemo();
      } catch (e) {
        setErrorMsg(String(e));
        setStatus("error");
      }
    })();
    return () => {
      stopDemoRef.current = true;
      stopSpeaking();
      listenRef.current?.abort();
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { drawIdle(); }, [drawIdle, status]);

  // --------------------------------------------------------------- demo mode
  const runDemo = async () => {
    const queue = QUESTION_STAGES
      .map((s) => RAMESH_PERSONA.script[s])
      .filter((x): x is string => Boolean(x));
    for (const answer of queue) {
      if (stopDemoRef.current) return;
      await new Promise((r) => setTimeout(r, 1100));
      if (stopDemoRef.current) return;
      const res = await sendTurn(answer);
      if (!res || res.done) break;
    }
    if (stopDemoRef.current) return;
    await new Promise((r) => setTimeout(r, 1400));
    const id = beneficiaryId ?? window.localStorage.getItem("js_beneficiary");
    if (id) router.push(`/profile/${id}?demo=1`);
  };

  // ------------------------------------------------------------- mic control
  const startListening = async () => {
    setErrorMsg("");
    // Always record a real WebM/Opus clip first. Browser SpeechRecognition is
    // not reliable on Firefox/Safari and, previously, silently bypassed the
    // MediaRecorder/Whisper path. This makes the microphone behaviour the same
    // in every supported browser.
    const stream = await getMicStream();
    if (!stream) {
      setErrorMsg("Microphone permission was denied. Allow microphone access and try again.");
      setStatus("error");
      return;
    }
    streamRef.current = stream;
    try {
      recRef.current = record(stream);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setErrorMsg("This browser cannot record audio. Please type your answer instead.");
      setStatus("error");
      return;
    }
    setStatus("listening");
    void attachStreamViz();
  };

  const attachStreamViz = async () => {
    try {
      const stream = streamRef.current ?? (await getMicStream());
      if (!stream) { drawIdle(); return; }
      streamRef.current = stream;
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const actx = new AC();
      const src = actx.createMediaStreamSource(stream);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 128;
      src.connect(analyser);
      drawLive(analyser);
    } catch { drawIdle(); }
  };

  const stopListening = async () => {
    if (listenRef.current) { listenRef.current.stop(); listenRef.current = null; }
    if (recRef.current) {
      setStatus("processing");
      const blob = await recRef.current.stop();
      recRef.current = null;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      stopViz();
      if (!blob) { setStatus("idle"); return; }
      try {
        const fd = new FormData();
        fd.append("audio", blob, "speech.webm");
        fd.append("language", lang);
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
        if (!res.ok) throw new Error("STT failed");
        const data = (await res.json()) as { text?: string };
        if (data.text) {
          setInterim(data.text); // subtitle: show exactly what Whisper heard
          await sendTurn(data.text);
          if (micModeRef.current === "continuous" && status !== "done") {
            // Continuous mode listens again after the assistant finishes speaking.
            await startListening();
          }
        } else setStatus("idle");
      } catch {
        // A configured Whisper endpoint is the primary path. Keep the demo
        // usable without an API key by falling back to the browser recognizer.
        if (browserSTT) {
          const handle = listen(lang, {
            onInterim: (tx) => setInterim(tx),
            onFinal: async (tx) => {
              setInterim("");
              await sendTurn(tx);
              if (micModeRef.current === "continuous") await startListening();
            },
            onEnd: () => setStatus("idle"),
            onError: () => { setErrorMsg("Could not transcribe — please type your answer"); setStatus("idle"); },
          });
          if (handle) { listenRef.current = handle; setStatus("listening"); return; }
        }
        setErrorMsg("Could not transcribe — please try again or type");
        setStatus("idle");
      }
    }
  };

  const micTap = async () => {
    if (status === "listening") await stopListening();
    else if (status === "speaking") { stopSpeaking(); setStatus("idle"); }
    else if (status === "idle") await startListening();
  };

  const lastAI = [...turns].reverse().find((x) => x.role === "assistant");
  const stageIdx = QUESTION_STAGES.indexOf(stage === "done" ? "done" : stage);

  const statusMeta: Record<Status, { text: string; cls: string }> = {
    boot: { text: "…", cls: "bg-slate-200 text-slate-600" },
    idle: { text: `${t("tap_speak", lang)}`, cls: "bg-navy-50 text-navy-800" },
    listening: { text: t("listening", lang), cls: "bg-greenIndia-100 text-greenIndia-600" },
    processing: { text: t("processing", lang), cls: "bg-saffron-100 text-saffron-600" },
    speaking: { text: t("speaking", lang), cls: "bg-blue-100 text-blue-800" },
    done: { text: "✓", cls: "bg-greenIndia-100 text-greenIndia-600" },
    error: { text: "Retry", cls: "bg-red-100 text-red-700" },
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-140px)] w-full max-w-6xl flex-col gap-4 px-4 py-5">
      {demo && (
        <div className="rise flex items-center gap-2 rounded-xl border border-saffron-500/40 bg-saffron-50 px-4 py-2.5 text-sm font-semibold text-saffron-600">
          <span className="relative flex h-2.5 w-2.5"><span className="absolute h-full w-full animate-ping rounded-full bg-saffron-500 opacity-60" /><span className="h-2.5 w-2.5 rounded-full bg-saffron-500" /></span>
          {t("demo_banner", lang)}
        </div>
      )}

      <div className="grid flex-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* --------------------------------------------- progress rail */}
        <aside className="gov-card order-2 flex flex-col p-5 lg:order-1">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-navy-900">Interview</h2>
            <span className="rounded-full bg-navy-900 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              {channel === "ivr" ? "IVR Call" : channel === "whatsapp" ? "WhatsApp" : "Voice"}
            </span>
          </div>
          <ol className="nice-scroll flex-1 space-y-1 overflow-y-auto pr-1">
            {QUESTION_STAGES.map((s, i) => {
              const state = stage === "done" || i < stageIdx ? "done" : i === stageIdx ? "active" : "todo";
              return (
                <li key={s} className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition ${state === "active" ? "bg-saffron-50 text-saffron-600" : state === "done" ? "text-slate-500" : "text-slate-400"}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${state === "done" ? "bg-greenIndia-500 text-white" : state === "active" ? "bg-saffron-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                    {state === "done" ? "✓" : i + 1}
                  </span>
                  <span className={`font-semibold ${state === "active" ? "font-bold" : ""}`}>
                    {lang === "hi" ? STAGE_LABELS[s].hi : STAGE_LABELS[s].en}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500">
              <span>{t("select_lang", lang)}</span>
              <span className="rounded bg-navy-50 px-1.5 py-0.5 text-navy-800">{LANG_NAME[lang]}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => setLang(l.code)}
                  className={`rounded-md px-2 py-1 text-[11px] font-bold transition ${l.code === lang ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                >
                  {l.code.toUpperCase()}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <span>{aiPowered ? "AI: GPT-4o live" : "AI: on-device engine"}</span>
              <button onClick={() => setMuted((m) => !m)} className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-600">
                {muted ? "Voice: off" : "Voice: on"}
              </button>
            </div>
            <div className="flex items-center justify-between pt-2 text-[11px] text-slate-400">
              <span>Mic Mode:</span>
              <button onClick={() => setMicMode((m) => { const next = m === "ptt" ? "continuous" : "ptt"; micModeRef.current = next; return next; })} className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-600">
                {micMode === "ptt" ? "Push to Talk" : "Continuous"}
              </button>
            </div>
          </div>
        </aside>

        {/* --------------------------------------------- conversation */}
        <section className="gov-card order-1 flex min-h-[60dvh] flex-col overflow-hidden lg:order-2">
          {/* status strip */}
          <div className="flex items-center gap-3 border-b border-slate-100 bg-gradient-to-r from-navy-900 to-navy-700 px-5 py-3 text-white">
            <div className={`relative grid h-9 w-9 place-items-center rounded-full bg-white/10 ${status === "speaking" ? "text-white" : ""}`}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 3a9 9 0 100 18 9 9 0 000-18z" opacity=".3" /><path d="M8 12h.01M12 12h.01M16 12h.01" strokeLinecap="round" strokeWidth="2.8" />
              </svg>
              {status === "speaking" && (
                <div className="absolute inset-0 flex items-center justify-center gap-[2px]">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="speak-bar w-[3px] rounded bg-saffron-400" style={{ height: 12, animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">JeevikaSetu <span className="font-medium text-white/60">• ਜी PM-AJAY साथी</span></p>
              <p className="text-[11px] text-white/60">{t("tagline", lang)}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${statusMeta[status].cls}`}>{status === "done" ? "Profile ready ✓" : statusMeta[status].text}</span>
          </div>

          {/* transcript */}
          <div ref={scrollRef} className="nice-scroll flex-1 space-y-3 overflow-y-auto bg-paper px-5 py-4">
            {turns.map((turn, i) => (
              <div key={i} className={`rise flex ${turn.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-4 py-2.5 text-sm leading-relaxed shadow-sm md:max-w-[70%] ${turn.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                  {turn.text}
                </div>
              </div>
            ))}
            {interim && (
              <div className="flex justify-end">
                <div className="bubble-user max-w-[85%] px-4 py-2.5 text-sm italic opacity-70">{interim}…</div>
              </div>
            )}
            {status === "processing" && (
              <div className="flex justify-start">
                <div className="bubble-ai flex items-center gap-1.5 px-4 py-3">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            )}
            {status === "done" && beneficiaryId && (
              <div className="rise flex justify-center pt-2">
                <div className="gov-card flex flex-col items-center gap-3 border-greenIndia-500/30 bg-greenIndia-50 px-6 py-5 text-center">
                  <span className="grid h-12 w-12 place-items-center rounded-full bg-greenIndia-500 text-2xl text-white">✓</span>
                  <p className="text-sm font-bold text-greenIndia-600">
                    {lang === "hi" ? "आपकी प्रोफ़ाइल तैयार है!" : "Your profile is ready!"}
                  </p>
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

          {/* waveform */}
          <div className="border-t border-slate-100 bg-white px-5 pb-4 pt-3">
            <canvas ref={canvasRef} width={560} height={44} className="h-[44px] w-full" />
            {errorMsg && <p className="pb-2 text-center text-xs font-semibold text-red-600">{errorMsg}</p>}
            <div className="flex items-center gap-3">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) void sendTurn(typed); }}
                placeholder={t("type_instead", lang)}
                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-paper px-4 py-3 text-sm outline-none transition focus:border-navy-500 focus:bg-white"
              />
              <button
                onClick={() => typed.trim() && void sendTurn(typed)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-navy-900 transition hover:bg-navy-50"
              >
                {t("send", lang)}
              </button>
              {lastAI && status === "idle" && (
                <button
                  onClick={() => void speakAI(lastAI.text, (lastAI.lang as LangCode | undefined) ?? lang)}
                  title="Replay" className="grid h-[46px] w-[46px] place-items-center rounded-xl border border-slate-200 text-navy-900 transition hover:bg-navy-50"
                >
                  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
                </button>
              )}
              <button
                onMouseDown={micMode === "ptt" ? async (e) => { e.preventDefault(); if (status === "idle") await startListening(); else if (status === "speaking") { stopSpeaking(); setStatus("idle"); } } : undefined}
                onMouseUp={micMode === "ptt" ? async (e) => { e.preventDefault(); if (status === "listening") await stopListening(); } : undefined}
                onTouchStart={micMode === "ptt" ? async (e) => { e.preventDefault(); if (status === "idle") await startListening(); else if (status === "speaking") { stopSpeaking(); setStatus("idle"); } } : undefined}
                onTouchEnd={micMode === "ptt" ? async (e) => { e.preventDefault(); if (status === "listening") await stopListening(); } : undefined}
                onClick={micMode === "continuous" ? async () => { void micTap(); } : undefined}
                disabled={status === "boot" || status === "processing" || status === "done"}
                className={`relative flex h-16 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-white shadow-xl transition-all active:scale-95 disabled:opacity-50 ${
                  status === "listening" ? "bg-greenIndia-500 ping-ring" : "bg-gradient-to-br from-saffron-500 to-saffron-600"
                }`}
                title={t("tap_speak", lang)}
                style={{ WebkitUserSelect: "none", userSelect: "none" }}
              >
                {status === "listening" ? (
                  <><span className="text-xl">🎤</span> <span className="font-bold">Listening...</span></>
                ) : (
                  <><span className="text-xl">🎤</span> <span className="font-bold">{micMode === "ptt" ? "Hold to Speak" : "Tap to Speak"}</span></>
                )}
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] font-medium text-slate-400">
              {sttMode === "webspeech"
                ? browserSTT ? "Live browser speech recognition active — use the button above to speak naturally" : "Mic STT not supported in this browser — type instead"
                : "Whisper AI transcription mode active"}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
