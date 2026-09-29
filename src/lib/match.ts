// NSQF / RPL matching & skill-gap engine (Module 4 core).
//
// ranking score = skill_overlap*0.3 + interest_match*0.3
//               + income_potential*0.2 + accessibility*0.2
// (small preference-fit bonus added, capped at 1.0)
import type {
  BeneficiaryProfile, QP, RecommendationResult, GapItem, TrainingCenter,
} from "@/lib/types";
import { NSQF_QPS } from "@/data/nsqf";
import { TRAINING_CENTERS } from "@/data/centers";
import { SKILL_MAP, haversineKm } from "@/data/skills";
import { giaFor } from "@/data/gia";

function interestScore(profile: BeneficiaryProfile, qp: QP): { score: number; level: "high" | "medium" | "low" } {
  const interests = new Set(profile.interests);
  const interestLabels = profile.interest_labels.join(" ").toLowerCase();
  let score = 0;
  for (const tag of qp.tags) {
    if ([...interests].some((i) => SKILL_MAP.get(i)?.sector.toLowerCase().includes(tag)) ) score += 0.4;
    if (interestLabels.includes(tag) || [...interests].some((i) => i.includes(tag))) score += 0.4;
    if (profile.interests.some((i) => SKILL_MAP.get(i)?.kw.some((k) => tag.includes(k)))) score += 0.2;
  }
  // direct skill interest → qp core skill
  if (qp.skills.some((sk) => interests.has(sk))) score = Math.max(score, 1);
  score = Math.min(1, score);
  return { score, level: score >= 0.7 ? "high" : score >= 0.35 ? "medium" : "low" };
}

function nearestCenter(qp: QP, profile: BeneficiaryProfile): { center: TrainingCenter; dist: number } | undefined {
  const offering = TRAINING_CENTERS.filter((c) => c.qps.includes(qp.code));
  if (!offering.length) return undefined;
  const sameDistrict = offering.find(
    (c) => c.district.toLowerCase() === (profile.location.district ?? "").toLowerCase(),
  );
  if (sameDistrict) return { center: sameDistrict, dist: 12 };
  const { lat, lng } = profile.location;
  if (lat && lng) {
    let best: { center: TrainingCenter; dist: number } | undefined;
    for (const c of offering) {
      const d = haversineKm(lat, lng, c.lat, c.lng);
      if (!best || d < best.dist) best = { center: c, dist: d };
    }
    return best;
  }
  const sameState = offering.find((c) => c.state === profile.location.state) ?? offering[0];
  return { center: sameState, dist: 45 };
}

