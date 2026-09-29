// POST /api/seed — seeds the 5 curated demo personas (with their computed
// NSQF recommendation sets) so admin dashboards & demos look alive instantly.
// Idempotent: skips personas already present.
import { getDb } from "@/db";
import { PERSONAS } from "@/data/personas";
import { buildProfile } from "@/lib/conversation";
import { recommend } from "@/lib/match";

export const dynamic = "force-dynamic";

export async function POST() {
  const db = await getDb();
  let inserted = 0;
  for (const p of PERSONAS) {
    const existing = await db.collection("beneficiaries").findOne({
      name: p.slots.name ?? "",
      isDemo: true
    });
    
    if (existing) continue;

    const profile = buildProfile(p.slots, p.lang);
    const beneficiary = {
      name: profile.name,
      profile,
      language: p.lang,
      district: profile.location.district ?? null,
      state: profile.location.state ?? null,
      channel: p.channel,
      isDemo: true,
      createdAt: new Date(),
    };
    const result = await db.collection("beneficiaries").insertOne(beneficiary);
    
    const results = recommend(profile);
    await db.collection("recommendations").insertOne({ 
      beneficiaryId: result.insertedId.toString(), 
      results,
      createdAt: new Date(),
    });
    inserted++;
  }
  
  // Seed other collections
  const { TRAINING_CENTERS } = await import("@/data/centers");
  const { NSQF_QPS } = await import("@/data/nsqf");
  const { OPPORTUNITIES } = await import("@/data/opportunities");
  const { GIA_BENEFITS } = await import("@/data/gia");
  
  if ((await db.collection("training_centers").countDocuments()) === 0) {
    await db.collection("training_centers").insertMany(TRAINING_CENTERS as any);
  }
  if ((await db.collection("nsqf_qualifications").countDocuments()) === 0) {
    await db.collection("nsqf_qualifications").insertMany(NSQF_QPS);
  }
  if ((await db.collection("opportunities").countDocuments()) === 0) {
    await db.collection("opportunities").insertMany(OPPORTUNITIES);
  }
  if ((await db.collection("gia_benefits").countDocuments()) === 0) {
    await db.collection("gia_benefits").insertMany(GIA_BENEFITS);
  }
  
  return Response.json({ ok: true, inserted, personasAvailable: PERSONAS.length, collectionsSeeded: true });
}
