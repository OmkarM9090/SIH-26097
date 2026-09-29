import { ObjectId } from "mongodb";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const { sessionId } = await params;
    let id: ObjectId | string = sessionId;
    try { id = new ObjectId(sessionId); } catch { /* string ids remain valid for imported demo records */ }
    const row = await (await getDb()).collection("conversations").findOne({ _id: id as any });
    if (!row) return Response.json({ error: "conversation not found" }, { status: 404 });
    return Response.json({ ...row, id: row._id.toString(), _id: undefined });
  } catch (error) {
    return Response.json({ error: "conversation lookup failed", detail: String(error) }, { status: 500 });
  }
}
