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
    if (!(audio instanceof Blob)) {
      return Response.json({ error: "audio file required" }, { status: 400 });
    }
    const result = await whisperTranscribe(audio, "speech.webm");
    if (!result) return Response.json({ error: "transcription failed" }, { status: 502 });
    return Response.json(result);
  } catch (e) {
    return Response.json({ error: "transcription error", detail: String(e) }, { status: 500 });
  }
}
