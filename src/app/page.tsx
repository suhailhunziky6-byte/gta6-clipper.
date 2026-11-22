import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { reels } from "@/db/schema";
import ReelCard from "@/components/ReelCard";
import UrlForm from "@/components/UrlForm";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "🔗", title: "Paste & go", text: "Drop any YouTube link — watch, share, Shorts or timestamped." },
  { icon: "✂", title: "Frame-precise trim", text: "Drag handles, type exact times, zoom the timeline, I/O hotkeys." },
  { icon: "📱", title: "Auto 9:16 reframe", text: "Fill or fit-with-blur layouts, zoom and pan to follow the action." },
  { icon: "🌴", title: "Vice City looks", text: "Neon, noir, cinematic filters, vignette, bars, slow-mo & mute." },
  { icon: "💬", title: "Captions that pop", text: "Timed captions in Impact, Vice, Neon & Clean styles." },
  { icon: "⚡", title: "Render to file", text: "Load local footage and export a ready-to-post vertical video." },
];

export default async function HomePage() {
  const rows = await db.select().from(reels).orderBy(desc(reels.createdAt)).limit(24);

  return (
    <main className="mx-auto max-w-6xl px-5 pb-24">
      <nav className="flex items-center justify-between py-6">
        <div className="font-display text-2xl">
          <span className="vice-text">CLIP</span>VI
        </div>
        <div className="flex gap-2">
          <Link href="/reels" className="chip !px-4 !py-2">
            ▶ Reels feed
          </Link>
        </div>
      </nav>

      <section className="py-10 text-center sm:py-16">
        <div className="mx-auto mb-5 inline-block rounded-full border border-pink-500/40 bg-pink-500/10 px-4 py-1 text-xs tracking-widest text-pink-200">
          GTA VI CLIP STUDIO
        </div>
        <h1 className="font-display text-5xl leading-[0.95] sm:text-7xl">
          Turn <span className="vice-text">GTA 6</span> videos
          <br />
          into viral reels
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-white/60 sm:text-lg">
          Fetch any YouTube video, cut the perfect moment, reframe it vertical, add captions and Vice City filters — in one tab.
        </p>
        <div className="mx-auto mt-9 max-w-3xl text-left">
          <UrlForm />
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="panel p-5">
            <div className="mb-2 text-2xl">{f.icon}</div>
            <div className="font-semibold">{f.title}</div>
            <div className="mt-1 text-sm text-white/50">{f.text}</div>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <div className="mb-5 flex items-end justify-between">
          <h2 className="font-display text-3xl">
            Your <span className="vice-text">reels</span>
          </h2>
          {rows.length > 0 && (
            <Link href="/reels" className="text-sm text-pink-300 hover:underline">
              Watch all as feed →
            </Link>
          )}
        </div>
        {rows.length === 0 ? (
          <div className="panel grid place-items-center px-6 py-14 text-center text-white/50">
            <div className="mb-2 text-4xl">🎬</div>
            No reels yet. Paste a link above and make your first one.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {rows.map((r) => (
              <ReelCard
                key={r.id}
                id={r.id}
                title={r.title}
                youtubeId={r.youtubeId}
                startSec={r.startSec}
                endSec={r.endSec}
                settings={r.settings}
              />
            ))}
          </div>
        )}
      </section>

      <footer className="mt-20 text-center text-xs text-white/30">
        Videos play through YouTube&apos;s official embedded player. Not affiliated with Rockstar Games or Take-Two. Respect creators&apos; rights.
      </footer>
    </main>
  );
}
