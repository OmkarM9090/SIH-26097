import AdminClient from "@/components/admin-client";
import { PageShell } from "@/components/page-shell";

export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <PageShell>
      <AdminClient />
    </PageShell>
  );
}
