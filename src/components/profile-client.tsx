// Beneficiary Profile Dashboard (Module 3 output display) — clean card layout,
// skill radar, inline correction, and "Generate Recommendations" CTA.
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { BeneficiaryProfile, LangCode } from "@/lib/types";
import { profileRadar } from "@/lib/match";
import { RadarChart } from "@/components/charts";
import { useAppLang } from "@/components/page-shell";
import { t } from "@/data/i18n";

interface ApiResponse {
  beneficiary: { id: string; profile: BeneficiaryProfile; language: LangCode; channel: string; createdAt: string };
}

const EDU_OPTS = ["No formal schooling", "5th pass", "8th pass", "10th pass", "12th pass", "ITI / Diploma", "Graduate"];

export default function ProfileClient({ id, demo }: { id: string; demo: boolean }) {
  const router = useRouter();
  const [lang] = useAppLang();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [profile, setProfile] = useState<BeneficiaryProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/beneficiaries/${id}`);
        const j = (await res.json()) as ApiResponse & { error?: string };
        if (j.error) throw new Error(j.error);
        setData(j);
        setProfile(j.beneficiary.profile);
      } catch (e) {
        setLoadErr(String(e));
      }
    })();
  }, [id]);

  const saveEdits = useCallback(async () => {
    if (!profile) return;
    setBusy(true);
    try {
      await fetch(`/api/beneficiaries/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      setEditing(false);
    } finally {
      setBusy(false);
    }
  }, [id, profile]);

  const generate = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ beneficiaryId: id }),
      });
      router.push(`/recommendations/${id}${demo ? "?demo=1" : ""}`);
    } finally {
      setBusy(false);
    }
  }, [id, router, demo]);

  // demo auto-advance → recommendations
  useEffect(() => {
    if (!demo || !profile || busy) return;
    const tmr = setTimeout(() => void generate(), 2200);
    return () => clearTimeout(tmr);
  }, [demo, profile, busy, generate]);

  if (loadErr)
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-sm font-semibold text-red-600">Profile not found ({loadErr})</p>
      </div>
    );

  if (!profile)
    return (
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-10">
        {[1, 2, 3].map((i) => <div key={i} className="shimmer h-28 rounded-2xl" />)}
      </div>
    );

  const radar = profileRadar(profile);
  const loc = [profile.location.village, profile.location.district, profile.location.state].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="rise mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-saffron-600">AI Extraction Complete</p>
          <h1 className="text-2xl font-extrabold tracking-tight text-navy-900 md:text-3xl">{t("profile_title", lang)}</h1>
          <p className="mt-1 text-sm text-slate-500">
            Structured from the voice interview — every field can be corrected before mapping.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => (editing ? void saveEdits() : setEditing(true))}
            disabled={busy}
            className="rounded-xl border border-navy-900 px-4 py-2.5 text-sm font-bold text-navy-900 transition hover:bg-navy-50"
          >
            {editing ? "Save changes" : "Correct details"}
          </button>
          <button
            onClick={() => void generate()}
            disabled={busy}
            className="rounded-xl bg-saffron-500 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-saffron-500/30 transition hover:bg-saffron-600 disabled:opacity-60"
          >
            {busy ? "…" : `${t("generate_reco", lang)} →`}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {/* ------------------------------------------------ left: profile card */}
        <div className="gov-card rise rise-1 overflow-hidden">
          <div className="flex flex-wrap items-center gap-4 bg-gradient-to-r from-navy-900 to-navy-700 px-6 py-5 text-white">
            <div className="grid h-16 w-16 place-items-center rounded-2xl bg-white/10 text-2xl font-extrabold">
              {editing ? "✎" : profile.name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <input
                  value={profile.name}
                  onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  className="w-full max-w-xs rounded-lg bg-white/10 px-3 py-1.5 text-xl font-extrabold text-white outline-none ring-saffron-400 placeholder:text-white/40 focus:ring-2"
                />
              ) : (
                <h2 className="truncate text-xl font-extrabold md:text-2xl">{profile.name}</h2>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-saffron-500 px-2.5 py-0.5 font-bold">{profile.category} • PM-AJAY eligible</span>
                {profile.age && <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-semibold">{profile.age} yrs</span>}
                {profile.gender && <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-semibold capitalize">{profile.gender}</span>}
                <span className="rounded-full bg-white/15 px-2.5 py-0.5 font-semibold">via {data?.beneficiary.channel ?? "web"}</span>
              </div>
            </div>
            <div className="text-right text-xs text-white/70">
              <p className="font-bold uppercase tracking-wider">Profile ID</p>
              <p className="font-mono">{id.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>

          <div className="grid gap-x-6 gap-y-4 px-6 py-5 sm:grid-cols-2">
            <Field label="Location" labelHi="स्थान" editing={editing}>
              {editing ? (
                <input
                  value={profile.location.district ?? ""}
                  onChange={(e) => setProfile({ ...profile, location: { ...profile.location, district: e.target.value } })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-navy-500"
                />
              ) : (loc || "—")}
            </Field>
            <Field label="Education" labelHi="शिक्षा" editing={editing}>
              {editing ? (
                <select
                  value={profile.education}
                  onChange={(e) => {
                    const rank = Math.max(0, EDU_OPTS.indexOf(e.target.value));
                    setProfile({ ...profile, education: e.target.value, educationRank: rank });
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-navy-500"
                >
                  {EDU_OPTS.map((o) => <option key={o}>{o}</option>)}
                </select>
              ) : (profile.education)}
            </Field>
            <Field label="Family / traditional occupation" labelHi="पारिवारिक काम">
              {profile.family_occupation}
            </Field>
            <Field label="Current livelihood" labelHi="वर्तमान आजीविका">
              {profile.current_livelihood}
            </Field>
            <Field label="Employment preference" labelHi="रोज़गार पसंद" editing={editing}>
              {editing ? (
                <select
                  value={profile.employment_preference}
                  onChange={(e) => setProfile({ ...profile, employment_preference: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-navy-500"
                >
                  <option value="self-employment">self-employment</option>
                  <option value="wage-employment">wage-employment</option>
                  <option value="either">either</option>
                </select>
              ) : (
                <span className="capitalize">{profile.employment_preference}</span>
              )}
            </Field>
            <Field label="Mobility" labelHi="यात्रा सीमा" editing={editing}>
              {editing ? (
                <input
                  type="number"
                  value={profile.mobility_km}
                  onChange={(e) => setProfile({ ...profile, mobility_km: Number(e.target.value) })}
                  className="w-24 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:border-navy-500"
                />
              ) : (
                <span className="capitalize">{profile.mobility}</span>
              )}
            </Field>
            <Field label="Physical constraints" labelHi="बाधाएँ">
              {profile.physical_constraints}
            </Field>
            <Field label="Languages" labelHi="भाषाएँ">
              {profile.language_spoken.join(", ")}
            </Field>
          </div>

          <div className="border-t border-slate-100 px-6 py-5">
            <p className="mb-3 text-xs font-extrabold uppercase tracking-wider text-navy-900">
              Identified skills (AI-mapped from informal work)
            </p>
            <div className="flex flex-wrap gap-2">
              {profile.skill_labels.length ? (
                profile.skill_labels.map((s) => (
                  <span key={s.id} className="rounded-full border border-greenIndia-500/40 bg-greenIndia-50 px-3 py-1.5 text-xs font-bold text-greenIndia-600">
                    {lang === "hi" ? s.hi : s.en}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-400">No explicit skills detected — recommendations use interests.</span>
              )}
            </div>
            <p className="mb-2 mt-5 text-xs font-extrabold uppercase tracking-wider text-navy-900">Interests & aspirations</p>
            <div className="flex flex-wrap gap-2">
              {profile.interest_labels.map((x) => (
                <span key={x} className="rounded-full border border-saffron-500/40 bg-saffron-50 px-3 py-1.5 text-xs font-bold text-saffron-600">
                  {x}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ------------------------------------------------ right: radar + note */}
        <div className="space-y-4">
          <div className="gov-card rise rise-2 p-5">
            <p className="mb-1 text-xs font-extrabold uppercase tracking-wider text-navy-900">Skill footprint</p>
            <p className="mb-2 text-[11px] text-slate-400">Derived from skills, family trade & interests</p>
            <RadarChart data={radar} />
          </div>
          <div className="gov-card rise rise-3 border-l-4 border-l-saffron-500 p-5">
            <p className="text-xs font-extrabold uppercase tracking-wider text-navy-900">How we got here</p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              The voice agent converted a natural conversation into this structured profile —
              no forms, no typing. Traditional and informal skills (family trade, daily work)
              were mapped to formal NSQF competency tags for matching.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
              <span className="rounded bg-navy-50 px-2 py-0.5">Whisper STT</span>
              <span className="rounded bg-navy-50 px-2 py-0.5">GPT-4o dialogue</span>
              <span className="rounded bg-navy-50 px-2 py-0.5">Skill extraction</span>
              <span className="rounded bg-navy-50 px-2 py-0.5">NSQF tagging</span>
            </div>
          </div>
          <button
            onClick={() => void generate()}
            disabled={busy}
            className="gov-card rise rise-4 flex w-full items-center justify-center gap-2 bg-gradient-to-r from-greenIndia-500 to-greenIndia-600 px-6 py-5 text-base font-extrabold text-white transition hover:brightness-105 disabled:opacity-60"
          >
            {busy ? "Computing NSQF matches…" : `${lang === "hi" ? "NSQF सिफारिशें देखें" : "View NSQF Recommendations"} →`}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, labelHi, children, editing,
}: {
  label: string; labelHi: string; children: React.ReactNode; editing?: boolean;
}) {
  void editing;
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
        {label} <span className="text-slate-300">/ {labelHi}</span>
      </p>
      <div className="mt-1 text-sm font-semibold text-navy-900">{children}</div>
    </div>
  );
}
