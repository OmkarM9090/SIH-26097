import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ClientI18nProvider } from "@/components/i18n-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "JeevikaSetu — AI Voice Assistant for Livelihood Mapping | PM-AJAY (GIA)",
  description:
    "AI-driven, multilingual voice assistant that maps informal skills of SC community members to NSQF-aligned skilling pathways under PM-AJAY GIA. SIH 2026 PS 26097 prototype.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1e46",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Multilingual Noto family (non-blocking; system fonts as fallback) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;600;700;800;900&family=Noto+Sans+Devanagari:wght@400;600;700;800&family=Noto+Sans+Tamil:wght@400;600;700&family=Noto+Sans+Telugu:wght@400;600;700&family=Noto+Sans+Bengali:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        {/* Accessibility bootstrap: restore large-text / high-contrast modes */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var a=JSON.parse(localStorage.getItem('js_a11y')||'{}');if(a.large)document.documentElement.dataset.large='true';if(a.contrast)document.documentElement.dataset.contrast='true';}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">
        <ClientI18nProvider>{children}</ClientI18nProvider>
      </body>
    </html>
  );
}
