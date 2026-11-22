"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Meta = { id: string; title: string; channel: string; thumbnail: string; t: number };

const PICKS = [
  { id: "QdBZY2fkU-0", label: "GTA VI Trailer 1" },
  { id: "VQRLujxTm3c", label: "GTA VI Trailer 2" },
];

export default function UrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);

  const open = (m: Meta) => router.push(`/editor?v=${m.id}${m.t ? `&t=${m.t}` : ""}`);

  const fetchVideo = async (value = url) => {
    if (!value.trim()) return;
    setLoading(true);
    setError(null);
    setMeta(null);
    try {
      const res = await fetch(`/api/video?url=${encodeURIComponent(value.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not fetch that video");
      setMeta(data as Meta);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch that video");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void fetchVideo();
        }}
        className="flex flex-col gap-2 rounded-2xl border border-white/10 bg-[#100e1a]/90 p-2 shadow-[0_20px_60px_-20px_rgba(255,45,149,.45)] backdrop-blur sm:flex-row"
      >
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste a YouTube link — youtube.com/watch?v=…, youtu.be/…, shorts…"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base outline-none placeholder:text-white/35"
          autoFocus
        />
        <button type="submit" disabled={loading || !url.trim()} className="vice-btn rounded-xl px-6 py-3 text-base">
          {loading ? "Fetching…" : "Fetch video →"}
        </button>
      </form>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-white/50">
        Try:
        {PICKS.map((p) => (
          <button
            key={p.id}
            className="chip"
            onClick={() => {
              const link = `https://www.youtube.com/watch?v=${p.id}`;
              setUrl(link);
              void fetchVideo(link);
            }}
          >
            ▶ {p.label}
          </button>
        ))}
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>}

      {meta && (
        <div className="mt-4 flex flex-col gap-4 overflow-hidden rounded-2xl border border-pink-500/30 bg-[#100e1a] p-3 sm:flex-row sm:items-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={meta.thumbnail} alt="" className="aspect-video w-full rounded-xl object-cover sm:w-56" />
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 text-lg font-semibold">{meta.title}</div>
            <div className="text-sm text-white/50">{meta.channel}</div>
            {meta.t > 0 && <div className="mt-1 text-xs text-pink-300">Starts at {meta.t}s (from your link)</div>}
          </div>
          <button onClick={() => open(meta)} className="vice-btn rounded-xl px-6 py-3">
            ✂ Start clipping
          </button>
        </div>
      )}
    </div>
  );
}
