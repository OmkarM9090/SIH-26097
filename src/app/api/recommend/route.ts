// POST /api/recommend — beneficiary profile → ranked NSQF recommendations
// with skill-gap analysis, RPL detection, centres, GIA benefits (Module 4/5).
import { getDb } from "@/db";
import { ObjectId } from "mongodb";
import type { BeneficiaryProfile } from "@/lib/types";
import { recommend } from "@/lib/match";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { beneficiaryId?: string; profile?: BeneficiaryProfile };
    let profile = body.profile;
    let beneficiaryId = body.beneficiaryId ?? null;

    const db = await getDb();
    if (!profile && beneficiaryId) {
      let qId;
      try { qId = new ObjectId(beneficiaryId); } catch(e) { qId = beneficiaryId; }
      
      const row = await db.collection("beneficiaries").findOne({ _id: qId as any });
      if (!row) return Response.json({ error: "beneficiary not found" }, { status: 404 });
      profile = row.profile as BeneficiaryProfile;
    }
    if (!profile) return Response.json({ error: "profile required" }, { status: 400 });

    const results = recommend(profile);

    if (beneficiaryId) {
      await db.collection("recommendations").insertOne({
        beneficiaryId,
        results,
        createdAt: new Date(),
      });
    }
    return Response.json({ results });
  } catch (e) {
    return Response.json({ error: "recommendation error", detail: String(e) }, { status: 500 });
  }
}
