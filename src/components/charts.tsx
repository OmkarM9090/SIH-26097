// Hand-rolled SVG charts — zero dependencies, print- and offline-safe.
"use client";

// ------------------------------------------------------------------ Radar
export function RadarChart({
  data,
  size = 260,
  color = "#1a2a6b",
}: {
  data: { axis: string; axisHi: string; value: number }[];
  size?: number;
  color?: string;
}) {
  const cx = size / 2, cy = size / 2, r = size / 2 - 46;
  const n = data.length;
  const pt = (i: number, val: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rr = (val / 100) * r;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  };
  const labelPt = (i: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [cx + (r + 24) * Math.cos(a), cy + (r + 24) * Math.sin(a)] as const;
  };
  const polygon = data.map((d, i) => pt(i, d.value).join(",")).join(" ");
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]">
      {[25, 50, 75, 100].map((ring) => (
        <polygon
          key={ring}
          points={data.map((_, i) => pt(i, ring).join(",")).join(" ")}
          fill="none" stroke="#e3dfd2" strokeWidth="1"
        />
      ))}
      {data.map((_, i) => {
        const [x, y] = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e3dfd2" />;
      })}
      <polygon points={polygon} fill={color} fillOpacity="0.18" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => {
        const [x, y] = pt(i, d.value);
        return <circle key={d.axis} cx={x} cy={y} r="4" fill={color} stroke="#fff" strokeWidth="1.5" />;
      })}
      {data.map((d, i) => {
        const [x, y] = labelPt(i);
        return (
          <text key={d.axis} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-slate-600" fontSize="10" fontWeight="700">
            {d.axis}
          </text>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------------ Donut
const DONUT_COLORS = ["#1a2a6b", "#ff9933", "#138808", "#7a5a2b", "#9333ea", "#0e7490", "#dc2626"];

export function Donut({ segments, size = 190 }: { segments: { label: string; count: number }[]; size?: number }) {
  const total = Math.max(1, segments.reduce((s, x) => s + x.count, 0));
  const r = size / 2 - 18, c = size / 2, ir = r * 0.58;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="shrink-0">
        {segments.map((s, i) => {
          const a0 = (acc / total) * Math.PI * 2 - Math.PI / 2;
          acc += s.count;
          const a1 = (acc / total) * Math.PI * 2 - Math.PI / 2;
          const large = a1 - a0 > Math.PI ? 1 : 0;
          const p = (a: number, rr: number) => `${c + rr * Math.cos(a)},${c + rr * Math.sin(a)}`;
          const col = DONUT_COLORS[i % DONUT_COLORS.length];
          return (
            <path
              key={s.label}
              d={`M${p(a0, r)} A${r},${r} 0 ${large} 1 ${p(a1, r)} L${p(a1, ir)} A${ir},${ir} 0 ${large} 0 ${p(a0, ir)} Z`}
              fill={col} stroke="#fff" strokeWidth="2"
            />
          );
        })}
        <text x={c} y={c - 6} textAnchor="middle" fontSize="26" fontWeight="800" className="fill-navy-900">{total}</text>
        <text x={c} y={c + 14} textAnchor="middle" fontSize="9" fontWeight="700" className="fill-slate-400">TOTAL</text>
      </svg>
      <ul className="space-y-1.5">
        {segments.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-xs">
            <span className="h-3 w-3 rounded-sm" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <span className="font-semibold text-slate-700">{s.label}</span>
            <span className="font-bold text-navy-900">{s.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------ Bars
export function BarsH({ items, max, color = "#1a2a6b" }: { items: { label: string; count: number }[]; max?: number; color?: string }) {
  const m = max ?? Math.max(1, ...items.map((i) => i.count));
  return (
    <ul className="space-y-2.5">
      {items.map((it) => (
        <li key={it.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-slate-700">{it.label}</span>
            <span className="font-bold text-navy-900">{it.count}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${(it.count / m) * 100}%`, background: `linear-gradient(90deg, ${color}, ${color}cc)` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// -------------------------------------------------------- progress ring
export function Ring({ pct, size = 92, stroke = 9, color = "#138808", track = "#e9e5d8" }: { pct: number; size?: number; stroke?: number; color?: string; track?: string }) {
  const r = (size - stroke) / 2, c = size / 2, circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={track} strokeWidth={stroke} />
      <circle
        cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.min(100, pct) / 100)}
        transform={`rotate(-90 ${c} ${c})`} style={{ transition: "stroke-dashoffset .8s cubic-bezier(.22,1,.36,1)" }}
      />
      <text x={c} y={c} textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.24} fontWeight="800" className="fill-navy-900">
        {Math.round(pct)}%
      </text>
    </svg>
  );
}
