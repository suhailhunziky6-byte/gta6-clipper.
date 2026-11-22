import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { reels } from "@/db/schema";
import Editor from "@/components/Editor";
import { getVideoMeta } from "@/lib/oembed";
import { extractYouTubeId } from "@/lib/reel";

export const dynamic = "force-dynamic";

function NotFound({ message }: { message: string }) {
  return (
    <main className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <div className="mb-3 text-5xl">🚧</div>
        <p className="mb-5 text-white/70">{message}</p>
        <Link href="/" className="vice-btn rounded-xl px-6 py-3">
          Back to studio
        </Link>
      </div>
    </main>
  );
}

export default async function EditorPage({ searchParams }: { searchParams: Promise<{ v?: string; t?: string; r?: string }> }) {
  const sp = await searchParams;

  if (sp.r) {
    const id = Number(sp.r);
    const [row] = Number.isInteger(id) ? await db.select().from(reels).where(eq(reels.id, id)) : [];
    if (!row) return <NotFound message="That reel doesn't exist anymore." />;
    return (
      <Editor
        key={`r${row.id}`}
        init={{
          youtubeId: row.youtubeId,
          sourceTitle: row.sourceTitle,
          channel: row.channel,
          reel: {
            id: row.id,
            title: row.title,
            startSec: row.startSec,
            endSec: row.endSec,
            settings: row.settings,
            captions: row.captions,
          },
        }}
      />
    );
  }

  const parsed = extractYouTubeId(sp.v ?? "");
  if (!parsed) return <NotFound message="Paste a valid YouTube link to start clipping." />;
  const r = await getVideoMeta(parsed.id);
  if (!r.ok) return <NotFound message={r.error} />;
  const t = Number(sp.t);
  return (
    <Editor
      key={`v${parsed.id}`}
      init={{
        youtubeId: parsed.id,
        sourceTitle: r.meta.title,
        channel: r.meta.channel,
        startAt: Number.isFinite(t) && t > 0 ? t : (parsed.t ?? 0),
      }}
    />
  );
}
