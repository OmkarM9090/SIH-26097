// NSQF Recommendations page (Module 4 + 5 output) — ranked pathway cards,
// skill-gap analysis, RPL flags, step roadmaps, centre map, GIA benefits,
// matched opportunities, and printable report link.
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type {
  BeneficiaryProfile, RecommendationResult, TrainingCenter, Opportunity,
} from "@/lib/types";
import { useAppLang } from "@/components/page-shell";
import { t } from "@/data/i18n";
import { Ring } from "@/components/charts";
import TrainingCenterMap from "@/components/TrainingCenterMap";
import { formatINR } from "@/data/skills";
import { recommend } from "@/lib/match";
import { readLocalProfile } from "@/lib/offline-agent";

interface Bundle {
  beneficiary: { id: string; name: string; profile: BeneficiaryProfile };
  recommendations: RecommendationResult[] | null;
}

const MEDAL_STYLES = [
  { label: "1", cls: "bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-950" },
  { label: "2", cls: "bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900" },
  { label: "3", cls: "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-50" },
];

export default function RecoClient({ id }: { id: string }) {
  const [lang] = useAppLang();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [results, setResults] = useState<RecommendationResult[] | null>(null);
  const [open, setOpen] = useState<number>(0);
  const [centers, setCenters] = useState<TrainingCenter[]>([]);
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      // offline/mock path — everything is computed in the browser
      const local = readLocalProfile(id) as Bundle | null;
      try {
        let j: Bundle;
        if (local && id.startsWith("local-")) {
          j = local;
        } else {
          const res = await fetch(`/api/beneficiaries/${id}`);
          const parsed = (await res.json()) as Bundle & { error?: string };
          if (parsed.error) throw new Error(parsed.error);
          j = parsed;
        }
        let list = j.recommendations;
        if (!list) {
          try {
            if (id.startsWith("local-")) throw new Error("local");
            const rec = await fetch("/api/recommend", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ beneficiaryId: id }),
            });
            if (!rec.ok) throw new Error(`HTTP ${rec.status}`);
            const rj = (await rec.json()) as { results: RecommendationResult[] };
            list = rj.results;
          } catch {
            // deterministic matching engine runs fine client-side
            list = recommend(j.beneficiary.profile);
          }
        }
        setBundle(j);
        setResults(list);

        const profile = j.beneficiary.profile;
        const qp = list?.[0]?.qp.code;
        const queryParams = new URLSearchParams();
        if (profile.location.district) queryParams.set("district", profile.location.district);
        if (qp) queryParams.set("qp", qp);
        if (profile.location.lat && profile.location.lng) {
          queryParams.set("lat", profile.location.lat.toString());
          queryParams.set("lng", profile.location.lng.toString());
        }
        if (profile.mobility_km) {
          queryParams.set("mobilityKm", profile.mobility_km.toString());
        }
        
        const [cRes, oRes] = await Promise.all([
          fetch(`/api/training-centers?${queryParams.toString()}`),
          fetch(`/api/opportunities?district=${encodeURIComponent(profile.location.district ?? "")}`),
        ]);
        const cj = (await cRes.json()) as { centers: TrainingCenter[] };
        const oj = (await oRes.json()) as { opportunities: Opportunity[] };
        setCenters(cj.centers.slice(0, 10));
        setOpps(oj.opportunities.slice(0, 6));
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, [id]);

  const profile = bundle?.beneficiary.profile ?? null;
  const userPin = useMemo(
    () =>
      profile?.location.lat && profile.location.lng
        ? { lat: profile.location.lat, lng: profile.location.lng, label: profile.location.district ?? "Home" }
        : null,
    [profile],
  );

  if (err)
    return <div className="mx-auto max-w-2xl px-4 py-20 text-center text-sm font-semibold text-red-600">{err}</div>;

  if (!bundle || !results)
    return (
      <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
        <p className="text-center text-sm font-bold text-navy-900">Running skill-gap analysis…</p>
        {[1, 2, 3].map((i) => <div key={i} className="shimmer h-40 rounded-2xl" />)}
      </div>
    );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="rise mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-saffron-600">
            NSQF Mapping • Skill-Gap Analysis • RPL Detection
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 md:text-3xl">
            {lang === "hi"
              ? `${bundle.beneficiary.name} के लिए शीर्ष सिफारिशें`
              : `Top Recommendations for ${bundle.beneficiary.name}`}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Ranked by skill overlap (30%) · interest alignment (30%) · income potential (20%) · accessibility (20%).
          </p>
        </div>
        <Link
          href={`/report/${id}`}
          className="rounded-xl border border-navy-900 px-4 py-2.5 text-sm font-bold text-navy-900 transition hover:bg-navy-50"
        >
          {t("print", lang)}
        </Link>
      </div>

      {/* ------------------------------------------------ pathway cards */}
      <div className="space-y-4">
        {results.map((r, i) => {
          const isOpen = open === i;
          return (
            <article
              key={r.qp.code}
              className={`gov-card rise overflow-hidden transition ${isOpen ? "ring-2 ring-saffron-400" : ""}`}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <button onClick={() => setOpen(isOpen ? -1 : i)} className="flex w-full items-center gap-4 px-5 py-4 text-left">
                {i < 3 ? (
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-black shadow ${MEDAL_STYLES[i].cls}`}>
                    {MEDAL_STYLES[i].label}
                  </span>
                ) : (
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-black text-slate-500">
                    {i + 1}
                  </span>
                )}
                <Ring pct={r.skillOverlapPct} size={72} stroke={7} color={r.skillOverlapPct >= 80 ? "#138808" : r.skillOverlapPct >= 50 ? "#ff9933" : "#1a2a6b"} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-extrabold text-navy-900 md:text-lg">
                      {lang === "hi" ? r.qp.nameHi : r.qp.name}
                    </h2>
                    <span className="rounded bg-navy-900 px-2 py-0.5 text-[10px] font-bold text-white">NSQF L{r.qp.level}</span>
                    <span className="rounded bg-navy-50 px-2 py-0.5 font-mono text-[10px] font-bold text-navy-800">{r.qp.code}</span>
                    {r.rplEligible && (
                      <span className="rounded bg-greenIndia-500 px-2 py-0.5 text-[10px] font-extrabold text-white">RPL ELIGIBLE ✓</span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {r.qp.sector} · {r.preferenceFit} · {r.pathway}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-600">
                    <span>Interest match: <b className={r.interestMatch === "high" ? "text-greenIndia-600" : "text-saffron-600"}>{r.interestMatch.toUpperCase()}</b></span>
                    <span>Training: <b>{r.rplEligible ? "RPL + short bridge (~1 mo)" : `~${r.durationWeeks} weeks`}</b></span>
                    {r.center && <span>Centre: <b>{r.center.district} ({r.center.distanceKm} km)</b></span>}
                    <span className="text-greenIndia-600">Income: <b>{formatINR(r.income[0])}–{formatINR(r.income[1])}/mo</b></span>
                  </div>
                </div>
                <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9l6 6 6-6" /></svg>
              </button>

              {isOpen && (
                <div className="grid gap-6 border-t border-slate-100 px-5 py-5 md:grid-cols-[1fr_1fr]">
                  {/* gaps */}
                  <div>
                    <p className="mb-2 text-xs font-extrabold uppercase tracking-wider text-navy-900">
                      Skill gap analysis
                    </p>
                    {r.overlapSkills.length > 0 && (
                      <p className="mb-2 text-xs text-slate-500">
                        Already have: <span className="font-bold text-greenIndia-600">{r.overlapSkills.join(", ")}</span>
                      </p>
                    )}
                    <ul className="space-y-1.5">
                      {r.gaps.map((g) => (
                        <li key={g.skill} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-saffron-500" />
                          <span>{lang === "hi" ? g.labelHi : g.label}</span>
                        </li>
                      ))}
                    </ul>
                    {r.center ? (
                      <div className="mt-4 rounded-xl bg-navy-50 p-3 text-xs text-slate-600">
                        <p className="font-extrabold text-navy-900">Nearest training centre</p>
                        <p className="mt-0.5 font-semibold">{r.center.name}, {r.center.district}</p>
                        <p className="text-slate-500">{r.center.distanceKm} km away · Helpline {r.center.phone}</p>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                        Delivered via mobile training unit / district PMKK (mapped post-enrolment).
                      </p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className="rounded-lg bg-navy-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-navy-700">
                        Enroll interest / रुचि दर्ज करें
                      </button>
                      <button className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-bold text-navy-900 transition hover:bg-navy-50">
                        Know more
                      </button>
                    </div>
                  </div>

                  {/* roadmap */}
                  <div>
                    <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-navy-900">Pathway roadmap</p>
                    <ol className="relative space-y-4 border-l-2 border-dashed border-slate-300 pl-5">
                      {r.roadmap.map((step, si) => (
                        <li key={si} className="relative">
                          <span className={`absolute -left-[27px] top-0.5 grid h-4 w-4 place-items-center rounded-full border-2 ${
                            step.kind === "cert" ? "border-saffron-500 bg-saffron-100" : step.kind === "employ" || step.kind === "income" ? "border-greenIndia-500 bg-greenIndia-100" : "border-navy-700 bg-navy-50"}`} />
                          <p className="text-sm font-semibold text-navy-900">{lang === "hi" ? step.stepHi : step.step}</p>
                          {lang === "hi" && <p className="text-[11px] text-slate-400">{step.step}</p>}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-4 rounded-xl border border-saffron-500/30 bg-saffron-50 p-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-wider text-saffron-600">PM-AJAY GIA support</p>
                      <ul className="mt-1.5 space-y-1">
                        {r.gia.map((g) => (
                          <li key={g.title} className="flex items-baseline justify-between gap-2 text-xs">
                            <span className="font-semibold text-slate-700">{g.title}</span>
                            <span className="shrink-0 font-bold text-navy-900">{g.amount}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {/* ------------------------------------------------ centres + opportunities */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        <div className="gov-card p-5">
          <p className="mb-1 text-sm font-extrabold text-navy-900">Nearby NSQF training centres</p>
          <p className="mb-3 text-xs text-slate-400">
            {centers.length} centres mapped · top pathway coverage
          </p>
          <TrainingCenterMap centers={centers} beneficiaryLocation={userPin ? {lat: userPin.lat, lng: userPin.lng} : undefined} />
          <ul className="mt-3 space-y-2">
            {centers.slice(0, 3).map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-lg bg-paper px-3 py-2 text-xs">
                <span className="font-bold text-navy-900">{c.name}</span>
                <span className="font-semibold text-slate-500">{c.district}, {c.state}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="gov-card p-5">
          <p className="mb-3 text-sm font-extrabold text-navy-900">Matched opportunities near you</p>
          <div className="space-y-2.5">
            {opps.map((o) => (
              <div key={o.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-navy-900">{o.title}</p>
                  <p className="text-[11px] text-slate-500">
                    {o.district}, {o.state} · {o.sector}
                    {o.employer ? ` · ${o.employer}` : o.investment ? ` · invest ${o.investment}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-extrabold ${o.type === "self" ? "bg-saffron-100 text-saffron-600" : "bg-navy-50 text-navy-800"}`}>
                    {o.type === "self" ? "SELF" : "JOB"}
                  </span>
                  <p className="mt-1 text-[11px] font-bold text-greenIndia-600">{o.income}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 rounded-lg bg-navy-50 px-3 py-2 text-[11px] leading-relaxed text-navy-800">
            Opportunities are refreshed from NCS / district employment exchanges in the production
            build; shown here with curated SIH demo data.
          </p>
        </div>
      </div>
    </div>
  );
}
