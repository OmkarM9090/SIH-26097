// ─────────────────────────────────────────────────────────────────────────────
// JeevikaSetu — VOICE AGENT  (browser-native, quota-proof)
//
//  STT      : window.SpeechRecognition / window.webkitSpeechRecognition  (free)
//  TTS      : window.speechSynthesis                                     (free)
//  AI logic : /api/conversation/message  →  on ANY failure (429 / 5xx / offline)
//             the client-side conversation engine takes over and the interview
//             continues seamlessly. State is sent with every turn, so the app
//             keeps working even if the deployed database is ephemeral.
//  UI       : one-tap start, then HANDS-FREE by default — the agent speaks, the
//             mic opens by itself, the answer is detected on silence and sent.
//             Tapping the mic while the agent talks interrupts it (barge-in).
//             There is also a typed fallback, quick-reply chips for people who
//             do not know what to say, and zero dead states: every failure is
//             recoverable with one visible Retry button.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel, ChatTurn, ConversationReply, LangCode, SlotState, Stage } from "@/lib/types";
import { QUESTIONS, t, tx, stageLabel, LANGS, LANG_NAME } from "@/data/i18n";
import { RAMESH_PERSONA } from "@/data/personas";
import { STAGES } from "@/lib/conversation";
import {
  createOfflineSession, offlineStep, saveLocalProfile, pendingQuestion, type OfflineSession,
} from "@/lib/offline-agent";
import {
  listen, speak, stopSpeaking, supportsBrowserSTT, warmUpSpeech, primeMicrophone,
  setBrowserNativeOnly, tripSpeechBreaker, type ListenHandle,
} from "@/lib/speech-client";
import { useAppLang } from "@/components/page-shell";
import { isForcedMock } from "@/lib/demo-mode";

type Status = "intro" | "idle" | "listening" | "thinking" | "speaking" | "done" | "error";
type MicMode = "auto" | "manual";

const QUESTION_STAGES = STAGES.filter((s) => s !== "done") as Stage[];
const FETCH_TIMEOUT = 9000;
/** how long a silence means "the beneficiary finished their answer" */
const SILENCE_MS = 1200;
/** long silence with nothing heard at all → gentle nudge */
const HEARD_NOTHING_MS = 17000;

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

