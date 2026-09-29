// GET /report/:id — printable NSQF livelihood recommendation report
// (Module 6.4 — "Download/share recommendation report"). Server-rendered,
// print-optimised; the client print button triggers window.print().
import { getDb } from "@/db";
import { ObjectId } from "mongodb";
import Link from "next/link";
import type { BeneficiaryProfile, RecommendationResult } from "@/lib/types";
import { PageShell } from "@/components/page-shell";
import { PrintButton } from "@/components/report-bits";
import { GIA_BENEFITS } from "@/data/gia";
import { formatINR } from "@/data/skills";

export const dynamic = "force-dynamic";

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = await getDb();
  let qId;
  try { qId = new ObjectId(id); } catch(e) { qId = id; }
  
  const row = await db.collection("beneficiaries").findOne({ _id: qId as any });
  if (!row) {
    return (
      <PageShell>
        <div className="mx-auto max-w-2xl px-4 py-24 text-center">
          <p className="text-sm font-semibold text-slate-500">Report not found.</p>
          <Link href="/" className="mt-3 inline-block font-bold text-navy-700 underline">← Back to home</Link>
        </div>
      </PageShell>
    );
  }
  const profile = row.profile as unknown as BeneficiaryProfile;
  const recRows = await db.collection("recommendations")
    .find({ beneficiaryId: id })
    .sort({ createdAt: -1 })
    .limit(1)
    .toArray();
  const results = (recRows[0]?.results as RecommendationResult[]) ?? [];
  const top = results[0];
  const loc = [profile.location.village, profile.location.district, profile.location.state].filter(Boolean).join(", ");

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="no-print mb-5 flex items-center justify-between">
          <Link href={`/recommendations/${id}`} className="text-sm font-bold text-navy-700 hover:text-saffron-600">
            ← Back to recommendations
          </Link>
          <PrintButton />
        </div>

        <article className="gov-card overflow-hidden">
          {/* letterhead */}
          <div className="bg-navy-900 px-8 py-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-saffron-400">
                  Government of India · Ministry of Social Justice &amp; Empowerment
                </p>
                <h1 className="mt-1 text-2xl font-black tracking-tight">JeevikaSetu — Livelihood Recommendation Report</h1>
                <p className="mt-1 text-xs text-white/60">
                  PM-AJAY (GIA Component) · NSQF-Aligned Skilling Pathway · Profile ID {id.slice(0, 8).toUpperCase()}
                </p>
              </div>
              <div className="tricolor h-10 w-10 shrink-0 rounded-full opacity-90" />
            </div>
            <div className="tricolor mt-4 h-1 rounded-full" />
          </div>

          <div className="px-8 py-6">
            {/* profile summary */}
            <section>
              <H2>1. Beneficiary Profile</H2>
              <div className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
                <Row k="Name" v={profile.name} />
                <Row k="Category" v={`${profile.category} (PM-AJAY eligible)`} />
                <Row k="Location" v={loc || "—"} />
                <Row k="Education" v={profile.education} />
                <Row k="Family occupation" v={profile.family_occupation} />
                <Row k="Current livelihood" v={profile.current_livelihood} />
                <Row k="Identified skills" v={profile.skill_labels.map((s) => s.en).join(", ") || "—"} />
                <Row k="Interests" v={profile.interest_labels.join(", ") || "—"} />
                <Row k="Preference" v={profile.employment_preference} />
                <Row k="Mobility" v={profile.mobility} />
                <Row k="Constraints" v={profile.physical_constraints} />
                <Row k="Languages" v={profile.language_spoken.join(", ")} />
              </div>
            </section>

            {/* recommendations table */}
            <section className="mt-8">
              <H2>2. NSQF-Aligned Recommendations (Ranked)</H2>
              <table className="mt-3 w-full text-left text-xs">
                <thead>
                  <tr className="border-b-2 border-navy-900 text-[10px] uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Qualification Pack</th>
                    <th className="py-2 pr-2">NSQF</th>
                    <th className="py-2 pr-2">Skill match</th>
                    <th className="py-2 pr-2">Pathway</th>
                    <th className="py-2 pr-2">Training</th>
                    <th className="py-2 pr-2">Income potential</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.qp.code} className="border-b border-slate-200">
                      <td className="py-2.5 pr-2 font-black">{r.rank}</td>
                      <td className="py-2.5 pr-2">
                        <span className="font-bold text-navy-900">{r.qp.name}</span>
                        <span className="block font-mono text-[10px] text-slate-400">{r.qp.code} · {r.qp.sector}</span>
                        {r.rplEligible && <span className="mt-0.5 inline-block rounded bg-greenIndia-100 px-1.5 py-0.5 text-[9px] font-extrabold text-greenIndia-600">RPL ELIGIBLE</span>}
                      </td>
                      <td className="py-2.5 pr-2 font-bold">L{r.qp.level}</td>
                      <td className="py-2.5 pr-2 font-bold">{r.skillOverlapPct}%</td>
                      <td className="py-2.5 pr-2">{r.pathway}</td>
                      <td className="py-2.5 pr-2">{r.rplEligible ? "RPL + bridge" : `~${r.durationWeeks} wks`}</td>
                      <td className="py-2.5 pr-2 font-bold text-greenIndia-600">
                        {formatINR(r.income[0])}–{formatINR(r.income[1])}/mo
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            {/* top pathway detail */}
            {top && (
              <section className="mt-8 grid gap-6 md:grid-cols-2">
                <div>
                  <H2>3. Priority Pathway — {top.qp.name}</H2>
                  <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">
                    {top.roadmap.map((s, i) => <li key={i}>{s.step}</li>)}
                  </ol>
                </div>
                <div>
                  <H2>4. Skill Gaps to Bridge</H2>
                  <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                    {top.gaps.map((g) => <li key={g.skill}>{g.label}</li>)}
                  </ul>
                  {top.center && (
                    <p className="mt-3 rounded-lg bg-navy-50 px-3 py-2 text-xs text-navy-800">
                      Nearest centre: <b>{top.center.name}, {top.center.district}</b> ({top.center.distanceKm} km) · {top.center.phone}
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* GIA */}
            <section className="mt-8">
              <H2>5. Applicable PM-AJAY GIA Support</H2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[...new Map((top?.gia ?? []).map((g) => [g.title, g])).values()].map((g) => (
                  <div key={g.title} className="rounded-lg border border-saffron-500/30 bg-saffron-50 px-3 py-2.5">
                    <p className="text-xs font-extrabold text-navy-900">{g.title}</p>
                    <p className="text-[11px] font-bold text-greenIndia-600">{g.amount}</p>
                  </div>
                ))}
                {[...new Map((top?.gia ?? []).map((g) => [g.title, g])).values()].length === 0 &&
                  GIA_BENEFITS.slice(0, 2).map((g) => (
                    <div key={g.id} className="rounded-lg border border-saffron-500/30 bg-saffron-50 px-3 py-2.5">
                      <p className="text-xs font-extrabold text-navy-900">{g.title}</p>
                      <p className="text-[11px] font-bold text-greenIndia-600">{g.amount}</p>
                    </div>
                  ))}
              </div>
            </section>

            <footer className="mt-8 border-t border-slate-200 pt-4 text-[10px] leading-relaxed text-slate-400">
              Generated by JeevikaSetu AI through a voice interview in {profile.language_spoken[0] ?? "Hindi"} ·{" "}
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}.
              Recommendations are advisory and subject to assessment by the empanelled training provider and
              PM-AJAY GIA project sanction. Prototype report — Smart India Hackathon 2026 (PS 26097).
            </footer>
          </div>
        </article>
      </div>
    </PageShell>
  );
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-extrabold uppercase tracking-wider text-navy-900">{children}</h2>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-32 shrink-0 font-bold text-slate-400">{k}</span>
      <span className="font-semibold text-navy-900">{v}</span>
    </div>
  );
}
