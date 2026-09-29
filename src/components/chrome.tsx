// Government-portal chrome: emblem, header with language selector +
// accessibility toggles, tricolor accents, partner footer.
"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { LANGS } from "@/data/i18n";
import { GovLogo, GOV_LOGOS } from "@/components/gov-logos";
import type { LangCode } from "@/lib/types";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------- language
export function useLang(): [LangCode, (l: LangCode) => void] {
  const [lang, setLangState] = useState<LangCode>("hi");
  const { i18n } = useTranslation();
  useEffect(() => {
    const saved = window.localStorage.getItem("js_lang") as LangCode | null;
    if (saved && LANGS.some((l) => l.code === saved)) {
      setLangState(saved);
      i18n.changeLanguage(saved);
    }
    const onCustom = (e: Event) => {
      const code = (e as CustomEvent<LangCode>).detail;
      if (code) {
        setLangState(code);
        i18n.changeLanguage(code);
      }
    };
    window.addEventListener("js-lang", onCustom);
    return () => window.removeEventListener("js-lang", onCustom);
  }, [i18n]);
  const setLang = (l: LangCode) => {
    window.localStorage.setItem("js_lang", l);
    i18n.changeLanguage(l);
    window.dispatchEvent(new CustomEvent("js-lang", { detail: l }));
    setLangState(l);
  };
  return [lang, setLang];
}

export function useA11y(): [{ large: boolean; contrast: boolean }, (k: "large" | "contrast") => void] {
  const [state, setState] = useState({ large: false, contrast: false });
  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem("js_a11y") ?? "{}") as { large?: boolean; contrast?: boolean };
      setState({ large: Boolean(saved.large), contrast: Boolean(saved.contrast) });
    } catch { /* noop */ }
  }, []);
  const toggle = (k: "large" | "contrast") => {
    setState((prev) => {
      const next = { ...prev, [k]: !prev[k] };
      window.localStorage.setItem("js_a11y", JSON.stringify(next));
      const el = document.documentElement;
      if (next.large) el.dataset.large = "true"; else delete el.dataset.large;
      if (next.contrast) el.dataset.contrast = "true"; else delete el.dataset.contrast;
      return next;
    });
  };
  return [state, toggle];
}

