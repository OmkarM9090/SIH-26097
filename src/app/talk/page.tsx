import TalkClient from "@/components/talk-client";
import { PageShell } from "@/components/page-shell";
import type { Channel, LangCode } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID: LangCode[] = ["hi", "en", "ta", "te", "mr", "bn"];

export default async function TalkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const channel: Channel = sp.channel === "ivr" ? "ivr" : "web";
  const raw = typeof sp.lang === "string" ? sp.lang : "";
  const lang = VALID.includes(raw as LangCode) ? (raw as LangCode) : undefined;
  const demo = sp.demo === "1";
  return (
    <PageShell>
      <TalkClient channel={channel} langOverride={lang} demo={demo} />
    </PageShell>
  );
}
