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
//
// REALISM NOTES (voice must sound like a human field-worker on the phone):
//   • one warm, natural voice is LOCKED for the whole call per language, so the
//     agent never changes persona mid-conversation;
//   • Indian neural voices (Google/Neural/Natural/Online) are preferred;
//   • speech is chunked at sentence boundaries and a keep-alive ticker defeats
//     Chrome's ~15s speechSynthesis stall that used to cut long Hindi answers
//     off in the middle of a sentence;
//   • tiny breathing pauses between sentences make the delivery less robotic.
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import type { LangCode } from "@/lib/types";
import { LANGS } from "@/data/i18n";

export const bcpOf = (lang: LangCode): string => LANGS.find((l) => l.code === lang)?.bcp ?? "hi-IN";

// ───────────────────────────────────────────────────── native-only switchboard
/**
 * Default TRUE: the app runs entirely on free browser APIs.
 * `setBrowserNativeOnly(false)` is only called when /api/config reports a live,
 * quota-healthy OpenAI key. Any server failure flips it back to true forever.
 */
let browserNativeOnly = true;

export function setBrowserNativeOnly(on: boolean): void {
  browserNativeOnly = on;
  if (on) console.info("[JeevikaSetu] Voice engine: browser-native (free, offline-safe).");
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
  onstart: (() => void) | null;
  onspeechstart?: (() => void) | null;
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

export interface ListenHandle {
  stop: (finalize?: boolean) => void;
  abort: () => void;
  /** true once the recogniser confirmed it is actually capturing audio */
  readonly live: boolean;
}

/**
 * Start browser STT.
 *
 * `onFinal` may fire more than once (Chrome emits partial *final* chunks in
 * continuous mode); callers that only want one answer should pass
 * `firstFinalOnly: true` or abort the handle.
 */
export function listen(
  lang: LangCode,
  opts: {
    onInterim?: (text: string) => void;
    onFinal?: (text: string) => void;
    onEnd?: () => void;
    onError?: (err: string) => void;
    /** recogniser confirmed listening (mic permission granted, audio flowing) */
    onStart?: () => void;
    /** keep the recognizer open across pauses (hands-free / IVR mode) */
    continuous?: boolean;
    /** stop after the very first final result (one-answer hands-free turn) */
    firstFinalOnly?: boolean;
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

  let lastDelta = "";
  let live = false;
  let closed = false;

  const handle: ListenHandle = {
    get live() { return live; },
    stop: () => { try { rec.stop(); } catch { /* noop */ } },
    abort: () => {
      closed = true;
      try { rec.abort(); } catch { /* noop */ }
    },
  };

  rec.onstart = () => {
    live = true;
    opts.onStart?.();
  };

  rec.onresult = (e: SRIEvent) => {
    live = true;
    let interim = "";
    let delta = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      // DELTA, not cumulative: Chrome re-emits earlier finals with every result
      // event, which used to duplicate whole sentences in the transcript.
      if (r.isFinal) delta += r[0].transcript + " ";
      else interim += r[0].transcript;
    }
    if (interim) opts.onInterim?.(interim.trim());
    const clean = delta.trim();
    if (clean && clean !== lastDelta) {
      lastDelta = clean;
      opts.onFinal?.(clean);
      if (opts.firstFinalOnly) {
        closed = true;
        try { rec.abort(); } catch { /* noop */ }
      }
    }
  };

  rec.onerror = (e) => {
    // "no-speech" is normal (user stayed quiet) — the caller decides to retry.
    opts.onError?.(e.error ?? "unknown");
  };

  rec.onend = () => {
    live = false;
    if (!closed) opts.onEnd?.();
  };

  try {
    rec.start();
  } catch {
    return null;
  }
  return handle;
}

// ---------------------------------------------------------------- playback
let currentAudio: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  stopKeepAlive();
  if (currentAudio) {
    try { currentAudio.pause(); } catch { /* noop */ }
    currentAudio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    try {
      window.speechSynthesis.cancel();
    } catch { /* noop */ }
  }
}

export function isSpeaking(): boolean {
  if (typeof window === "undefined") return false;
  if (currentAudio && !currentAudio.paused) return true;
  return "speechSynthesis" in window && window.speechSynthesis.speaking;
}

/**
 * Speak `text`.
 *   • Browser-native mode (default / after any failure): window.speechSynthesis
 *   • Otherwise: one attempt at server OpenAI TTS, then permanent fallback.
 * Never throws and never hangs — always resolves.
 */
export async function speak(text: string, lang: LangCode, onStart?: () => void): Promise<void> {
  stopSpeaking();
  const clean = (text ?? "").trim();
  if (!clean) return;

  if (!browserNativeOnly) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 9000);
      const res = await fetch("/api/voice/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: clean, lang }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok && res.headers.get("content-type")?.includes("audio")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        currentAudio = audio;
        await new Promise<void>((resolve) => {
          let done = false;
          const finish = () => { if (!done) { done = true; resolve(); } };
          audio.onended = finish;
          audio.onerror = finish;
          audio.onplay = () => onStart?.();
          setTimeout(finish, Math.max(6000, clean.length * 140)); // watchdog
          audio.play().catch(finish);
        });
        URL.revokeObjectURL(url);
        return;
      }
      tripSpeechBreaker(`TTS HTTP ${res.status}`);
    } catch (e) {
      tripSpeechBreaker(String(e));
    }
  }

  await speakBrowser(clean, lang, onStart);
}

// ─────────────────────────── voice selection (natural, stable, per language)
const voiceCache = new Map<string, SpeechSynthesisVoice | null>();

