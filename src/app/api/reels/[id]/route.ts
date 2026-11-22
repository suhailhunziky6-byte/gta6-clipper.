import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reels } from "@/db/schema";
import { parseReelBody } from "@/lib/reel-body";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function getId(ctx: Ctx) {
  const { id } = await ctx.params;
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, ctx: Ctx) {
  const id = await getId(ctx);
  if (!id) return Response.json({ error: "Bad id" }, { status: 400 });
  const [row] = await db.select().from(reels).where(eq(reels.id, id));
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}

export async function PUT(req: Request, ctx: Ctx) {
  const id = await getId(ctx);
  if (!id) return Response.json({ error: "Bad id" }, { status: 400 });
  const parsed = await parseReelBody(req);
  if ("error" in parsed) return Response.json({ error: parsed.error }, { status: 400 });
  const [row] = await db
    .update(reels)
    .set({ ...parsed.value, updatedAt: new Date() })
    .where(eq(reels.id, id))
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(row);
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = await getId(ctx);
  if (!id) return Response.json({ error: "Bad id" }, { status: 400 });
  await db.delete(reels).where(eq(reels.id, id));
  return Response.json({ ok: true });
}
