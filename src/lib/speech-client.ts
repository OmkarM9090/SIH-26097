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
  // ---- 2) browser speechSynthesis (pick the most natural available voice)
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = await loadVoices();
  await new Promise<void>((resolve) => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; resolve(); } };
    const u = new SpeechSynthesisUtterance(text);
    const bcp = bcpOf(lang);
    u.lang = bcp;
    u.rate = 0.96;
    u.pitch = 1.02;
    const voice = pickVoice(voices, bcp);
    if (voice) u.voice = voice;
    u.onend = done;
    u.onerror = done;
    onStart?.();
    window.speechSynthesis.speak(u);
    // Safety net — some browsers drop onend on long utterances.
    setTimeout(done, Math.max(6000, text.length * 95));
  });
}

/** speechSynthesis voices load asynchronously on first use. */
function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) { resolve(existing); return; }
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.onvoiceschanged = finish;
    setTimeout(finish, 1200);
  });
}

/** Prefer an exact-locale, natural/neural voice; degrade gracefully. */
function pickVoice(voices: SpeechSynthesisVoice[], bcp: string): SpeechSynthesisVoice | undefined {
  const base = bcp.slice(0, 2).toLowerCase();
  const natural = (v: SpeechSynthesisVoice) =>
    /google|natural|neural|premium|enhanced|online/i.test(v.name);
  const exact = voices.filter((v) => v.lang.toLowerCase().replace("_", "-") === bcp.toLowerCase());
  const sameLang = voices.filter((v) => v.lang.toLowerCase().startsWith(base));
  const indian = voices.filter((v) => /(-|_)IN\b/i.test(v.lang));
  return (
    exact.find(natural) ?? exact[0] ??
    sameLang.find(natural) ?? sameLang[0] ??
    indian.find(natural) ?? indian[0]
  );
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
