// POST /api/voice/synthesize — text + language → audio/mpeg (Module 2, TTS).
// Returns 204 when OpenAI is not configured; the client then falls back to
// the browser's speechSynthesis voices.
import { openAITTS, hasOpenAI } from "@/lib/llm";
import type { LangCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { text?: string; lang?: LangCode };
    if (!body.text) return new Response(null, { status: 400 });
    if (!hasOpenAI()) return new Response(null, { status: 204 });
    const audio = await openAITTS(body.text, body.lang ?? "hi");
    if (!audio) return new Response(null, { status: 204 });
    return new Response(audio, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return new Response(null, { status: 204 });
  }
}
