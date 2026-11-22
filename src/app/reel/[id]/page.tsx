import Link from "next/link";
import { desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { reels } from "@/db/schema";
import ReelViewer from "@/components/ReelViewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return { title: "Reel · ClipVI" };
  const [row] = await db.select({ title: reels.title }).from(reels).where(eq(reels.id, n));
  return { title: row ? `${row.title} · ClipVI` : "Reel · ClipVI" };
}

export default async function ReelPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  const [row] = Number.isInteger(n) ? await db.select().from(reels).where(eq(reels.id, n)) : [];
  if (!row) {
    return (
      <main className="grid min-h-screen place-items-center px-6 text-center">
        <div>
          <div className="mb-3 text-5xl">🚧</div>
          <p className="mb-5 text-white/70">This reel doesn&apos;t exist.</p>
          <Link href="/" className="vice-btn rounded-xl px-6 py-3">
            Back to studio
          </Link>
        </div>
      </main>
    );
  }
  const others = await db.select().from(reels).where(ne(reels.id, n)).orderBy(desc(reels.createdAt)).limit(20);
  return <ReelViewer reels={[row, ...others]} />;
}
