// Landing page — government-portal identity with three channel CTAs,
// differentiators grid, demo entry point and scheme context strip.
"use client";

import Link from "next/link";
import { Chakra } from "@/components/chrome";
import { useAppLang } from "@/components/page-shell";
import { useTranslation } from "react-i18next";
import { LANGS } from "@/data/i18n";
import { NSQF_QPS, SECTORS } from "@/data/nsqf";
import { TRAINING_CENTERS } from "@/data/centers";
import { OPPORTUNITIES } from "@/data/opportunities";

const DIFFERENTIATORS = [
  ["Voice-first", "ज़ERO text input — everything by speech", "M12 3a4 4 0 014 4v5a4 4 0 01-8 0V7a4 4 0 014-4zM5 11a7 7 0 0014 0M12 18v3"],
  ["Multilingual", "6 languages · auto-detected · same-language reply", "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a15 15 0 010 18"],
  ["Empathetic AI", "Field-worker warmth — not a robotic form", "M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 5.5 5.5 5.5 0 0121.5 12C19 16.5 12 21 12 21z"],
  ["Informal skills → NSQF", "Daily work mapped to formal competencies", "M4 19V9l8-5 8 5v10M9 14l2 2 4-4"],
  ["RPL pathway", "80%+ prior skills → shortest certification route", "M5 13l4 4L19 7"],
  ["Constraint-aware", "Distance, mobility, physical limits factored in", "M12 21s-6-5.2-6-10a6 6 0 1112 0c0 4.8-6 10-6 10z"],
  ["GIA integration", "Every pathway linked to PM-AJAY financial support", "M12 2v20M17 7c0-2-2.2-3-5-3s-5 1-5 3 2 3 5 3 5 1 5 3-2.2 3-5 3-5-1-5-3"],
  ["Multi-channel", "Web · IVR feature-phone · WhatsApp voice notes", "M8 3h8a2 2 0 012 2v14a2 2 0 01-2 2H8a2 2 0 01-2-2V5a2 2 0 012-2zM11 18h2"],
  ["Govt ecosystem", "NSQF · SIDH · NCS · UDYAM aligned", "M3 21h18M4 18h16M6 18V9l6-5 6 5v9"],
  ["Low-tech friendly", "Works on ₹1,500 phones, 2G speeds, offline demo", "M2 8.5C7.5 3.5 16.5 3.5 22 8.5M5 12c4-3.4 10-3.4 14 0M8.5 15.5c2-1.7 5-1.7 7 0M12 19h.01"],
];