/** Spoken utterances for the quick-reply chips (intent words, not labels). */
const CHIP_TEXT: Record<"repeat" | "unclear" | "yes" | "no", Record<LangCode, string>> = {
  repeat: { hi: "फिर से बोलिए", en: "please say that again", ta: "மீண்டும் சொல்லுங்கள்", te: "మళ్లీ చెప్పండి", mr: "पुन्हा सांगा", bn: "আবার বলুন" },
  unclear: { hi: "समझ नहीं आया", en: "I did not understand", ta: "எனக்கு புரியவில்லை", te: "నాకు అర్థం కాలేదు", mr: "मला समजले नाही", bn: "আমি বুঝতে পারিনি" },
  yes: { hi: "हाँ", en: "yes", ta: "ஆம்", te: "అవును", mr: "हो", bn: "হ্যাঁ" },
  no: { hi: "नहीं", en: "no", ta: "இல்லை", te: "లేదు", mr: "नाही", bn: "না" },
};

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

  const [status, setStatus] = useState<Status>("intro");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [stage, setStage] = useState<Stage>("name");
  const [interim, setInterim] = useState("");
  const [typed, setTyped] = useState("");
  const [muted, setMuted] = useState(false);           // voice output off
  const [micMuted, setMicMuted] = useState(false);      // hands-free listening paused
  const [offline, setOffline] = useState(false);        // fallback engine engaged
  const [aiPowered, setAiPowered] = useState(false);    // GPT-4o live
  const [beneficiaryId, setBeneficiaryId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [browserSTT, setBrowserSTT] = useState(true);
  const [micDenied, setMicDenied] = useState(false);
  const [micMode, setMicMode] = useState<MicMode>("auto");
  const [started, setStarted] = useState(false);
  const [slots, setSlots] = useState<SlotState>({});

  // ── refs (avoid stale closures inside async speech callbacks)
  const statusRef = useRef<Status>("intro");
  /**
   * Status must be readable SYNCHRONOUSLY inside speech callbacks — React state
   * only updates on the next render, which used to make "interrupt while the
   * agent is talking" silently do nothing. The ref is the source of truth.
   */
  const applyStatus = useCallback((next: Status) => {
    statusRef.current = next;
    setStatus(next);
  }, []);
  const stageRef = useRef<Stage>("name");
  const slotsRef = useRef<SlotState>({});
  const modeRef = useRef<MicMode>("auto");
  const mutedRef = useRef(false);
  const micMutedRef = useRef(false);
  const liveRef = useRef(false);            // interview running
  const demoRef = useRef(demo);
  const sessionRef = useRef<string | null>(null);
  const mockRef = useRef<OfflineSession | null>(null);
  const offlineRef = useRef(false);
  const busyRef = useRef(false);            // a turn is in flight
  const micRef = useRef<{ handle: ListenHandle | null; gen: number; retries: number }>({ handle: null, gen: 0, retries: 0 });
  const loopGenRef = useRef(0);
  const silenceTimer = useRef<number | null>(null);
  const heardNothingTimer = useRef<number | null>(null);
  const reopenTimer = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const stopDemoRef = useRef(false);

  statusRef.current = status;
  stageRef.current = stage;
  slotsRef.current = slots;
  modeRef.current = micMode;
  mutedRef.current = muted;
  micMutedRef.current = micMuted;

  useEffect(() => {
    setBrowserSTT(supportsBrowserSTT());
    try {
      const saved = window.localStorage.getItem("js_mic_mode") as MicMode | null;
      if (saved === "auto" || saved === "manual") { setMicMode(saved); modeRef.current = saved; }
    } catch { /* private mode */ }
  }, []);

  const setMode = useCallback((next: MicMode) => {
    setMicMode(next);
    modeRef.current = next;
    try { window.localStorage.setItem("js_mic_mode", next); } catch { /* noop */ }
    if (next === "manual") closeMic();
    else if (statusRef.current === "idle" && liveRef.current && !micMutedRef.current) openMicRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scrollBottom = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 9e6, behavior: "smooth" }));
  }, []);

  const pushTurn = useCallback((turn: ChatTurn) => {
    setTurns((p) => [...p, turn]);
    scrollBottom();
  }, [scrollBottom]);

  // ──────────────────────────────────────────────────────────── mic control
  const clearTimers = useCallback(() => {
    if (silenceTimer.current) { window.clearTimeout(silenceTimer.current); silenceTimer.current = null; }
    if (heardNothingTimer.current) { window.clearTimeout(heardNothingTimer.current); heardNothingTimer.current = null; }
    if (reopenTimer.current) { window.clearTimeout(reopenTimer.current); reopenTimer.current = null; }
  }, []);

  const closeMic = useCallback(() => {
    clearTimers();
    micRef.current.gen += 1;              // invalidate pending callbacks
    micRef.current.handle?.abort();
    micRef.current.handle = null;
    setInterim("");
  }, [clearTimers]);

  const submitRef = useRef<((text: string) => Promise<ConversationReply | null>) | null>(null);
  const openMicRef = useRef<(() => void) | null>(null);

  /**
   * Open the microphone for ONE answer. Works with every engine quirk:
   *  • Chrome finalises each phrase of a long answer → we wait for a silence gap
   *    and merge the phrases before sending;
   *  • Safari/Chrome end the session on their own → we reopen the line;
   *  • nothing heard at all → we nudge and keep the line open (like a real IVR).
   */
  const openMic = useCallback(() => {
    if (!liveRef.current || demoRef.current) return;
    if (micMutedRef.current) return;
    if (statusRef.current === "thinking" || statusRef.current === "speaking") return;

    const gen = ++micRef.current.gen;
    micRef.current.handle?.abort();
    micRef.current.handle = null;
    let pending = "";        // phrases the engine already finalised
    let interimPart = "";    // the phrase the beneficiary is still saying
    const compose = () => `${pending} ${interimPart}`.replace(/\s+/g, " ").trim().slice(-320);
    setInterim("");
    applyStatus("listening");
    setErrorMsg("");

    const armSilence = () => {
      if (silenceTimer.current) window.clearTimeout(silenceTimer.current);
      silenceTimer.current = window.setTimeout(() => {
        if (gen !== micRef.current.gen) return;
        const text = compose();
        if (!text) return;
        pending = "";
        interimPart = "";
        micRef.current.gen += 1;
        micRef.current.handle?.abort();
        micRef.current.handle = null;
        setInterim("");
        void submitRef.current?.(text);
      }, SILENCE_MS);
    };

    if (heardNothingTimer.current) window.clearTimeout(heardNothingTimer.current);
    heardNothingTimer.current = window.setTimeout(() => {
      if (gen !== micRef.current.gen || statusRef.current !== "listening") return;
      setErrorMsg(tx("no_speech", langRef.current));
    }, HEARD_NOTHING_MS);

    const handle = listen(langRef.current, {
      continuous: true,
      onStart: () => {
        if (gen !== micRef.current.gen) return;
        micRef.current.retries = 0;
      },
      onInterim: (txt) => {
        if (gen !== micRef.current.gen) return;
        interimPart = txt;
        setInterim(compose());
        setErrorMsg("");
        if (heardNothingTimer.current) { window.clearTimeout(heardNothingTimer.current); heardNothingTimer.current = null; }
        armSilence();
      },
      onFinal: (txt) => {
        if (gen !== micRef.current.gen) return;
        micRef.current.retries = 0;
        pending = `${pending} ${txt}`.replace(/\s+/g, " ").trim();
        interimPart = "";
        setInterim(pending);
        if (heardNothingTimer.current) { window.clearTimeout(heardNothingTimer.current); heardNothingTimer.current = null; }
        armSilence();          // send only after the beneficiary actually stops
      },
      onEnd: () => {
        if (gen !== micRef.current.gen) return;
        micRef.current.handle = null;
        if (statusRef.current !== "listening") return;
        if (!compose() && liveRef.current && !micMutedRef.current && micRef.current.retries < 60) {
          micRef.current.retries += 1;
          reopenTimer.current = window.setTimeout(() => {
            if (gen === micRef.current.gen && statusRef.current === "listening") openMicRef.current?.();
          }, 420);
        }
      },
      onError: (err) => {
        if (gen !== micRef.current.gen) return;
        if (err === "not-allowed" || err === "service-not-allowed") {
          setMicDenied(true);
          setMicMuted(true);
          micMutedRef.current = true;
          setErrorMsg(tx("mic_denied", langRef.current));
          applyStatus("idle");
          return;
        }
        if (err === "aborted") return;
        if (err === "no-speech") { setErrorMsg(tx("no_speech", langRef.current)); return; }
        setErrorMsg(tx("stt_failed", langRef.current));
      },
    });

    if (!handle) {
      setErrorMsg(tx("stt_unsupported", langRef.current));
      applyStatus("idle");
      return;
    }
    micRef.current.handle = handle;
  }, []);

  openMicRef.current = openMic;

  const stopListening = useCallback(() => {
    clearTimers();
    micRef.current.gen += 1;
    micRef.current.handle?.abort();
    micRef.current.handle = null;
    setInterim("");
    if (statusRef.current === "listening") applyStatus("idle");
  }, [clearTimers]);

  // ──────────────────────────────────────────────────────── speaking + loop
  const finalizeProfileRef = useRef<(() => Promise<string | null>) | null>(null);

  /** Speak one agent line, then (hands-free) reopen the mic. */
  const say = useCallback(async (text: string, l: LangCode, opts: { listenAfter?: boolean } = {}) => {
    const gen = ++loopGenRef.current;
    closeMic();
    if (!mutedRef.current && text.trim()) {
      applyStatus("speaking");
      await speak(text, l);
      if (gen !== loopGenRef.current) return;
    }
    if (!liveRef.current) { applyStatus("done"); return; }
    applyStatus("idle");
    if (opts.listenAfter !== false && modeRef.current === "auto" && !micMutedRef.current) {
      // small human beat before the line opens, so the TTS tail is not captured
      window.setTimeout(() => {
        if (gen === loopGenRef.current && liveRef.current && statusRef.current === "idle") openMicRef.current?.();
      }, 350);
    }
  }, [closeMic]);

  const sayRef = useRef(say);
  sayRef.current = say;

  // ──────────────────────────────────────── engage the offline fallback engine
  const goOffline = useCallback((reason: string) => {
    if (offlineRef.current) return;
    offlineRef.current = true;
    setOffline(true);
    setAiPowered(false);
    tripSpeechBreaker(reason);
    console.warn(`[JeevikaSetu] Backend unavailable (${reason}). On-device engine engaged.`);
  }, []);

  // ───────────────────────────────────────────────────────── one full turn
  /**
   * Send one answer and speak the reply. The user bubble is rendered instantly;
   * the reply comes from the backend, or from the on-device engine if the
   * backend/LLM/database is unavailable. `busyRef` is ALWAYS released.
   */
  const sendTurn = useCallback(
    async (rawText: string): Promise<ConversationReply | null> => {
      const userText = rawText.trim();
      if (!userText || busyRef.current || !liveRef.current) return null;
      busyRef.current = true;
      closeMic();

      const l = langRef.current;
      pushTurn({ role: "user", text: userText, lang: l, at: Date.now() });
      setTyped("");
      setInterim("");
      setErrorMsg("");
      applyStatus("thinking");

      let data: ConversationReply | null = null;
      try {
        // 1 ── real backend first (unless we have already fallen back)
        if (!offlineRef.current && !isForcedMock()) {
          try {
            const res = await fetchWithTimeout("/api/conversation/message", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              // slots + stage travel with every turn: the interview survives
              // restarts, cold serverless instances and a wiped session store.
              body: JSON.stringify({
                sessionId: sessionRef.current?.startsWith("local-") ? undefined : sessionRef.current,
                channel,
                lang: l,
                userText,
                slots: mockRef.current?.slots ?? {},
                stage: mockRef.current?.stage ?? "name",
              }),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const j = (await res.json()) as ConversationReply & { error?: string };
            if (j.error || !j.reply) throw new Error(j.error ?? "empty reply");
            data = j;
            sessionRef.current = j.id ?? sessionRef.current;
          } catch (e) {
            goOffline(String(e));
          }
        }

        // 2 ── on-device engine
        if (!data) {
          if (!mockRef.current) mockRef.current = createOfflineSession(l).session;
          const stepped = offlineStep(mockRef.current, userText, l);
          mockRef.current = stepped.session;
          data = stepped.reply;
          await new Promise((r) => setTimeout(r, 320));   // natural "thinking" beat
        } else {
          mockRef.current = {
            ...(mockRef.current ?? createOfflineSession(l).session),
            slots: data.slots ?? {},
            stage: data.stage,
            done: data.done,
            lang: data.language,
          };
        }

        setStage(data.stage);
        setSlots(data.slots ?? {});
        setAiPowered(Boolean(data.aiPowered));
        if (data.language && data.language !== langRef.current) {
          langRef.current = data.language;
          setLang(data.language);
        }
        pushTurn({ role: "assistant", text: data.reply, lang: data.language, at: Date.now() });

        if (data.done) {
          liveRef.current = false;
          applyStatus("done");
          if (!mutedRef.current) { applyStatus("speaking"); await speak(data.reply, data.language); }
          const id = await finalizeProfileRef.current?.();
          if (id) applyStatus("done");
          return data;
        }

        await sayRef.current?.(data.reply, data.language);
        return data;
      } catch (e) {
        // the UI must never get stuck — surface a retry instead
        setErrorMsg(`${tx("stt_failed", langRef.current)} (${String(e).slice(0, 60)})`);
        applyStatus("idle");
        return null;
      } finally {
        busyRef.current = false;
      }
    },
    [channel, closeMic, goOffline, pushTurn],
  );
  submitRef.current = sendTurn;

  // ──────────────────────────────────────────────── profile finalisation
  const finalizeProfile = useCallback(async (): Promise<string | null> => {
    const s = mockRef.current?.slots ?? {};
    if (!offlineRef.current) {
      try {
        const res = await fetchWithTimeout("/api/profile/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            sessionRef.current && !sessionRef.current.startsWith("local-")
              ? { conversationId: sessionRef.current, lang: langRef.current, channel }
              : { slots: s, lang: langRef.current, channel },
          ),
        });
        if (res.ok) {
          const j = (await res.json()) as { id?: string };
          if (j.id) {
            setBeneficiaryId(j.id);
            try { window.localStorage.setItem("js_beneficiary", j.id); } catch { /* noop */ }
            return j.id;
          }
        }
      } catch { /* local fallback below */ }
    }
    const localId = saveLocalProfile(s, langRef.current, channel);
    setBeneficiaryId(localId);
    return localId;
  }, [channel]);
  finalizeProfileRef.current = finalizeProfile;

  // ───────────────────────────────────────────── instant language switching
  const applyLang = useCallback(
    (next: LangCode, propagate = true) => {
      if (next === langRef.current) return;
      langRef.current = next;
      setLang(next);
      if (propagate) setAppLang(next);

      loopGenRef.current += 1;
      stopSpeaking();
      closeMic();
      setInterim("");
      setErrorMsg("");
      if (mockRef.current) mockRef.current = { ...mockRef.current, lang: next };

      if (!liveRef.current) return;
      // re-ask the pending question in the new language
      const q = pendingQuestion(slotsRef.current, stageRef.current === "done" ? "confirm" : stageRef.current, next);
      setTurns((prev) => {
        const idx = [...prev].reverse().findIndex((x) => x.role === "assistant");
        if (idx === -1) return prev;
        const at = prev.length - 1 - idx;
        const copy = [...prev];
        copy[at] = { ...copy[at], text: q, lang: next };
        return copy;
      });
      void sayRef.current?.(q, next);
    },
    [closeMic, setAppLang],
  );

  useEffect(() => {
    if (!langOverride) applyLang(appLang, false);
  }, [appLang, langOverride, applyLang]);

  // ──────────────────────────────────────────────────────────── boot / start
  const bootBackend = useCallback(async (l: LangCode) => {
    if (isForcedMock()) { goOffline("forced mock mode"); return; }
    try {
      const cfg = await fetchWithTimeout("/api/config", { method: "GET" }, 4000)
        .then((r) => r.json() as Promise<{ ai: boolean }>)
        .catch(() => ({ ai: false }));
      setBrowserNativeOnly(!cfg.ai);
      const res = await fetchWithTimeout("/api/conversation/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel, lang: l }),
      }, 6000);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as ConversationReply & { error?: string };
      if (j.error || !j.reply) throw new Error(j.error ?? "no reply");
      if (!offlineRef.current) sessionRef.current = j.id;
      setAiPowered(Boolean(j.aiPowered) && !offlineRef.current);
    } catch (e) {
      goOffline(String(e));
      sessionRef.current = mockRef.current?.id ?? null;
    }
  }, [channel, goOffline]);

  /**
   * One tap starts everything. The greeting is spoken SYNCHRONOUSLY from the
   * local engine (iOS/Safari only allow audio inside the gesture, and it is
   * instant for the user); the server session is fetched in the background.
   */
  const start = useCallback(async () => {
    if (liveRef.current) return;
    warmUpSpeech();
    const l = langRef.current;
    const seed = createOfflineSession(l);
    mockRef.current = seed.session;
    liveRef.current = true;
    stopDemoRef.current = false;
    setStarted(true);
    applyStatus("speaking");
    setErrorMsg("");
    pushTurn({ role: "assistant", text: seed.reply.reply, lang: l, at: Date.now() });

    // ask for the mic straight away (permission prompt inside the tap gesture)
    const perm = primeMicrophone().then((ok) => {
      if (!ok) {
        setMicDenied(true);
        setMicMuted(true);
        micMutedRef.current = true;
        setErrorMsg(tx("mic_denied", l));
      }
    });

    void bootBackend(l);
    await sayRef.current?.(seed.reply.reply, l, { listenAfter: !demo });
    await perm;
    if (demo) void runDemoRef.current?.();
    // (hands-free mode already reopened the line inside say())
  }, [bootBackend, pushTurn]);

  // ───────────────────────────────────────────────────────── demo autoplay
  const runDemo = useCallback(async () => {
    const queue = QUESTION_STAGES
      .map((s) => RAMESH_PERSONA.script[s])
      .filter((x): x is string => Boolean(x));
    for (const answer of queue) {
      if (stopDemoRef.current || !liveRef.current) return;
      await new Promise((r) => setTimeout(r, 1000));
      if (stopDemoRef.current || !liveRef.current) return;
      const res = await submitRef.current?.(answer);
      if (!res || res.done) break;
    }
    if (stopDemoRef.current) return;
    await new Promise((r) => setTimeout(r, 900));
    const id = beneficiaryId ?? window.localStorage.getItem("js_beneficiary");
    if (id) router.push(`/profile/${id}?demo=1`);
  }, [beneficiaryId, router]);
  const runDemoRef = useRef(runDemo);
  runDemoRef.current = runDemo;

  // ────────────────────────────────────────────────────── restart the chat
  const restart = useCallback(() => {
    stopDemoRef.current = true;
    loopGenRef.current += 1;
    liveRef.current = false;
    stopSpeaking();
    closeMic();
    busyRef.current = false;
    sessionRef.current = null;
    mockRef.current = null;
    offlineRef.current = false;
    setOffline(false);
    setTurns([]);
    setSlots({});
    setStage("name");
    setBeneficiaryId(null);
    setErrorMsg("");
    setInterim("");
    setMicMuted(false);
    micMutedRef.current = false;
    setMicDenied(false);
    setStarted(false);
    applyStatus("intro");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closeMic]);

  useEffect(() => () => {
    stopDemoRef.current = true;
    liveRef.current = false;
    loopGenRef.current += 1;
    stopSpeaking();
    closeMic();
  }, [closeMic]);

  // ──────────────────────────────────────────────────────────── interaction
  const bigButton = () => {
    if (status === "speaking") {
      // BARGE-IN: stop the agent and immediately open the line for the answer
      loopGenRef.current += 1;
      stopSpeaking();
      applyStatus("idle");
      if (!demoRef.current && !micMutedRef.current) openMicRef.current?.();
      return;
    }
    if (status === "listening") { stopListening(); return; }
    if (status === "thinking") return;
    // a muted mic must still be recoverable with one tap of the big button
    if (micMutedRef.current) {
      micMutedRef.current = false;
      setMicMuted(false);
      window.setTimeout(() => openMicRef.current?.(), 0);
      return;
    }
    if (status === "idle" || status === "error") openMicRef.current?.();
  };

  const replayQuestion = useCallback(() => {
    const last = [...turns].reverse().find((x) => x.role === "assistant");
    if (!last) return;
    void sayRef.current?.(last.text, (last.lang as LangCode | undefined) ?? langRef.current);
  }, [turns]);

  // ──────────────────────────────────────────────────────────────── view
  const stageIdx = QUESTION_STAGES.indexOf(stage === "done" ? "confirm" : stage);
  const progress = Math.round(((stageIdx + (stage === "done" ? 1 : 0)) / QUESTION_STAGES.length) * 100);
  const recording = status === "listening";
  const lastAI = [...turns].reverse().find((x) => x.role === "assistant");

  const statusMeta: Record<Status, { text: string; cls: string }> = {
    intro: { text: tx("connecting", lang), cls: "bg-slate-200 text-slate-600" },
    idle: { text: t("tap_speak", lang), cls: "bg-white/15 text-white" },
    listening: { text: tx("say_now", lang), cls: "bg-red-500 text-white" },
    thinking: { text: tx("agent_typing_short", lang), cls: "bg-saffron-500 text-white" },
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
              const st = stage === "done" || i < stageIdx ? "done" : i === stageIdx ? "active" : "todo";
              return (
                <li key={s} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${st === "active" ? "bg-saffron-50 text-navy-900" : st === "done" ? "text-greenIndia-600" : "text-slate-400"}`}>
                  <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${st === "done" ? "bg-greenIndia-500 text-white" : st === "active" ? "bg-saffron-500 text-white" : "bg-slate-200 text-slate-500"}`}>
                    {st === "done" ? "✓" : i + 1}
                  </span>
                  <span className={st === "active" ? "font-bold" : "font-semibold"}>{stageLabel(s, lang)}</span>
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

            <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
              <span>{aiPowered ? tx("ai_live", lang) : tx("ai_offline", lang)}</span>
              <button
                onClick={() => { if (!muted) stopSpeaking(); setMuted((m) => !m); }}
                className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-600"
              >
                {muted ? tx("voice_off", lang) : tx("voice_on", lang)}
              </button>
            </div>

            {/* listening mode — hands-free is the default so nobody has to hold a button */}
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>{tx("mic_mode", lang)}</span>
              <button
                onClick={() => setMode(micMode === "auto" ? "manual" : "auto")}
                className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-600"
              >
                {micMode === "auto" ? tx("mode_auto", lang) : tx("mode_manual", lang)}
              </button>
            </div>

            <button
              onClick={restart}
              className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-bold text-slate-500 transition hover:bg-slate-50"
            >
              ↺ {tx("restart", lang)}
            </button>
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
                <div className={`max-w-[88%] px-4 py-2.5 text-[16px] leading-relaxed shadow-sm md:max-w-[74%] ${turn.role === "user" ? "bubble-user" : "bubble-ai"}`}>
                  {turn.text}
                </div>
              </div>
            ))}

            {/* live partial transcript — visible the instant the user speaks */}
            {interim && (
              <div className="flex justify-end">
                <div className="bubble-user max-w-[88%] px-4 py-2.5 text-[16px] opacity-70">
                  {interim}<span className="animate-pulse">▌</span>
                </div>
              </div>
            )}

            {/* agent thinking */}
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

            {/* listening visualiser — same language as the phone channel */}
            {recording && (
              <div className="flex justify-end">
                <div className="flex items-center gap-3 rounded-2xl border-2 border-red-500/40 bg-red-50 px-4 py-2.5">
                  <span className="flex items-end gap-[3px]">
                    {Array.from({ length: 9 }).map((_, i) => (
                      <span key={i} className="speak-bar w-[3px] rounded-full bg-red-500" style={{ height: 8 + ((i * 5) % 14), animationDelay: `${i * 0.08}s` }} />
                    ))}
                  </span>
                  <span className="text-xs font-bold text-red-600">{tx("say_now", lang)}</span>
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
            {errorMsg && (
              <div className="mb-2 flex items-center justify-center gap-2 text-center">
                <p className="text-xs font-semibold text-red-600">{errorMsg}</p>
                <button
                  onClick={() => { setErrorMsg(""); if (status !== "thinking") openMicRef.current?.(); }}
                  className="rounded-lg border border-red-200 px-2 py-0.5 text-[11px] font-bold text-red-600"
                >
                  {tx("retry", lang)}
                </button>
              </div>
            )}

            {/* quick replies — one tap, no reading required */}
            {started && status !== "done" && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {([
                  ["repeat", "🔁"],
                  ["unclear", "😕"],
                  ["yes", "✅"],
                  ["no", "❌"],
                ] as const).map(([kind, icon]) => (
                  <button
                    key={kind}
                    onClick={() => { if (!busyRef.current) void sendTurn(CHIP_TEXT[kind][langRef.current]); }}
                    disabled={status === "thinking"}
                    className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-bold text-navy-900 transition hover:bg-slate-100 disabled:opacity-40"
                  >
                    <span aria-hidden>{icon}</span>
                    {tx(kind === "repeat" ? "chip_repeat" : kind === "unclear" ? "chip_unclear" : kind === "yes" ? "chip_yes" : "chip_no", lang)}
                  </button>
                ))}
                <button
                  onClick={replayQuestion}
                  disabled={!lastAI || status === "speaking"}
                  className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-bold text-navy-900 transition hover:bg-slate-100 disabled:opacity-40"
                >
                  <span aria-hidden>🔊</span>{tx("replay", lang)}
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) void sendTurn(typed); }}
                placeholder={t("type_instead", lang)}
                disabled={status === "done" || !started}
                className="min-w-0 flex-1 rounded-xl border-2 border-slate-200 bg-paper px-4 py-3 text-[15px] text-navy-900 outline-none transition focus:border-navy-900 focus:bg-white disabled:opacity-50"
              />
              <button
                onClick={() => typed.trim() && void sendTurn(typed)}
                disabled={!typed.trim() || status === "done" || status === "thinking"}
                className="shrink-0 rounded-xl border-2 border-navy-900 px-4 py-3 text-sm font-bold text-navy-900 transition hover:bg-navy-900 hover:text-white disabled:opacity-40"
              >
                {t("send", lang)}
              </button>
            </div>

            {/* ── BIG one-tap button (start / stop / interrupt) */}
            {!started ? (
              <button
                onClick={() => void start()}
                className="mt-3 flex min-h-[112px] w-full flex-col items-center justify-center gap-1 rounded-2xl bg-gradient-to-br from-saffron-500 to-saffron-600 px-4 py-4 text-white shadow-xl transition hover:brightness-105 active:scale-[0.98]"
                style={{ WebkitUserSelect: "none", userSelect: "none" }}
              >
                <span className="grid h-12 w-12 place-items-center rounded-full bg-white/20">
                  <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-xl font-extrabold tracking-tight">{tx("start_btn", lang)}</span>
                <span className="max-w-md text-center text-[12px] font-medium text-white/85">{tx("start_hint", lang)}</span>
              </button>
            ) : (
              <button
                onClick={bigButton}
                disabled={status === "thinking" || status === "done"}
                className={`mt-3 flex h-[76px] w-full select-none items-center justify-center gap-3 rounded-2xl text-white shadow-xl transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${
                  recording
                    ? "bg-red-600 ring-8 ring-red-500/25 mic-pulse"
                    : status === "speaking"
                      ? "bg-navy-800"
                      : "bg-gradient-to-br from-saffron-500 to-saffron-600 hover:brightness-105"
                }`}
                style={{ WebkitUserSelect: "none", userSelect: "none", touchAction: "manipulation" }}
              >
                <span className={`grid h-11 w-11 place-items-center rounded-full bg-white/20 ${recording ? "animate-pulse" : ""}`}>
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="text-lg font-extrabold tracking-tight md:text-xl">
                  {micMuted && !recording
                    ? tx("mic_muted", lang)
                    : recording
                      ? tx("say_now", lang)
                      : status === "speaking"
                        ? tx("speak_now", lang)
                        : micMode === "auto"
                          ? tx("mode_auto", lang)
                          : tx("tap_speak_btn", lang)}
                </span>
              </button>
            )}

            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-[11px] font-medium text-slate-400">
              <span>
                {browserSTT
                  ? `${LANG_NAME[lang]} • ${LANGS.find((l) => l.code === lang)?.bcp} • Web Speech API`
                  : tx("stt_unsupported", lang)}
              </span>
              {started && liveRef.current && (
                <button
                  onClick={() => {
                    const next = !micMuted;
                    setMicMuted(next);
                    micMutedRef.current = next;
                    if (next) { closeMic(); applyStatus("idle"); }
                    else openMicRef.current?.();
                  }}
                  className="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-600"
                >
                  {micMuted ? tx("mic_muted", lang) : tx("listening_now", lang)}
                </button>
              )}
              {micDenied && <span className="text-red-500">{tx("mic_denied", lang)}</span>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
