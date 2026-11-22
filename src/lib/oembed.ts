import { thumbUrl } from "@/lib/reel";

export type VideoMeta = { id: string; title: string; channel: string; thumbnail: string };

export type MetaResult = { ok: true; meta: VideoMeta } | { ok: false; status: number; error: string };

export async function getVideoMeta(id: string): Promise<MetaResult> {
  const watch = `https://www.youtube.com/watch?v=${id}`;
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (res.status === 404 || res.status === 400) return { ok: false, status: 404, error: "Video not found or private." };
    if (res.status === 401) return { ok: false, status: 403, error: "The owner disabled embedding for this video." };
    if (!res.ok) throw new Error(`oEmbed ${res.status}`);
    const data = (await res.json()) as { title?: string; author_name?: string };
    return {
      ok: true,
      meta: { id, title: data.title ?? "Untitled video", channel: data.author_name ?? "", thumbnail: thumbUrl(id) },
    };
  } catch {
    // metadata lookup failed (e.g. offline) - the player can still work with just the id
    return { ok: true, meta: { id, title: "YouTube video", channel: "", thumbnail: thumbUrl(id) } };
  }
}
