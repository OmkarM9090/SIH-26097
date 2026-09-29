// GET /api/beneficiaries/:id — profile + latest recommendation set.
import { getDb } from "@/db";
import { ObjectId } from "mongodb";
import type { BeneficiaryProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

// PATCH /api/beneficiaries/:id — merge corrections into the stored profile
// (beneficiaries can fix anything the AI misheard during the interview).
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const patch = (await req.json()) as Partial<BeneficiaryProfile>;
    const db = await getDb();
    let qId;
    try { qId = new ObjectId(id); } catch(e) { qId = id; }
    
    const row = await db.collection("beneficiaries").findOne({ _id: qId as any });
    if (!row) return Response.json({ error: "not found" }, { status: 404 });
    const merged = {
      ...(row.profile as BeneficiaryProfile),
      ...patch,
      location: { ...(row.profile as BeneficiaryProfile).location, ...(patch.location ?? {}) },
    };
    
    await db.collection("beneficiaries").updateOne(
      { _id: qId as any },
      { $set: {
        profile: merged,
        name: merged.name,
        district: merged.location.district ?? null,
        state: merged.location.state ?? null,
      } }
    );
    return Response.json({ ok: true, profile: merged });
  } catch (e) {
    return Response.json({ error: "patch error", detail: String(e) }, { status: 500 });
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const db = await getDb();
    let qId;
    try { qId = new ObjectId(id); } catch(e) { qId = id; }
    
    const row = await db.collection("beneficiaries").findOne({ _id: qId as any });
    if (!row) return Response.json({ error: "not found" }, { status: 404 });
    
    // Map _id to id for client
    row.id = row._id.toString();
    
    const recos = await db.collection("recommendations")
      .find({ beneficiaryId: id })
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();
      
    return Response.json({ beneficiary: row, recommendations: recos[0]?.results ?? null });
  } catch (e) {
    return Response.json({ error: "fetch error", detail: String(e) }, { status: 500 });
  }
}
