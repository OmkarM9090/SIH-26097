// Officials / Admin Dashboard (Module 6.5) — program-monitoring metrics:
// totals, language & channel mix, sector demand, district heat, RPL share,
// recent beneficiary profiles. Includes one-click demo-persona seeding.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useAppLang } from "@/components/page-shell";
import { t } from "@/data/i18n";
import { Donut, BarsH } from "@/components/charts";
import { GIA_BENEFITS } from "@/data/gia";

interface Stats {
  total: number;
  recommendationSets: number;
  rplEligibleShare: number;
  rplConversionRate: number;
  avgDurationMins: string;
  byLang: { label: string; count: number }[];
  byChannel: { label: string; count: number }[];
  districts: { district: string | null; state: string | null; count: number }[];
  topSectors: { label: string; count: number }[];
  topPathways: { label: string; count: number }[];
  recent: {
    id: string; name: string; district: string | null; state: string | null;
    channel: string; language: string; isDemo: boolean; createdAt: string;
  }[];
}

export default function AdminClient() {
  const [lang] = useAppLang();
  const [stats, setStats] = useState<Stats | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [filter, setFilter] = useState("");

  const load = useCallback(async () => {
    const res = await fetch("/api/dashboard/stats");
    setStats((await res.json()) as Stats);
  }, []);

  useEffect(() => {
    void (async () => {
      // ensure demo personas exist so the dashboard is never empty
      await fetch("/api/seed", { method: "POST" });
      await load();
    })();
  }, [load]);

  const reseed = async () => {
    setSeeding(true);
    await fetch("/api/seed", { method: "POST" });
    await load();
    setSeeding(false);
  };

  if (!stats)
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-10">
        {[1, 2, 3, 4].map((i) => <div key={i} className="shimmer h-32 rounded-2xl" />)}
      </div>
    );

  const maxDistrict = Math.max(1, ...stats.districts.map((d) => d.count));
  const recent = stats.recent.filter(
    (r) => !filter || r.channel === filter || r.name.toLowerCase().includes(filter.toLowerCase()) || (r.district ?? "").toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="rise mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-saffron-600">PM-AJAY · GIA · Program monitoring</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 md:text-3xl">{t("admin_title", lang)}</h1>
          <p className="mt-1 text-sm text-slate-500">Live aggregates from profiling conversations across all channels.</p>
        </div>
        <button
          onClick={() => void reseed()}
          disabled={seeding}
          className="rounded-xl border border-navy-900 px-4 py-2.5 text-sm font-bold text-navy-900 transition hover:bg-navy-50 disabled:opacity-50"
        >
          {seeding ? "Seeding…" : "↻ Refresh / seed demo personas"}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          [String(stats.total), "Beneficiaries profiled", "bg-white/80 backdrop-blur-xl border-white/50 text-navy-900", "text-navy-900/60"],
          [String(stats.recommendationSets), "Recommendation sets generated", "bg-white/80 backdrop-blur-xl border-white/50 text-navy-900", "text-navy-900/60"],
          [stats.rplEligibleShare + "%", "Profiles with RPL-eligible pathway", "bg-white/80 backdrop-blur-xl border-white/50 text-navy-900", "text-navy-900/60"],
          [stats.avgDurationMins + "m", "Avg. Interview Duration", "bg-white/80 backdrop-blur-xl border-white/50 text-navy-900", "text-navy-900/60"],
          [stats.rplConversionRate + "%", "RPL Conversion Rate", "bg-white/80 backdrop-blur-xl border-white/50 text-navy-900", "text-navy-900/60"],
          [String(GIA_BENEFITS.length), "GIA benefit instruments linked", "bg-white/80 backdrop-blur-xl border-white/50 text-navy-900", "text-navy-900/60"],
        ].map(([num, label, cls, sub], i) => (
          <div key={label} className={`gov-card rise p-5 shadow-lg rise-${i + 1} ${cls}`}>
            <p className="text-3xl font-black bg-gradient-to-br from-navy-800 to-navy-500 bg-clip-text text-transparent">{num}</p>
            <p className={`mt-1 text-xs font-bold uppercase tracking-wide ${sub}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* charts */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="gov-card p-5">
          <p className="mb-3 text-sm font-extrabold text-navy-900">Language distribution</p>
          <Donut segments={stats.byLang.length ? stats.byLang : [{ label: "No data yet", count: 1 }]} />
        </div>
        <div className="gov-card p-5">
          <p className="mb-4 text-sm font-extrabold text-navy-900">Channel uptake</p>
          <BarsH items={stats.byChannel.length ? stats.byChannel.map((c) => ({ label: c.label.toUpperCase(), count: c.count })) : [{ label: "—", count: 0 }]} color="#ff9933" />
          <p className="mb-4 mt-6 text-sm font-extrabold text-navy-900">Top recommended pathways</p>
          <BarsH items={stats.topPathways.length ? stats.topPathways : [{ label: "—", count: 0 }]} color="#138808" />
        </div>
        <div className="gov-card p-5">
          <p className="mb-4 text-sm font-extrabold text-navy-900">Skill-sector demand (top recommendations)</p>
          <BarsH items={stats.topSectors.length ? stats.topSectors : [{ label: "—", count: 0 }]} />
          <p className="mb-3 mt-6 text-sm font-extrabold text-navy-900">District heat</p>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {stats.districts.slice(0, 12).map((d) => (
              <div
                key={`${d.district}-${d.state}`}
                className="rounded-lg px-2.5 py-2 text-center"
                style={{ background: `rgba(26,42,107,${0.08 + (d.count / maxDistrict) * 0.75})` }}
                title={`${d.district}: ${d.count}`}
              >
                <p className={`truncate text-[11px] font-bold ${d.count / maxDistrict > 0.5 ? "text-white" : "text-navy-900"}`}>{d.district}</p>
                <p className={`text-[10px] ${d.count / maxDistrict > 0.5 ? "text-white/70" : "text-slate-500"}`}>{d.count} profile{d.count > 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* beneficiary table */}
      <div className="gov-card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <p className="text-sm font-extrabold text-navy-900">Beneficiary registry</p>
          <div className="flex items-center gap-2">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter by name / district / channel…"
              className="w-64 rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:border-navy-500"
            />
            {["web", "ivr", "whatsapp"].map((c) => (
              <button
                key={c}
                onClick={() => setFilter((f) => (f === c ? "" : c))}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold uppercase transition ${filter === c ? "bg-navy-900 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div className="nice-scroll overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="bg-paper text-[11px] uppercase tracking-wider text-slate-400">
                <th className="px-5 py-3 font-bold">Beneficiary</th>
                <th className="px-5 py-3 font-bold">District / State</th>
                <th className="px-5 py-3 font-bold">Channel</th>
                <th className="px-5 py-3 font-bold">Language</th>
                <th className="px-5 py-3 font-bold">Source</th>
                <th className="px-5 py-3 font-bold">Profile</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 transition hover:bg-navy-50/40">
                  <td className="px-5 py-3 font-bold text-navy-900">{r.name}</td>
                  <td className="px-5 py-3 text-slate-600">{[r.district, r.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-5 py-3">
                    <span className={`rounded px-2 py-0.5 text-[10px] font-extrabold uppercase ${r.channel === "ivr" ? "bg-saffron-100 text-saffron-600" : r.channel === "whatsapp" ? "bg-greenIndia-100 text-greenIndia-600" : "bg-navy-50 text-navy-800"}`}>
                      {r.channel}
                    </span>
                  </td>
                  <td className="px-5 py-3 uppercase text-slate-600">{r.language}</td>
                  <td className="px-5 py-3 text-xs text-slate-500">{r.isDemo ? "Seed persona" : "Live session"}</td>
                  <td className="px-5 py-3">
                    <Link href={`/recommendations/${r.id}`} className="text-xs font-bold text-navy-700 underline underline-offset-2 hover:text-saffron-600">
                      View pathways →
                    </Link>
                  </td>
                </tr>
              ))}
              {!recent.length && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">No matches — clear the filter or run a conversation first.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* GIA instruments */}
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {GIA_BENEFITS.map((g, i) => (
          <div key={g.id} className={`gov-card rise p-5 rise-${(i % 2) + 1}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-extrabold text-navy-900">{g.title}</p>
              <span className="shrink-0 rounded bg-saffron-100 px-2 py-0.5 text-[10px] font-extrabold text-saffron-600">GIA</span>
            </div>
            <p className="mt-1 text-xs font-bold text-greenIndia-600">{g.amount}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-slate-500">{g.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
