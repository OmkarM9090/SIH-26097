import RecoClient from "@/components/reco-client";
import { PageShell } from "@/components/page-shell";

export const dynamic = "force-dynamic";

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <PageShell>
      <RecoClient id={id} />
    </PageShell>
  );
}
