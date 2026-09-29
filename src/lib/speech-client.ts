// Client-side speech utilities (Module 2 front half):
//  - browser SpeechRecognition (live STT fallback when no OpenAI key)
//  - speak(): tries server OpenAI TTS first, falls back to speechSynthesis
"use client";

import type { LangCode } from "@/lib/types";
import { LANGS } from "@/data/i18n";

export const bcpOf = (lang: LangCode): string => LANGS.find((l) => l.code === lang)?.bcp ?? "hi-IN";

interface SRIInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SRIEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}
interface SRIResultAlt { transcript: string; confidence: number; }
interface SRIResult { isFinal: boolean; 0: SRIResultAlt; length: number; }
interface SRIEvent { resultIndex: number; results: { length: number; [i: number]: SRIResult }; }

type SRICtor = new () => SRIInstance;

function srCtor(): SRICtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SRICtor; webkitSpeechRecognition?: SRICtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const supportsBrowserSTT = (): boolean => typeof window !== "undefined" && srCtor() !== null;

export interface ListenHandle { stop: (finalize?: boolean) => void; abort: () => void; }

/** Start browser STT. Calls onFinal with the accumulated final transcript. */
export function listen(
  lang: LangCode,
  opts: {
    onInterim?: (text: string) => void;
    onFinal?: (text: string) => void;
    onEnd?: () => void;
    onError?: (err: string) => void;
  },
): ListenHandle | null {
  const Ctor = srCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  rec.lang = bcpOf(lang);
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = "";
  rec.onresult = (e: SRIEvent) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalText += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    if (interim) opts.onInterim?.(interim);
    if (finalText) opts.onFinal?.(finalText.trim());
  };
  rec.onerror = (e) => opts.onError?.(e.error ?? "unknown");
  rec.onend = () => opts.onEnd?.();
  try {
    rec.start();
  } catch {
    return null;
  }
  return {
    stop: () => { try { rec.stop(); } catch { /* noop */ } },
    abort: () => { try { rec.abort(); } catch { /* noop */ } },
  };
}

// ---------------------------------------------------------------- playback
let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* noop */ }
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

/** Speak text. Server TTS (OpenAI) first → browser speechSynthesis fallback. */
export async function speak(text: string, lang: LangCode, onStart?: () => void): Promise<void> {
  stopSpeaking();
  // ---- 1) server OpenAI TTS
  try {
    const res = await fetch("/api/voice/synthesize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    if (res.ok && res.headers.get("content-type")?.includes("audio")) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => resolve();
        audio.onerror = () => resolve();
        onStart?.();
        audio.play().catch(() => resolve());
      });
      URL.revokeObjectURL(url);
      return;
    }
  } catch {
    /* fall through to browser TTS */
  }
  // ---- 2) browser speechSynthesis
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  await new Promise<void>((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    const bcp = bcpOf(lang);
    u.lang = bcp;
    u.rate = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const voice =
      voices.find((v) => v.lang.toLowerCase().startsWith(bcp.slice(0, 2).toLowerCase())) ??
      voices.find((v) => v.lang.toLowerCase().includes("in"));
    if (voice) u.voice = voice;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    onStart?.();
    window.speechSynthesis.speak(u);
    // Safety timeout — some browsers drop onend
    setTimeout(resolve, Math.max(4000, text.length * 120));
  });
}

// ---------------------------------------------------------------- recording
export interface RecorderHandle {
  stop: () => Promise<Blob | null>;
  cancel: () => void;
}

/** MediaRecorder wrapper used when server Whisper STT is available. */
export function record(stream: MediaStream): RecorderHandle {
  // Chromium's Whisper-compatible container. Safari may not advertise WebM,
  // so choose its native format instead of failing microphone capture.
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  const mime = candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
  const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks: BlobPart[] = [];
  mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  mr.start(250);
  return {
    stop: () =>
      new Promise<Blob | null>((resolve) => {
        mr.onstop = () => resolve(chunks.length ? new Blob(chunks, { type: mr.mimeType || "audio/webm" }) : null);
        try { mr.stop(); } catch { resolve(null); }
      }),
    cancel: () => { try { mr.stop(); } catch { /* noop */ } },
  };
}

export async function getMicStream(): Promise<MediaStream | null> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) return null;
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,
        channelCount: 1,
      },
    });
  } catch {
    return null;
  }
}
