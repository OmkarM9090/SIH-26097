// GET /api/nsqf?sector=&level= — browse the NSQF Qualification Pack library.
import { NSQF_QPS, SECTORS } from "@/data/nsqf";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sector = url.searchParams.get("sector");
  const level = url.searchParams.get("level");
  let qps = NSQF_QPS;
  if (sector) qps = qps.filter((q) => q.sector === sector);
  if (level) qps = qps.filter((q) => q.level === Number(level));
  return Response.json({ qps, sectors: SECTORS, total: qps.length });
}