// ---------------------------------------------------------------- emblem
export function Chakra({ className = "h-10 w-10", color = "#0b1e46" }: { className?: string; color?: string }) {
  const spokes = Array.from({ length: 24 });
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true">
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="4" />
      <circle cx="50" cy="50" r="7" fill={color} />
      {spokes.map((_, i) => {
        const a = (i * 15 * Math.PI) / 180;
        return (
          <line
            key={i}
            x1={50 + 8 * Math.cos(a)} y1={50 + 8 * Math.sin(a)}
            x2={50 + 44 * Math.cos(a)} y2={50 + 44 * Math.sin(a)}
            stroke={color} strokeWidth="2.4" strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

export function EmblemMark({ className = "h-12 w-12" }: { className?: string }) {
  // Stylised national-emblem-inspired mark (prototype stand-in)
  return (
    <div className={`relative ${className}`}>
      <svg viewBox="0 0 64 64" className="h-full w-full drop-shadow-sm">
        <rect x="26" y="50" width="12" height="8" rx="1.5" fill="#7a5a2b" />
        <rect x="20" y="44" width="24" height="6" rx="2" fill="#977339" />
        <circle cx="32" cy="34" r="9" fill="#b9903f" />
        <circle cx="22" cy="30" r="5.5" fill="#caa14e" />
        <circle cx="42" cy="30" r="5.5" fill="#caa14e" />
        <circle cx="32" cy="22" r="6" fill="#d8b15e" />
        <circle cx="32" cy="34" r="2.6" fill="#7a5a2b" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------- header
export function GovHeader({ lang, onLang }: { lang: LangCode; onLang: (l: LangCode) => void }) {
  const [a11y, toggleA11y] = useA11y();
  const [showLangs, setShowLangs] = useState(false);
  const current = LANGS.find((l) => l.code === lang);

  const { t } = useTranslation();
  return (
    <header className="sticky top-0 z-40">
      <div className="bg-navy-950/95 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-1.5 text-[11px] tracking-wide">
          <span className="truncate text-white/80">{t("header.subtitle", { defaultValue: "PM-AJAY • Pradhan Mantri Anusuchit Jaati Abhyuday Yojana" })}</span>
          <span className="hidden shrink-0 text-saffron-400 md:block">SIH 2026 Prototype • PS 26097</span>
        </div>
        <div className="tricolor h-[3px]" />
      </div>

      <div className="border-b border-navy-900/10 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <GovLogo
            spec={GOV_LOGOS[0]}
            className="hidden h-11 shrink-0 sm:block"
          />
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-navy-900 text-white">
              <Chakra className="h-8 w-8" color="#ffffff" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-saffron-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-lg font-extrabold tracking-tight text-navy-900">JeevikaSetu</span>
                <span className="hidden text-sm font-bold text-navy-700 sm:inline">जीविकासेतु</span>
              </div>
              <p className="truncate text-[11px] font-medium text-slate-500">{t("header.subtitle", { defaultValue: "PM-AJAY • Pradhan Mantri Anusuchit Jaati Abhyuday Yojana" })}</p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => toggleA11y("large")}
              title={t("accessibility.large_text", { defaultValue: "Large Text" })}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${a11y.large ? "border-navy-900 bg-navy-900 text-white" : "border-slate-300 text-slate-600 hover:border-navy-500"}`}
            >
              A+
            </button>
            <button
              onClick={() => toggleA11y("contrast")}
              title={t("accessibility.high_contrast", { defaultValue: "High Contrast" })}
              className={`rounded-lg border px-2.5 py-1.5 text-xs font-bold transition ${a11y.contrast ? "border-black bg-black text-white" : "border-slate-300 text-slate-600 hover:border-navy-500"}`}
            >
              ◐
            </button>
            <div className="relative">
              <button
                onClick={() => setShowLangs((v) => !v)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-bold text-navy-900 transition hover:border-navy-500"
                title={t("accessibility.select_lang", { defaultValue: "Select Language" })}
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20" />
                </svg>
                {current?.native ?? "हिन्दी"}
              </button>
              {showLangs && (
                <div className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                  {LANGS.map((l) => (
                    <button
                      key={l.code}
                      onClick={() => { onLang(l.code); setShowLangs(false); }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-navy-50 ${l.code === lang ? "bg-navy-50 font-bold text-navy-900" : "text-slate-700"}`}
                    >
                      <span>{l.native}</span>
                      <span className="text-[10px] uppercase text-slate-400">{l.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Link
              href="/admin"
              className="hidden rounded-lg bg-navy-900 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-navy-700 sm:block"
            >
              {t("header.dashboard_button", { defaultValue: "Officials Dashboard" })}
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- footer
export function GovFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t-4 border-saffron-500 bg-white">
      {/* logo strip */}
      <div className="border-b border-slate-200 bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-7">
          <p className="mb-5 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
            An initiative under PM-AJAY · Ministry of Social Justice &amp; Empowerment
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 md:gap-x-12">
            {GOV_LOGOS.map((spec) => (
              <div key={spec.label} className="flex flex-col items-center gap-1.5">
                <GovLogo spec={spec} className="h-11 md:h-12" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{spec.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* link columns */}
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <Chakra className="h-7 w-7" color="#003366" />
            <div>
              <p className="text-sm font-extrabold text-navy-900">JeevikaSetu</p>
              <p className="text-[11px] font-semibold text-slate-500">जीविकासेतु</p>
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            AI voice assistant mapping informal skills of SC communities to NSQF-aligned
            skilling pathways.
          </p>
        </div>
        {[
          ["Channels", [["Web voice agent", "/talk"], ["Feature phone (IVR)", "/ivr"], ["WhatsApp", "/whatsapp"]]],
          ["For officials", [["Dashboard", "/admin"], ["Scheme: PM-AJAY GIA", "/"], ["NSQF pathways", "/"]]],
          ["About", [["SIH 2026 · PS 26097", "/"], ["Accessibility", "/"], ["Help & support", "/"]]],
        ].map(([title, links]) => (
          <div key={String(title)}>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-navy-900">{String(title)}</p>
            <ul className="space-y-1.5">
              {(links as [string, string][]).map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-[12px] font-medium text-slate-600 transition hover:text-saffron-600">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* tricolor rule + copyright */}
      <div className="tricolor h-[3px]" />
      <div className="bg-navy-900 px-4 py-4 text-center text-[11px] leading-relaxed text-white/70">
        <p>
          © {year} JeevikaSetu · Working prototype for Smart India Hackathon 2026 ·
          Problem Statement 26097 · Ministry of Social Justice &amp; Empowerment.
        </p>
        <p className="mt-1 text-white/45">
          Demonstration build with curated sample data. Logos shown are placeholders pending
          official artwork and are not an endorsement.
        </p>
      </div>
    </footer>
  );
}

export function Shell({ children, lang, onLang }: { children: ReactNode; lang: LangCode; onLang: (l: LangCode) => void }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <GovHeader lang={lang} onLang={onLang} />
      <main className="flex-1">{children}</main>
      <GovFooter />
    </div>
  );
}
