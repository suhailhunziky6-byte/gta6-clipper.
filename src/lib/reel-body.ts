import { sanitizeCaptions, sanitizeSettings } from "@/lib/reel";

export async function parseReelBody(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return { error: "Invalid JSON" } as const;
  }
  const youtubeId = typeof body.youtubeId === "string" ? body.youtubeId : "";
  if (!/^[\w-]{11}$/.test(youtubeId)) return { error: "Invalid YouTube id" } as const;
  const startSec = Number(body.startSec);
  const endSec = Number(body.endSec);
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec) || startSec < 0 || endSec - startSec < 0.2) {
    return { error: "Invalid clip range" } as const;
  }
  const title = (typeof body.title === "string" && body.title.trim() ? body.title.trim() : "Untitled reel").slice(0, 120);
  return {
    value: {
      title,
      youtubeId,
      sourceTitle: typeof body.sourceTitle === "string" ? body.sourceTitle.slice(0, 200) : "",
      channel: typeof body.channel === "string" ? body.channel.slice(0, 100) : "",
      startSec,
      endSec,
      settings: sanitizeSettings(body.settings),
      captions: sanitizeCaptions(body.captions),
    },
  } as const;
}
