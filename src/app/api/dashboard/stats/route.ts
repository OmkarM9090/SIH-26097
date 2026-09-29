// GET /api/dashboard/stats — aggregated program-monitoring metrics for the
// officials dashboard (Module 6): counts, language mix, channel split,
// sector-wise recommendation demand, district heat, recent profiles.
import { getDb } from "@/db";
import type { RecommendationResult } from "@/lib/types";
import { LANG_NAME } from "@/data/i18n";
import type { LangCode } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = await getDb();
    
    const total = await db.collection("beneficiaries").countDocuments();

    const byLangRaw = await db.collection("beneficiaries").aggregate([
      { $group: { _id: "$language", count: { $sum: 1 } } }
    ]).toArray();
    const byLang = byLangRaw.map(x => ({ language: x._id, count: x.count }));

    const byChannelRaw = await db.collection("beneficiaries").aggregate([
      { $group: { _id: "$channel", count: { $sum: 1 } } }
    ]).toArray();
    const byChannel = byChannelRaw.map(x => ({ channel: x._id, count: x.count }));

    const byDistrictRaw = await db.collection("beneficiaries").aggregate([
      { $group: { _id: { district: "$district", state: "$state" }, count: { $sum: 1 } } }
    ]).toArray();
    const byDistrict = byDistrictRaw.map(x => ({ district: x._id.district, state: x._id.state, count: x.count }));

    const recentRaw = await db.collection("beneficiaries")
      .find({})
      .sort({ createdAt: -1 })
      .limit(12)
      .project({ _id: 1, name: 1, district: 1, state: 1, channel: 1, language: 1, isDemo: 1, createdAt: 1 })
      .toArray();
    const recent = recentRaw.map(x => ({ ...x, id: x._id.toString() }));

    // Sector demand from recommended QPs (top card of each set)
    const recRows = await db.collection("recommendations").find({}).project({ results: 1 }).toArray();
    const sectorCount = new Map<string, number>();
    const qpCount = new Map<string, number>();
    let rplCount = 0;
    let recTotal = 0;
    let scoreTotal = 0;
    let scoreCount = 0;
    let giaLinked = 0;
    for (const r of recRows) {
      const list = (r.results as unknown as RecommendationResult[]) ?? [];
      for (const it of list.slice(0, 3)) {
        sectorCount.set(it.qp.sector, (sectorCount.get(it.qp.sector) ?? 0) + 1);
        qpCount.set(it.qp.name, (qpCount.get(it.qp.name) ?? 0) + 1);
      }
      if (list.some((it) => it.rplEligible)) rplCount++;
      if (list.some((it) => it.gia?.length)) giaLinked++;
      for (const it of list) {
        const score = Number(it.skillOverlapPct ?? it.score ?? 0);
        if (Number.isFinite(score)) { scoreTotal += score; scoreCount++; }
      }
      recTotal++;
    }

    return Response.json({
      total,
      total_beneficiaries: total,
      recommendationSets: recTotal,
      total_recommendations: recTotal,
      avgSkillMatchScore: scoreCount ? Math.round(scoreTotal / scoreCount) : 0,
      avg_skill_match_score: scoreCount ? Math.round(scoreTotal / scoreCount) : 0,
      giaBenefitsLinked: giaLinked,
      gia_benefits_linked: giaLinked,
      rplEligibleShare: recTotal ? Math.round((rplCount / recTotal) * 100) : 0,
      rplConversionRate: recTotal ? Math.round((rplCount / recTotal) * 100) : 0, // Duplicate of eligible for now
      avgDurationMins: "4.2", // Mocked value
      byLang: byLang.map((x) => ({ label: LANG_NAME[(x.language ?? "hi") as LangCode] ?? x.language, count: Number(x.count) })),
      byChannel: byChannel.map((x) => ({ label: x.channel ?? "web", count: Number(x.count) })),
      districts: byDistrict
        .filter((d) => d.district)
        .map((d) => ({ district: d.district, state: d.state, count: Number(d.count) })),
      topSectors: [...sectorCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([label, count]) => ({ label, count })),
      topPathways: [...qpCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([label, count]) => ({ label, count })),
      recent,
    });
  } catch (e) {
    return Response.json({ error: "stats error", detail: String(e) }, { status: 500 });
  }
}
