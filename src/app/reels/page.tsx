import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { reels } from "@/db/schema";
import ReelViewer from "@/components/ReelViewer";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reels · ClipVI" };

export default async function ReelsPage() {
  const rows = await db.select().from(reels).orderBy(desc(reels.createdAt)).limit(50);
  if (rows.length === 0) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <div className="mb-3 text-5xl">🎬</div>
          <p className="mb-5 text-white/70">No reels yet — make your first one.</p>
          <Link href="/" className="vice-btn rounded-xl px-6 py-3">
            Start clipping
          </Link>
        </div>
      </main>
    );
  }
  return <ReelViewer reels={rows} />;
}
