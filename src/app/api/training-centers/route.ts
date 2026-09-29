// GET /api/training-centers?district=&qp=&sector= — curated PMKK-style centres.
import { QP_MAP } from "@/data/nsqf";
import { getDb } from "@/db";
import { TrainingCenter } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const district = url.searchParams.get("district")?.toLowerCase();
  const qp = url.searchParams.get("qp");
  const sector = url.searchParams.get("sector");
  const latStr = url.searchParams.get("lat");
  const lngStr = url.searchParams.get("lng");
  const mobilityKmStr = url.searchParams.get("mobilityKm");

  const db = await getDb();
  let centers = await db.collection("training_centers").find({}).toArray() as unknown as TrainingCenter[];

  if (qp) centers = centers.filter((c) => c.qps.includes(qp));
  if (sector) {
    const codes = new Set([...QP_MAP.values()].filter((q) => q.sector === sector).map((q) => q.code));
    centers = centers.filter((c) => c.qps.some((code) => codes.has(code)));
  }

  // Haversine formula
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const p = 0.017453292519943295;    // Math.PI / 180
    const c = Math.cos;
    const a = 0.5 - c((lat2 - lat1) * p)/2 + 
            c(lat1 * p) * c(lat2 * p) * 
            (1 - c((lon2 - lon1) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a)); // 2 * R; R = 6371 km
  };

  if (latStr && lngStr && mobilityKmStr) {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    const mobilityKm = parseFloat(mobilityKmStr);
    if (!isNaN(lat) && !isNaN(lng) && !isNaN(mobilityKm)) {
      centers = centers.filter((c) => {
        const d = getDistance(lat, lng, c.lat, c.lng);
        return d <= mobilityKm;
      });
    }
  }

  const sameDistrict = district ? centers.filter((c) => c.district.toLowerCase() === district) : [];
  return Response.json({
    centers,
    sameDistrict,
    facets: { qpsOffered: [...new Set(centers.flatMap((c) => c.qps))] },
  });
}
