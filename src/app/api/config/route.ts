// GET /api/config — tells the client which AI capabilities are live.
import { hasOpenAI } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET() {
  const ai = hasOpenAI();
  return Response.json({
    ai,
    stt: ai ? "whisper" : "webspeech",
    tts: ai ? "openai" : "webspeech",
    model: ai ? "gpt-4o" : "deterministic-fallback",
  });
}
