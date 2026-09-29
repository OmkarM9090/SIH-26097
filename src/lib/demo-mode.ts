// Demo kill-switch — force the client-side mock engine regardless of backend
// health. Useful when you want a 100% deterministic, zero-network run in front
// of judges (no MongoDB, no OpenAI, no latency surprises).
//
// Enable any of:
//   • URL query          →  /talk?mock=1   /ivr?mock=1
//   • localStorage       →  localStorage.setItem("js_force_mock", "1")
//   • env at build time  →  NEXT_PUBLIC_FORCE_OFFLINE=1
"use client";

export function isForcedMock(): boolean {
  if (process.env.NEXT_PUBLIC_FORCE_OFFLINE === "1") return true;
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("mock") === "1") {
      window.localStorage.setItem("js_force_mock", "1");
      return true;
    }
    return window.localStorage.getItem("js_force_mock") === "1";
  } catch {
    return false;
  }
}

export function setForcedMock(on: boolean): void {
  try {
    if (on) window.localStorage.setItem("js_force_mock", "1");
    else window.localStorage.removeItem("js_force_mock");
  } catch { /* noop */ }
}
