// WhatsApp voice-note channel (Module 8) — WhatsApp-authentic UI where the
// beneficiary sends voice notes; the bot replies with text + a playable
// voice note. Shares the same conversation pipeline (channel=whatsapp).
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ConversationReply, LangCode } from "@/lib/types";
import { RAMESH_PERSONA } from "@/data/personas";
import { STAGES } from "@/lib/conversation";
import { useAppLang } from "@/components/page-shell";
import { t } from "@/data/i18n";
import {
  getMicStream, listen, record, speak, stopSpeaking, supportsBrowserSTT,
  type ListenHandle, type RecorderHandle,
} from "@/lib/speech-client";

interface WaMsg {
  id: number;
  role: "user" | "ai";
  text: string;
  lang?: LangCode;
  voice?: boolean;
  at: string;
}

const now = () => new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

export default function WhatsAppClient() {
  const router = useRouter();
  const [lang] = useAppLang();
  const [msgs, setMsgs] = useState<WaMsg[]>([]);
  const [typed, setTyped] = useState("");
  const [recording, setRecording] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [done, setDone] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const idRef = useRef(1);
  const recRef = useRef<RecorderHandle | null>(null);
  const listenRef = useRef<ListenHandle | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [browserSTT] = useState(supportsBrowserSTT());

  const pushMsg = useCallback((m: Omit<WaMsg, "id" | "at">) => {
    setMsgs((p) => [...p, { ...m, id: idRef.current++, at: now() }]);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 99999, behavior: "smooth" }));
  }, []);

  const send = useCallback(
    async (text: string, asVoice = false) => {
      if (!sessionId || !text.trim()) return;
      setTyped("");
      pushMsg({ role: "user", text, voice: asVoice });
      setThinking(true);
      try {
        const res = await fetch("/api/conversation/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, channel: "whatsapp", lang, userText: text }),
        });
        const data = (await res.json()) as ConversationReply;
        pushMsg({ role: "ai", text: data.reply, lang: data.language, voice: true });
        if (data.done) {
          setDone(true);
          const ext = await fetch("/api/profile/extract", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ conversationId: sessionId, lang, channel: "whatsapp" }),
          });
          const j = (await ext.json()) as { id?: string };
          if (j.id) window.localStorage.setItem("js_beneficiary", j.id);
        }
      } finally {
        setThinking(false);
      }
    },
    [sessionId, lang, pushMsg],
  );

  // boot: start session + greeting bubble
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/conversation/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "whatsapp", lang }),
      });
      const data = (await res.json()) as ConversationReply;
      setSessionId(data.id);
      pushMsg({ role: "ai", text: data.reply, lang: data.language, voice: true });
    })();
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startVoice = async () => {
    if (browserSTT) {
      const handle = listen(lang, {
        onFinal: (tx) => { setRecording(false); void send(tx, true); },
        onEnd: () => setRecording(false),
        onError: () => setRecording(false),
      });
      if (handle) { listenRef.current = handle; setRecording(true); return; }
    }
    const stream = await getMicStream();
    if (!stream) return;
    streamRef.current = stream;
    recRef.current = record(stream);
    setRecording(true);
  };

  const stopVoice = async () => {
    if (listenRef.current) { listenRef.current.stop(); listenRef.current = null; return; }
    if (recRef.current) {
      const blob = await recRef.current.stop();
      recRef.current = null;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      setRecording(false);
      if (!blob) return;
      try {
        const fd = new FormData();
        fd.append("audio", blob, "note.webm");
        const res = await fetch("/api/voice/transcribe", { method: "POST", body: fd });
        if (res.ok) {
          const j = (await res.json()) as { text?: string };
          if (j.text) { await send(j.text, true); return; }
        }
      } catch { /* fall through */ }
    }
  };

  // ------------------------------ demo: play Ramesh script as voice notes
  const runDemo = async () => {
    const queue = STAGES.map((s) => RAMESH_PERSONA.script[s]).filter((x): x is string => Boolean(x));
    for (const line of queue) {
      await new Promise((r) => setTimeout(r, 900));
      await send(line, true);
      if (done) break;
    }
  };

  const playNote = async (m: WaMsg) => {
    setPlayingId(m.id);
    await speak(m.text, m.lang ?? lang);
    setPlayingId((p) => (p === m.id ? null : p));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-greenIndia-600">Channel 3 — 500M+ users already here</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 md:text-3xl">WhatsApp voice-note channel</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            The same interview, delivered as WhatsApp voice notes — recorded answers in,
            spoken replies out. Zero literacy required.
          </p>
        </div>
        <button
          onClick={() => void runDemo()}
          className="rounded-xl border border-greenIndia-500 px-4 py-2.5 text-sm font-bold text-greenIndia-600 transition hover:bg-greenIndia-50"
        >
          ▶ {t("demo_mode", lang)}
        </button>
      </div>

      <div className="mx-auto max-w-md overflow-hidden rounded-3xl border-[6px] border-navy-950 shadow-2xl">
        {/* WA header */}
        <div className="flex items-center gap-3 bg-[#075E54] px-4 py-3 text-white">
          <div className="grid h-10 w-10 place-items-center rounded-full bg-white text-xs font-black text-[#075E54]">JS</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">JeevikaSetu Seva (Govt of India)</p>
            <p className="text-[11px] text-white/70">{recording ? "recording voice note…" : thinking ? "typing…" : "online · replies by voice"}</p>
          </div>
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-white/70" fill="currentColor"><path d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" /></svg>
          <span className="text-white/70">⋮</span>
        </div>

        {/* chat area */}
        <div
          ref={scrollRef}
          className="nice-scroll h-[56dvh] space-y-2.5 overflow-y-auto px-3 py-4"
          style={{ background: "#e5ddd5", backgroundImage: "radial-gradient(rgba(0,0,0,0.06) 1px, transparent 1px)", backgroundSize: "18px 18px" }}
        >
          <p className="mx-auto w-max rounded-lg bg-[#fdf3c6] px-3 py-1.5 text-center text-[10px] text-slate-600 shadow-sm">
            Messages are end-to-end encrypted (simulated)
          </p>
          {msgs.map((m) => (
            <div key={m.id} className={`rise flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-3 py-2 text-sm leading-relaxed ${m.role === "user" ? "wa-bubble-user" : "wa-bubble-ai"}`}>
                {m.voice && (
                  <button
                    onClick={() => void playNote(m)}
                    className={`mb-1.5 flex w-52 items-center gap-2 rounded-full px-2 py-1.5 ${m.role === "user" ? "bg-black/5" : "bg-[#075E54]/5"}`}
                  >
                    <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-white ${playingId === m.id ? "bg-saffron-500" : "bg-[#075E54]"}`}>
                      {playingId === m.id ? "❚❚" : "▶"}
                    </span>
                    <span className="flex flex-1 items-end gap-[2px]">
                      {Array.from({ length: 22 }).map((_, i) => (
                        <span
                          key={i}
                          className={`w-[3px] rounded-sm ${playingId === m.id ? "speak-bar bg-saffron-600" : "bg-[#075E54]/50"}`}
                          style={{ height: 4 + Math.abs(Math.sin(i * 1.3 + m.id)) * 14, animationDelay: `${i * 0.05}s` }}
                        />
                      ))}
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">0:0{Math.min(9, Math.max(2, Math.round(m.text.length / 40)))}</span>
                  </button>
                )}
                <p>{m.text}</p>
                <p className="mt-0.5 text-right text-[9px] text-slate-400">
                  {m.at} {m.role === "user" && "✓✓"}
                </p>
              </div>
            </div>
          ))}
          {thinking && (
            <div className="flex justify-start">
              <div className="wa-bubble-ai flex items-center gap-1.5 px-3 py-2.5">
                {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          )}
          {done && (
            <div className="rise flex justify-center pt-2">
              <button
                onClick={() => { const bid = window.localStorage.getItem("js_beneficiary"); if (bid) router.push(`/profile/${bid}`); }}
                className="rounded-xl bg-[#075E54] px-5 py-3 text-sm font-bold text-white shadow-lg"
              >
                {t("view_profile", lang)} →
              </button>
            </div>
          )}
        </div>

        {/* input bar */}
        <div className="flex items-center gap-2 bg-[#f0f0f0] px-3 py-2.5">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && typed.trim()) void send(typed); }}
            placeholder={t("type_instead", lang)}
            className="min-w-0 flex-1 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none"
          />
          {typed.trim() ? (
            <button
              onClick={() => void send(typed)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#075E54] text-white transition active:scale-95"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 rotate-90" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
            </button>
          ) : (
            <button
              onClick={() => (recording ? void stopVoice() : void startVoice())}
              className={`relative grid h-11 w-11 shrink-0 place-items-center rounded-full text-white transition active:scale-95 ${recording ? "bg-red-500 ping-ring" : "bg-[#075E54]"}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
                <path d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
