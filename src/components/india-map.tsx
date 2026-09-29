// Offline "map" — stylised India silhouette with geo-projected pins for
// training centres and the beneficiary's location. No tile server needed,
// so the demo works in any room (judges' halls included).
"use client";

import type { TrainingCenter } from "@/lib/types";

// Simplified India boundary (lng, lat) — stylised, not survey-grade.
const OUTLINE: [number, number][] = [
  [74.0, 36.8], [76.0, 35.6], [78.6, 34.2], [79.4, 32.6], [80.2, 30.7],
  [82.0, 30.0], [84.0, 29.2], [85.8, 28.4], [88.0, 27.9], [89.4, 28.1],
  [90.6, 28.0], [92.1, 27.5], [94.6, 29.3], [96.1, 29.4], [97.3, 28.2],
  [96.6, 27.1], [95.2, 26.6], [94.6, 25.2], [94.6, 23.9], [93.3, 23.0],
  [92.3, 23.0], [91.2, 23.6], [91.2, 24.9], [89.8, 25.2], [88.4, 24.4],
  [88.0, 22.9], [88.3, 21.7], [87.0, 21.6], [86.4, 20.2], [85.0, 19.4],
  [83.9, 18.3], [82.3, 17.0], [80.8, 15.9], [80.3, 14.9], [80.0, 13.6],
  [79.9, 12.0], [79.0, 10.4], [78.2, 9.1], [77.5, 8.1], [76.3, 9.6],
  [75.3, 11.4], [74.7, 13.3], [74.4, 14.9], [73.6, 16.4], [73.2, 18.2],
  [72.8, 19.4], [72.7, 21.4], [72.5, 22.0], [71.4, 21.6], [70.6, 20.8],
  [69.7, 22.2], [68.2, 23.3], [68.9, 24.5], [70.1, 25.0], [70.6, 26.0],
  [71.9, 26.6], [72.4, 27.6], [73.8, 29.6], [74.6, 30.7], [75.3, 31.6],
  [74.6, 32.5], [75.2, 33.2], [73.9, 34.4], [74.6, 35.4], [73.7, 36.0],
];

const LNG_MIN = 67.5, LNG_MAX = 98, LAT_MIN = 6, LAT_MAX = 37.5;
const proj = (lng: number, lat: number): [number, number] => [
  ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100,
  ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * 100,
];

export default function IndiaMap({
  centers,
  user,
  highlightDistrict,
}: {
  centers: (TrainingCenter & { distanceKm?: number })[];
  user?: { lat: number; lng: number; label?: string } | null;
  highlightDistrict?: string;
}) {
  const path = OUTLINE.map(([lng, lat], i) => {
    const [x, y] = proj(lng, lat);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ") + " Z";

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-b from-sky-50 to-indigo-50/60">
      <svg viewBox="-4 -2 112 116" className="w-full">
        <path d={path} fill="#eef1fa" stroke="#1a2a6b" strokeOpacity="0.45" strokeWidth="0.35" strokeLinejoin="round" />
        {/* graticule */}
        {Array.from({ length: 6 }).map((_, i) => (
          <line key={`v${i}`} x1={(i + 1) * 14} y1="0" x2={(i + 1) * 14} y2="108" stroke="#1a2a6b" strokeOpacity="0.05" strokeWidth="0.2" />
        ))}

        {/* centre pins */}
        {centers.map((c) => {
          const [x, y] = proj(c.lng, c.lat);
          const near = c.district === highlightDistrict;
          return (
            <g key={c.id}>
              {near && <circle cx={x} cy={y} r="2.6" fill="#ff9933" opacity="0.35"><animate attributeName="r" values="2.6;4.6;2.6" dur="2s" repeatCount="indefinite" /></circle>}
              <circle cx={x} cy={y} r={near ? 1.6 : 1.15} fill={near ? "#ea7d12" : "#1a2a6b"} stroke="#fff" strokeWidth="0.35" />
              {(near || centers.length <= 8) && (
                <text x={x + 2.2} y={y + 0.9} fontSize="2.4" fontWeight="700" fill="#0b1e46">
                  {c.district}
                </text>
              )}
            </g>
          );
        })}

        {/* user home pin */}
        {user && (() => {
          const [x, y] = proj(user.lng, user.lat);
          return (
            <g>
              <circle cx={x} cy={y} r="2.4" fill="#138808" opacity="0.3">
                <animate attributeName="r" values="2.4;4.4;2.4" dur="1.8s" repeatCount="indefinite" />
              </circle>
              <path
                d={`M${x},${y} l-1.1,-1.9 a1.5,1.5 0 1 1 2.2,0 Z`}
                fill="#138808" stroke="#fff" strokeWidth="0.3"
                transform={`translate(0,0)`}
              />
              <text x={x + 2} y={y - 2.6} fontSize="2.6" fontWeight="800" fill="#0e6b06">
                {user.label ?? "You"}
              </text>
            </g>
          );
        })()}
      </svg>

      <div className="absolute bottom-2 left-2 flex flex-wrap items-center gap-3 rounded-lg bg-white/85 px-3 py-1.5 text-[10px] font-semibold text-slate-600 backdrop-blur">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-greenIndia-500" /> Beneficiary location</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-saffron-600" /> Nearest centre</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-navy-700" /> Training centres</span>
      </div>
    </div>
  );
}
