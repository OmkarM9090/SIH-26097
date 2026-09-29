// GET /api/opportunities?district=&type=job|self&qp= — curated opportunities.
import { OPPORTUNITIES } from "@/data/opportunities";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const district = url.searchParams.get("district")?.toLowerCase();
  const type = url.searchParams.get("type");
  const qp = url.searchParams.get("qp");

  let list = OPPORTUNITIES;
  if (type === "job" || type === "self") list = list.filter((o) => o.type === type);
  if (qp) list = list.filter((o) => o.qp === qp);
  if (district) {
    const local = list.filter((o) => o.district.toLowerCase() === district);
    const rest = list.filter((o) => o.district.toLowerCase() !== district);
    list = [...local, ...rest];
  }
  return Response.json({ opportunities: list.slice(0, 24), total: list.length });
}