/** Names of warm / neural / Indian voices, best first. */
const VOICE_PRIORITY = [
  "google", "natural", "neural", "online", "enhanced", "premium", "swara", "kalpana",
  "heera", "lekha", "vimita", "shruti", "ravi", "aditi", "iya", "neerja", "prabhat",
];
/** Feminine-coded voices — the agent persona (Jeevika) is a woman. */
const FEMININE = /(swara|kalpana|heera|lekha|vimita|shruti|aditi|iya|neerja|female|woman|zira|samantha|google हिन्दी|google हिंदी)/i;

function scoreVoice(v: SpeechSynthesisVoice, bcp: string): number {
  const vl = v.lang.toLowerCase().replace("_", "-");
  const base = bcp.slice(0, 2).toLowerCase();
  let score = 0;
  if (vl === bcp.toLowerCase()) score += 60;
  else if (vl.startsWith(base)) score += 45;
  else if (/-in\b/i.test(vl)) score += 8;
  else return -1;                       // wrong language — never use it
  if (v.localService) score += 4;       // works offline, no network latency
  if (/(natural|neural|online|enhanced|premium)/i.test(v.name)) score += 14;
  if (/google/i.test(v.name)) score += 10;
  if (FEMININE.test(v.name)) score += 8;
  VOICE_PRIORITY.forEach((k, i) => { if (v.name.toLowerCase().includes(k)) score += 6 - i * 0.15; });
  if (/compact|espeak|festival|pico|robot/i.test(v.name)) score -= 12;
  return score;
}

/** The single voice used for a whole call — locked so the persona never drifts. */
function pickVoice(voices: SpeechSynthesisVoice[], bcp: string): SpeechSynthesisVoice | undefined {
  const cached = voiceCache.get(bcp);
  if (cached) return cached;
  const ranked = voices
    .map((v) => ({ v, s: scoreVoice(v, bcp) }))
    .filter((x) => x.s >= 0)
    .sort((a, b) => b.s - a.s);
  const chosen = ranked[0]?.v;
  if (chosen) voiceCache.set(bcp, chosen);
  return chosen;
}

/** Pure browser speechSynthesis playback — free, offline, zero latency. */
export async function speakBrowser(text: string, lang: LangCode, onStart?: () => void): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const voices = await loadVoices();
  const bcp = bcpOf(lang);
  const voice = pickVoice(voices, bcp);

  // Chrome silently truncates / stalls on long utterances — chunk on sentences.
  const chunks = chunkText(text, 200);
  startKeepAlive();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; window.clearTimeout(guard); resolve(); } };
      const u = new SpeechSynthesisUtterance(chunk);
      u.lang = bcp;
      u.rate = 0.92;          // a touch slower = clearly understood by low-literacy listeners
      u.pitch = 1.0;
      u.volume = 1;
      if (voice) { u.voice = voice; u.lang = voice.lang || bcp; }
      u.onend = done;
      u.onerror = done;
      if (i === 0) u.onstart = () => onStart?.();
      const guard = window.setTimeout(done, Math.max(4000, chunk.length * 110));
      try {
        window.speechSynthesis.resume();  // recover from a paused engine
        window.speechSynthesis.speak(u);
      } catch { done(); return; }
    });
    // natural breath between sentences (not between fragments of one sentence)
    if (i < chunks.length - 1) await new Promise((r) => setTimeout(r, 110));
  }
  stopKeepAlive();
}

/** Chrome's speech engine can silently stop mid-utterance; nudge it back. */
let keepAlive: number | null = null;
function startKeepAlive(): void {
  if (typeof window === "undefined" || keepAlive !== null) return;
  keepAlive = window.setInterval(() => {
    try {
      if (!window.speechSynthesis.speaking) { stopKeepAlive(); return; }
      window.speechSynthesis.resume();
    } catch { /* noop */ }
  }, 4000);
}
function stopKeepAlive(): void {
  if (keepAlive !== null) {
    window.clearInterval(keepAlive);
    keepAlive = null;
  }
}

/** Split long text into speakable chunks without cutting mid-word. */
function chunkText(text: string, max: number): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return [clean];
  const parts = clean.split(/(?<=[।.!?॥;:])\s+/);
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    if ((buf + " " + p).trim().length > max && buf) { out.push(buf.trim()); buf = p; }
    else buf = (buf + " " + p).trim();
  }
  if (buf) out.push(buf.trim());
  return out.flatMap((c) => (c.length <= max ? [c] : (c.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) ?? [c]).map((s) => s.trim())));
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
    setTimeout(finish, 1500);
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
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  const mime = candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "";
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

/**
 * Ask for microphone permission BEFORE the first recognition attempt and
 * release the device immediately. Fixes the classic "first press does nothing"
 * failure: SpeechRecognition fires `not-allowed`/`aborted` when the browser is
 * still showing the permission prompt. Returns true when we may use the mic.
 */
export async function primeMicrophone(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      // Older engines: no pre-flight possible, just report "probably ok".
      return true;
    }
    if (navigator.permissions?.query) {
      try {
        const st = await navigator.permissions.query({ name: "microphone" as PermissionName });
        if (st.state === "denied") return false;
        if (st.state === "granted") return true;
      } catch { /* Safari lacks the microphone permission descriptor — fall through */ }
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

// ───────────────────────────────────────────────────────────── audio unlock
/**
 * Browsers block audio until a user gesture. Call this from the first
 * click/tap (the green Call button / the "Start" button on the talk screen) so
 * the very first AI sentence actually plays.
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
