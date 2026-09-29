// ─────────────────────────────────────────────────────────────────────────────
// Client-side speech utilities — BROWSER-NATIVE FIRST (zero API cost).
//
//  STT : window.SpeechRecognition / window.webkitSpeechRecognition
//  TTS : window.speechSynthesis
//
// Server (OpenAI Whisper / TTS) is only ever attempted when the app explicitly
// reports it is live AND the browser-native path has not been forced. Any
// server failure (429 insufficient_quota, 500, network) trips a permanent
// per-session circuit breaker so we never hang on a dead endpoint again.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import type { LangCode } from "@/lib/types";
import { LANGS } from "@/data/i18n";

export const bcpOf = (lang: LangCode): string => LANGS.find((l) => l.code === lang)?.bcp ?? "hi-IN";

// ───────────────────────────────────────────────────── native-only switchboard
/**
 * Default TRUE: the demo runs entirely on free browser APIs.
 * `setBrowserNativeOnly(false)` is only called when /api/config reports a live,
 * quota-healthy OpenAI key. Any server failure flips it back to true forever.
 */
let browserNativeOnly = true;

export function setBrowserNativeOnly(on: boolean): void {
  browserNativeOnly = on;
}
export function isBrowserNativeOnly(): boolean {
  return browserNativeOnly;
}
/** Permanently disable server speech for this session (quota / 5xx / offline). */
export function tripSpeechBreaker(reason?: string): void {
  if (!browserNativeOnly) {
    console.warn(`[JeevikaSetu] Server speech disabled → browser-native mode. ${reason ?? ""}`);
  }
  browserNativeOnly = true;
}

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
    /** keep the recognizer open across pauses (hands-free / IVR mode) */
    continuous?: boolean;
  },
): ListenHandle | null {
  const Ctor = srCtor();
  if (!Ctor) return null;
  const rec = new Ctor();
  // Locale drives recognition accuracy: hi-IN, en-IN, ta-IN, te-IN, mr-IN, bn-IN
  rec.lang = bcpOf(lang);
  rec.interimResults = true;
  rec.continuous = Boolean(opts.continuous);
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

/**
 * Speak `text`.
 *   • Browser-native mode (default / after any failure): window.speechSynthesis
 *   • Otherwise: one attempt at server OpenAI TTS, then permanent fallback.
 * Never throws and never hangs — always resolves.
 */
export async function speak(text: string, lang: LangCode, onStart?: () => void): Promise<void> {
  stopSpeaking();
  if (!text?.trim()) return;

  if (!browserNativeOnly) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      const res = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
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
      tripSpeechBreaker(`TTS HTTP ${res.status}`);
    } catch (e) {
      tripSpeechBreaker(String(e));
    }
  }

  await speakBrowser(text, lang, onStart);
}

/** Pure browser speechSynthesis playback — free, offline, zero latency. */
export async function speakBrowser(text: string, lang: LangCode, onStart?: () => void): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = await loadVoices();
  const bcp = bcpOf(lang);

  // Chrome silently truncates long utterances — chunk on sentence boundaries.
  const chunks = chunkText(text, 220);
  for (const chunk of chunks) {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = bcp;
      u.rate = 0.95;
      u.pitch = 1.02;
      u.volume = 1;
      const voice = pickVoice(voices, bcp);
      if (voice) u.voice = voice;
      u.onend = done;
      u.onerror = done;
      onStart?.();
      try {
        window.speechSynthesis.resume(); // recover from a paused engine
        window.speechSynthesis.speak(u);
      } catch { done(); return; }
      // Safety net — some browsers drop onend.
      setTimeout(done, Math.max(4000, chunk.length * 95));
    });
  }
}

/** Split long text into speakable chunks without cutting mid-word. */
function chunkText(text: string, max: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return [clean];
  const parts = clean.split(/(?<=[।.!?॥;])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    if ((buf + " " + p).trim().length > max && buf) { out.push(buf.trim()); buf = p; }
    else buf = (buf + " " + p).trim();
  }
  if (buf) out.push(buf.trim());
  return out.flatMap((c) => (c.length <= max ? [c] : (c.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) ?? [c])));
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

// ───────────────────────────────────────────────────────────── audio unlock
/**
 * Browsers block speech synthesis until a user gesture. Call this from the
 * first click/tap (e.g. the green "Call" button) so the very first AI sentence
 * actually plays on the judges' laptop.
 */
export function warmUpSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    const u = new SpeechSynthesisUtterance(" ");
    u.volume = 0;
    window.speechSynthesis.speak(u);
    window.speechSynthesis.resume();
    void window.speechSynthesis.getVoices();
  } catch { /* noop */ }
}

/** True when window.speechSynthesis is available. */
export const supportsBrowserTTS = (): boolean =>
  typeof window !== "undefined" && "speechSynthesis" in window;