export function recommend(profile: BeneficiaryProfile, qps: QP[] = NSQF_QPS): RecommendationResult[] {
  const userSkills = new Set(profile.identified_skills);
  const mobility = Math.max(5, profile.mobility_km || 25);
  const prefSelf = profile.employment_preference.startsWith("self");

  const scored: RecommendationResult[] = qps.map((qp) => {
    const overlapIds = qp.skills.filter((s) => userSkills.has(s));
    const overlapPct = qp.skills.length ? overlapIds.length / qp.skills.length : 0;

    const { score: iScore, level: iLevel } = interestScore(profile, qp);

    const avgIncome = (qp.income[0] + qp.income[1]) / 2;
    const incomeScore = Math.min(1, Math.max(0, (avgIncome - 8000) / (30000 - 8000)));

    const nc = nearestCenter(qp, profile);
    const dist = nc?.dist ?? 999;
    const accessScore = dist <= mobility ? 1 : dist <= mobility * 2 ? 0.5 : dist <= mobility * 4 ? 0.25 : 0.1;

    const rpl = qp.rpl && overlapPct >= 0.8;

    const prefFit = prefSelf
      ? qp.selfEmp === "high" ? "Excellent self-employment fit" : qp.selfEmp === "medium" ? "Can become self-employed later" : "Mostly job-oriented"
      : qp.selfEmp === "low" ? "Direct wage-employment fit" : "Job with self-employment potential";
    const prefBonus = prefSelf
      ? qp.selfEmp === "high" ? 0.05 : qp.selfEmp === "medium" ? 0.02 : 0
      : qp.selfEmp === "low" ? 0.05 : qp.selfEmp === "medium" ? 0.03 : 0.01;

    const score = Math.min(1, overlapPct * 0.3 + iScore * 0.3 + incomeScore * 0.2 + accessScore * 0.2 + prefBonus);

    const gaps: GapItem[] = qp.skills
      .filter((s) => !userSkills.has(s))
      .map((s) => ({ skill: s, label: SKILL_MAP.get(s)?.en ?? s, labelHi: SKILL_MAP.get(s)?.hi ?? s }));
    const eduGap = profile.educationRank < qp.edu;
    if (eduGap) gaps.push({ skill: "edu_bridge", label: `Minimum education: level ${qp.edu} (bridge classes available)`, labelHi: "न्यूनतम शिक्षा — ब्रिज कक्षाएँ उपलब्ध" });
    if (!gaps.length && !rpl) gaps.push({ skill: "certification", label: "Formal NSQF certification & assessment", labelHi: "औपचारिक NSQF प्रमाणन व मूल्यांकन" });

    const trainingNeeded = !rpl;
    const durationWeeks = rpl ? 4 : Math.max(6, Math.round(qp.hours / 40));

    const selfEmpPath = prefSelf && qp.selfEmp !== "low";
    const gia = giaFor({ rpl, selfEmpPath, trainingNeeded });

    const roadmap = rpl
      ? [
          { step: "RPL orientation & evidence collection (photos, work references)", stepHi: "RPL ओरिएंटेशन व अनुभव के प्रमाण जुटाना", kind: "rpl" },
          { step: "RPL assessment by certified assessor (1–2 days)", stepHi: "प्रमाणित मूल्यांकक द्वारा RPL परीक्षण", kind: "assess" },
          ...(gaps.length ? [{ step: `Short bridge course: ${gaps.map((g) => g.label).slice(0, 2).join(", ")}`, stepHi: "छोटा ब्रिज कोर्स", kind: "train" }] : []),
          { step: `NSQF Level ${qp.level} certificate issued (${qp.body})`, stepHi: `NSQF स्तर ${qp.level} प्रमाणपत्र जारी`, kind: "cert" },
          { step: selfEmpPath ? "GIA toolkit / enterprise capital + launch own unit" : "Placement support → formal wage employment", stepHi: selfEmpPath ? "GIA टूलकिट / पूंजी सहायता से अपना काम शुरू" : "प्लेसमेंट सहायता — नौकरी", kind: "employ" },
        ]
      : [
          { step: "Mobilisation & enrolment via PM-AJAY GIA (free counselling)", stepHi: "PM-AJAY GIA के माध्यम से नामांकन", kind: "enroll" },
          { step: `NSQF training — ${qp.hours} hours (~${durationWeeks} weeks) at ${nc ? nc.center.name : "nearest PMKK"}`, stepHi: `NSQF प्रशिक्षण — ${qp.hours} घंटे, करीब ${durationWeeks} सप्ताह`, kind: "train" },
          { step: `Assessment & certification (${qp.body})`, stepHi: `मूल्यांकन व प्रमाणन (${qp.body})`, kind: "cert" },
          { step: selfEmpPath ? "GIA toolkit/enterprise support → start own work" : "Placement cell → job interviews", stepHi: selfEmpPath ? "GIA टूलकिट/पूंजी से स्वरोज़गार" : "प्लेसमेंट सेल — नौकरी", kind: "employ" },
          { step: `Expected income ${qp.income[0].toLocaleString("en-IN")}–${qp.income[1].toLocaleString("en-IN")}/month`, stepHi: `अपेक्षित आय ₹${qp.income[0].toLocaleString("en-IN")}–${qp.income[1].toLocaleString("en-IN")}/माह`, kind: "income" },
        ];

    return {
      rank: 0,
      qp,
      score,
      skillOverlapPct: Math.round(overlapPct * 100),
      overlapSkills: overlapIds.map((id) => SKILL_MAP.get(id)?.en ?? id),
      gaps,
      interestMatch: iLevel,
      rplEligible: rpl,
      durationWeeks,
      center: nc
        ? { name: nc.center.name, district: nc.center.district, distanceKm: nc.dist, phone: nc.center.phone }
        : undefined,
      income: qp.income,
      pathway: rpl ? "RPL → Bridge → Certificate" : selfEmpPath ? "Train → Certify → Own Enterprise" : "Train → Certify → Job",
      roadmap,
      gia,
      preferenceFit: prefFit,
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map((r, i) => ({ ...r, rank: i + 1 }));
}

/** Radar chart axes for the profile page, derived from skills+interests. */
export function profileRadar(profile: BeneficiaryProfile): { axis: string; axisHi: string; value: number }[] {
  const buckets = { craft: 0, technical: 0, field: 0, service: 0, digital: 0, business: 0 };
  const bump = (id: string, amt: number) => {
    const e = SKILL_MAP.get(id);
    if (e) buckets[e.axis] += amt;
  };
  profile.identified_skills.forEach((id) => bump(id, 2));
  profile.interests.forEach((id) => bump(id, 1.2));
  const meta: { key: keyof typeof buckets; en: string; hi: string }[] = [
    { key: "craft", en: "Craft & Artisan", hi: "शिल्प कौशल" },
    { key: "technical", en: "Technical", hi: "तकनीकी" },
    { key: "field", en: "Field Work", hi: "फील्ड कार्य" },
    { key: "service", en: "People Service", hi: "सेवा" },
    { key: "digital", en: "Digital", hi: "डिजिटल" },
    { key: "business", en: "Business", hi: "व्यापार" },
  ];
  return meta.map((m) => ({
    axis: m.en, axisHi: m.hi,
    value: Math.min(100, Math.round(20 + buckets[m.key] * 18)),
  }));
}
