// Page-level shell: wraps every screen in the gov chrome and provides the
// selected language via React context (persisted to localStorage).
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LangCode } from "@/lib/types";
import { useLang, Shell } from "@/components/chrome";

const LangCtx = createContext<[LangCode, (l: LangCode) => void]>(["hi", () => undefined]);

export function useAppLang(): [LangCode, (l: LangCode) => void] {
  return useContext(LangCtx);
}

export function PageShell({ children }: { children: ReactNode }) {
  const [lang, setLang] = useLang();
  return (
    <LangCtx.Provider value={[lang, setLang]}>
      <Shell lang={lang} onLang={setLang}>{children}</Shell>
    </LangCtx.Provider>
  );
}
