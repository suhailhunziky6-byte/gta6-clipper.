"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildFilter, formatTime, thumbUrl, type Settings } from "@/lib/reel";

export default function ReelCard({
  id,
  title,
  youtubeId,
  startSec,
  endSec,
  settings,
}: {
  id: number;
  title: string;
  youtubeId: string;
  startSec: number;
  endSec: number;
  settings: Settings;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!confirm(`Delete "${title}"?`)) return;
    setBusy(true);
    await fetch(`/api/reels/${id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className={`group panel overflow-hidden transition hover:border-pink-500/40 ${busy ? "opacity-40" : ""}`}>
      <Link href={`/reel/${id}`} className="relative block aspect-[9/14] overflow-hidden bg-black">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={thumbUrl(youtubeId)}
          alt={title}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          style={{ filter: buildFilter(settings) }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />
        <div className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-0.5 text-xs tabular-nums">
          {formatTime((endSec - startSec) / settings.speed, 0)}
        </div>
        <div className="absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 opacity-0 backdrop-blur transition group-hover:opacity-100">
          ▶
        </div>
        <div className="absolute inset-x-0 bottom-0 p-3 text-sm font-semibold leading-tight">{title}</div>
      </Link>
      <div className="flex gap-2 p-2.5">
        <Link href={`/editor?r=${id}`} className="chip flex-1 text-center">
          ✎ Edit
        </Link>
        <button onClick={remove} disabled={busy} className="chip text-red-300">
          Delete
        </button>
      </div>
    </div>
  );
}
