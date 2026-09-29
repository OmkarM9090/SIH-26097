// Government logo strip — resilient asset loading.
//
// Each logo tries the local files in `public/assets/` in order
// (`.png` first, then the bundled `.svg` placeholder). If none resolve, a
// clean typographic badge is rendered so the footer never shows a broken
// image during the demo.
"use client";

import { useState } from "react";

export interface LogoSpec {
  /** candidate paths, tried in order */
  src: string[];
  label: string;
  caption?: string;
  href?: string;
}

export const GOV_LOGOS: LogoSpec[] = [
  { src: ["/assets/emblem.png", "/assets/emblem.svg"], label: "भारत सरकार", caption: "Government of India" },
  { src: ["/assets/pmajay-logo.png", "/assets/pmajay-logo.svg"], label: "PM-AJAY", caption: "Grant-in-Aid (GIA)" },
  { src: ["/assets/mosje-logo.png", "/assets/mosje-logo.svg"], label: "MoSJE", caption: "Social Justice & Empowerment" },
  { src: ["/assets/skill-india.png", "/assets/skill-india.svg"], label: "Skill India", caption: "Kaushal Bharat" },
  { src: ["/assets/nsdc-logo.png", "/assets/nsdc-logo.svg"], label: "NSDC", caption: "Skill Development" },
  { src: ["/assets/nsqf-logo.png", "/assets/nsqf-logo.svg"], label: "NSQF", caption: "National Skills Qualifications Framework" },
  { src: ["/assets/digital-india.png", "/assets/digital-india.svg"], label: "Digital India", caption: "Power to Empower" },
];

export function GovLogo({ spec, className = "h-12" }: { spec: LogoSpec; className?: string }) {
  const [idx, setIdx] = useState(0);
  const failed = idx >= spec.src.length;

  if (failed) {
    return (
      <div className={`grid place-items-center rounded-lg border border-slate-200 bg-white px-3 ${className}`}>
        <span className="text-xs font-extrabold uppercase tracking-wide text-navy-900">{spec.label}</span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={spec.src[idx]}
      alt={spec.caption ? `${spec.label} — ${spec.caption}` : spec.label}
      title={spec.label}
      className={`${className} w-auto object-contain`}
      loading="lazy"
      decoding="async"
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
