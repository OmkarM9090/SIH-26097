import ProfileClient from "@/components/profile-client";
import { PageShell } from "@/components/page-shell";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  return (
    <PageShell>
      <ProfileClient id={id} demo={sp.demo === "1"} />
    </PageShell>
  );
}
