import { desc } from "drizzle-orm";
import { db } from "@/db";
import { reels } from "@/db/schema";
import { parseReelBody } from "@/lib/reel-body";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await db.select().from(reels).orderBy(desc(reels.createdAt)).limit(100);
  return Response.json(rows);
}

export async function POST(req: Request) {
  const parsed = await parseReelBody(req);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const [row] = await db.insert(reels).values(parsed.value).returning();
  return Response.json(row, { status: 201 });
}
