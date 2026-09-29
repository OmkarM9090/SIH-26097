// POST /api/profile/extract — conversation slots → structured BeneficiaryProfile
// (Module 3 output), persisted to MongoDB as a beneficiary record.
import { getDb } from "@/db";
import { ObjectId } from "mongodb";
import type { Channel, LangCode, SlotState } from "@/lib/types";
import { buildProfile } from "@/lib/conversation";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      conversationId?: string;
      slots?: SlotState;
      lang?: LangCode;
      channel?: Channel;
    };
    let slots = body.slots;
    let channel = body.channel ?? "web";
    let lang: LangCode = body.lang ?? "hi";

    const db = await getDb();
    if (body.conversationId) {
      let qId;
      try { qId = new ObjectId(body.conversationId); } catch(e) { qId = body.conversationId; }
      const row = await db.collection("conversations").findOne({ _id: qId as any });
      if (!row) return Response.json({ error: "conversation not found" }, { status: 404 });
      slots = (row.slots as SlotState) ?? {};
      channel = (row.channel as Channel) ?? channel;
      lang = (row.language as LangCode) ?? lang;
    }
    if (!slots) return Response.json({ error: "slots or conversationId required" }, { status: 400 });

    const profile = buildProfile(slots, lang);

    const beneficiary = {
      name: profile.name,
      profile,
      language: lang,
      district: profile.location.district ?? null,
      state: profile.location.state ?? null,
      channel,
      isDemo: false,
      createdAt: new Date(),
    };
    
    const result = await db.collection("beneficiaries").insertOne(beneficiary);

    return Response.json({ id: result.insertedId.toString(), profile });
  } catch (e) {
    return Response.json({ error: "profile extraction error", detail: String(e) }, { status: 500 });
  }
}
