import { getDb } from "@/db";
import type { Channel, LangCode } from "@/lib/types";
import { greeting } from "@/lib/conversation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { language?: LangCode; channel?: Channel };
    const language = body.language ?? "hi";
    const channel = body.channel === "ivr" || body.channel === "whatsapp" ? body.channel : "web";
    const text = greeting(language);
    const result = await (await getDb()).collection("conversations").insertOne({
      language, channel, transcript: [{ role: "assistant", text, lang: language, at: Date.now() }],
      slots: {}, stage: "name", done: false, createdAt: new Date(), updatedAt: new Date(),
    });
    return Response.json({ session_id: result.insertedId.toString(), greeting_text: text, greeting_audio_url: null });
  } catch (error) {
    return Response.json({ error: "conversation start failed", detail: String(error) }, { status: 500 });
  }
}