export default function LandingClient() {
  const [lang, setLang] = useAppLang();
  const { t } = useTranslation();
  const stats = [
    [String(NSQF_QPS.length), "NSQF Qualification Packs"],
    [String(SECTORS.length), "Skill sectors"],
    [String(TRAINING_CENTERS.length) + "+", "Training centres mapped"],
    [String(OPPORTUNITIES.length) + "+", "Curated opportunities"],
    ["6", "Languages (voice)"],
  ];

  return (
    <div>
      {/* ------------------------------------------------------------ hero */}
      <section className="hero-mesh relative overflow-hidden text-white">
        <div className="grid-texture absolute inset-0" />
        <div className="pointer-events-none absolute -right-24 top-1/2 hidden -translate-y-1/2 opacity-[0.08] lg:block">
          <Chakra className="chakra-spin h-[560px] w-[560px]" color="#ffffff" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-12 md:pb-24 md:pt-16">
          <div className="rise inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold tracking-wide text-saffron-400 backdrop-blur">
            <span className="h-2 w-2 animate-pulse rounded-full bg-saffron-400" />
            PM-AJAY · Grant-in-Aid (GIA) · MoSJE · SIH 2026 PS-26097
          </div>

          <h1 className="rise rise-1 mt-6 max-w-3xl text-4xl font-black leading-[1.06] tracking-tight md:text-6xl">
            {t("landing.hero_title", { defaultValue: t("tagline") })}
          </h1>
          <p className="rise rise-2 mt-4 max-w-2xl text-sm leading-relaxed text-white/70 md:text-base">
            {t("landing.hero_subtitle", { defaultValue: t("subtag") })}
          </p>

          {/* language pills */}
          <div className="rise rise-2 mt-6 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-widest text-white/50">{t("accessibility.select_lang", { defaultValue: t("select_lang") })}</span>
            {LANGS.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                  l.code === lang ? "border-saffron-400 bg-saffron-500 text-navy-950" : "border-white/25 bg-white/5 text-white/80 hover:border-white/60"
                }`}
              >
                {l.native}
              </button>
            ))}
          </div>

          {/* channel CTAs */}
          <div className="mt-10 grid gap-4 md:grid-cols-3">
            <Link
              href={`/talk?lang=${lang}`}
              className="rise rise-2 group relative overflow-hidden rounded-2xl bg-saffron-500 p-6 text-navy-950 shadow-2xl shadow-saffron-500/30 transition hover:-translate-y-1 hover:shadow-saffron-500/50"
            >
              <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/20 transition group-hover:scale-125" />
              <svg viewBox="0 0 24 24" className="relative h-9 w-9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
                <path d="M5 11a7 7 0 0014 0M12 18v3" />
              </svg>
              <p className="relative mt-4 text-xl font-extrabold">{t("landing.start_talking", { defaultValue: t("start_voice") })}</p>
              <p className="relative mt-1 text-sm font-semibold text-navy-950/70">
                {lang === "hi" ? "आवाज़ में बात करें — AI साक्षात्कार" : "Speak to the AI — guided voice interview"}
              </p>
              <span className="relative mt-4 inline-block rounded-full bg-navy-950 px-3 py-1 text-[11px] font-bold text-white">
                Primary channel · free
              </span>
            </Link>

            <Link
              href={`/ivr`}
              className="rise rise-3 group rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur transition hover:-translate-y-1 hover:bg-white/15"
            >
              <svg viewBox="0 0 24 24" className="h-9 w-9 text-white" fill="currentColor">
                <path d="M6.6 10.8c1.5 2.9 3.7 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.6.1.3 0 .7-.2 1l-2.3 2.2z" />
              </svg>
              <p className="mt-4 text-xl font-extrabold">{t("landing.call_ivr", { defaultValue: t("ivr_call") })}</p>
              <p className="mt-1 text-sm text-white/60">
                {lang === "hi" ? "फ़ीचर फोन IVR — डायल, बटन दबाएँ, बोलें" : "Feature-phone IVR — dial, press keys, then speak"}
              </p>
              <span className="mt-4 inline-block rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/80">
                1800-102-6060 · toll-free
              </span>
            </Link>

            <Link
              href="/whatsapp"
              className="rise rise-3 group rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur transition hover:-translate-y-1 hover:bg-white/15"
            >
              <svg viewBox="0 0 24 24" className="h-9 w-9 text-green-300" fill="currentColor">
                <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5 13.6c-.2.6-1.2 1.1-1.7 1.2-.5 0-1 .2-3.3-.7-2.8-1.1-4.6-4-4.7-4.2-.1-.2-1.1-1.5-1.1-2.9s.7-2 1-2.3c.2-.3.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c.1.2.1.4 0 .6l-.4.6-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.2.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.4 0 .1 0 .7-.2 1.3z" />
              </svg>
              <p className="mt-4 text-xl font-extrabold">{t("landing.whatsapp", { defaultValue: t("whatsapp") })}</p>
              <p className="mt-1 text-sm text-white/60">
                {lang === "hi" ? "वॉइस नोट भेजें, वॉइस नोट पाएँ" : "Send voice notes, get voice replies"}
              </p>
              <span className="mt-4 inline-block rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/80">
                Voice-note interview
              </span>
            </Link>
          </div>

          {/* demo shortcut */}
          <div className="rise rise-4 mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-saffron-400/30 bg-navy-950/40 p-4 backdrop-blur">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-saffron-500 font-black text-navy-950">▶</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-white">{t("landing.demo_mode", { defaultValue: t("demo_mode") })}</p>
              <p className="text-xs text-white/60">
                Hands-free auto-play: Ramesh Kumar, 28, leather-work family, Varanasi — watch the full pipeline run itself.
              </p>
            </div>
            <Link
              href={`/talk?lang=hi&demo=1`}
              className="rounded-xl bg-white px-5 py-3 text-sm font-extrabold text-navy-950 transition hover:bg-saffron-100"
            >
              {lang === "hi" ? "डेमो चलाएँ →" : "Run auto-demo →"}
            </Link>
          </div>

          {/* stats strip */}
          <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {stats.map(([num, label], i) => (
              <div key={label} className={`rise rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur rise-${Math.min(i + 1, 4)}`}>
                <p className="text-2xl font-black text-saffron-400">{num}</p>
                <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/55">{label}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="tricolor relative h-1.5" />
      </section>

      {/* ------------------------------------------------- differentiators */}
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="mb-10 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-saffron-600">Why it wins the last mile</p>
          <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900 md:text-3xl">
            {lang === "hi" ? "जीविकासेतु क्या अलग करता है" : "What makes JeevikaSetu different"}
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DIFFERENTIATORS.map(([title, desc, d], i) => (
            <div key={title} className={`gov-card rise p-5 rise-${(i % 4) + 1}`}>
              <svg viewBox="0 0 24 24" className="h-7 w-7 text-navy-700" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={d} />
              </svg>
              <p className="mt-3 text-sm font-extrabold text-navy-900">{title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* --------------------------------------------------------- pipeline */}
      <section className="border-y border-slate-200 bg-white py-14">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-bold uppercase tracking-widest text-saffron-600">End-to-end pipeline</p>
            <h2 className="mt-1 text-2xl font-extrabold tracking-tight text-navy-900">
              {lang === "hi" ? "आवाज़ से रोज़गार तक — 4 कदम" : "From voice to vocation — 4 steps"}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            {[
              ["01", lang === "hi" ? "बातचीत" : "Converse", lang === "hi" ? "6 भाषाओं में सहानुभूतिपूर्ण AI इंटरव्यू" : "Empathetic AI interview in 6 languages"],
              ["02", lang === "hi" ? "प्रोफ़ाइल" : "Profile", lang === "hi" ? "हुनर + बाधाएँ → संरचित लाभार्थी प्रोफ़ाइल" : "Skills + constraints → structured profile"],
              ["03", lang === "hi" ? "NSQF मैपिंग" : "NSQF map", lang === "hi" ? "स्किल-गैप, RPL पात्रता, रैंकिंग" : "Skill-gap analysis, RPL detection, ranking"],
              ["04", lang === "hi" ? "रोज़गार" : "Livelihood", lang === "hi" ? "ट्रेनिंग सेंटर, GIA सहायता, अवसर" : "Centres, GIA benefits, opportunities"],
            ].map(([num, h, d], i) => (
              <div key={num} className={`gov-card rise relative p-6 rise-${i + 1}`}>
                <span className="absolute -top-3 left-5 rounded-full bg-navy-900 px-3 py-1 text-[10px] font-black tracking-widest text-white">{num}</span>
                <p className="mt-2 text-lg font-extrabold text-navy-900">{h}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">{d}</p>
                {i < 3 && <span className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-slate-300 md:block">→</span>}
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Link
              href="/admin"
              className="rounded-xl border border-navy-900 px-5 py-2.5 text-sm font-bold text-navy-900 transition hover:bg-navy-50"
            >
              {t("header.dashboard_button", { defaultValue: "Officials Dashboard" })} →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
