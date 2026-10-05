// POST /api/voice/transcribe — audio blob → transcript (Module 2, Whisper).
// Returns 503 when OPENAI_API_KEY is absent so the client can use the
// browser SpeechRecognition fallback instead.
import { whisperTranscribe, hasOpenAI } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!hasOpenAI()) {
    return Response.json({ error: "STT unavailable — use browser fallback" }, { status: 503 });
  }
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const requestedLanguage = String(form.get("language") ?? "").trim();
    if (!(audio instanceof Blob)) {
      return Response.json({ error: "audio file required" }, { status: 400 });
    }
    const LANG_OK = ["hi", "en", "ta", "te", "mr", "bn"] as const;
    type L = (typeof LANG_OK)[number];
    const hint = LANG_OK.includes(requestedLanguage as L) ? (requestedLanguage as L) : undefined;
    // Whisper accepts the browser's WebM/Opus blob directly; do not attempt
    // to parse it as text or convert it in the browser. The language hint
    // greatly improves accuracy for Indic scripts.
    const result = await whisperTranscribe(audio, "speech.webm", hint);
    if (!result) return Response.json({ error: "transcription failed" }, { status: 502 });
    return Response.json({
      text: result.text,
      detected_language: result.language ?? requestedLanguage ?? "unknown",
    });
  } catch (e) {
    return Response.json({ error: "transcription error", detail: String(e) }, { status: 500 });
  }
}
