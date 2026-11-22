import { getVideoMeta } from "@/lib/oembed";
import { extractYouTubeId } from "@/lib/reel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") ?? "";
  const parsed = extractYouTubeId(url);
  if (!parsed) {
    return Response.json({ error: "That doesn't look like a valid YouTube link." }, { status: 400 });
  }
  const r = await getVideoMeta(parsed.id);
  if (!r.ok) return Response.json({ error: r.error }, { status: r.status });
  return Response.json({ ...r.meta, t: parsed.t ?? 0 });
}
