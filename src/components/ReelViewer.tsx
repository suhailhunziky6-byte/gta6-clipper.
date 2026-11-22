"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import Stage, { type PlayerHandle } from "@/components/Stage";
import { buildFilter, thumbUrl, type Caption, type Settings } from "@/lib/reel";

export type ViewerReel = {
  id: number;
  title: string;
  youtubeId: string;
  sourceTitle: string;
  channel: string;
  startSec: number;
  endSec: number;
  settings: Settings;
  captions: Caption[];
};

function ReelItem({
  reel,
  active,
  soundOn,
  onToggleSound,
}: {
  reel: ViewerReel;
  active: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
}) {
  const handle = useRef<PlayerHandle>(null);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const len = reel.endSec - reel.startSec;

  const onTime = useCallback(
    (t: number) => setProgress(Math.min(1, Math.max(0, (t - reel.startSec) / len))),
    [reel.startSec, len],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-black sm:rounded-3xl">
      {active ? (
        <Stage
          ref={handle}
          source={{ type: "youtube", id: reel.youtubeId }}
          settings={reel.settings}
          captions={reel.captions}
          start={reel.startSec}
          end={reel.endSec}
          autoplay
          loop
          forceMuted={!soundOn}
          onTime={onTime}
          onPlayState={(p) => setPaused(!p)}
          onError={setErr}
          onClick={() => {
            const h = handle.current;
            if (!h) return;
            if (h.isPlaying()) h.pause();
            else h.play();
          }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl(reel.youtubeId)}
          alt={reel.title}
          className="h-full w-full object-cover"
          style={{ filter: buildFilter(reel.settings) }}
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-4 pb-6 pt-24">
        <div className="max-w-[78%]">
          <div className="text-base font-bold leading-tight drop-shadow">{reel.title}</div>
          <div className="mt-1 line-clamp-1 text-xs text-white/70">
            {reel.sourceTitle}
            {reel.channel && ` · ${reel.channel}`}
          </div>
          <div className="mt-1 text-[11px] text-pink-300">#GTA6 #ViceCity</div>
        </div>
      </div>

      {/* side actions */}
      <div className="absolute bottom-24 right-3 flex flex-col items-center gap-3">
        <button onClick={onToggleSound} className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-lg backdrop-blur hover:bg-black/75" aria-label="Sound">
          {soundOn ? "🔊" : "🔇"}
        </button>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(`${window.location.origin}/reel/${reel.id}`);
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            } catch {
              /* ignore */
            }
          }}
          className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-lg backdrop-blur hover:bg-black/75"
          aria-label="Copy link"
        >
          {copied ? "✓" : "🔗"}
        </button>
        <Link href={`/editor?r=${reel.id}`} className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-lg backdrop-blur hover:bg-black/75" aria-label="Edit">
          ✎
        </Link>
      </div>

      {active && paused && !err && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-black/55 text-2xl backdrop-blur">▶</div>
        </div>
      )}
      {!soundOn && active && !err && (
        <button
          onClick={onToggleSound}
          className="absolute left-1/2 top-16 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs backdrop-blur hover:bg-black/80"
        >
          🔇 Tap to unmute
        </button>
      )}
      {err && (
        <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 rounded-xl bg-black/80 p-4 text-center text-sm text-red-200">{err}</div>
      )}

      <div className="absolute inset-x-0 bottom-0 h-1 bg-white/20">
        <div className="h-full bg-gradient-to-r from-pink-500 to-orange-400" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}

export default function ReelViewer({ reels }: { reels: ViewerReel[] }) {
  const [active, setActive] = useState(0);
  const [soundOn, setSoundOn] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio > 0.6) {
            setActive(Number((e.target as HTMLElement).dataset.idx));
          }
        }
      },
      { root: root.current, threshold: [0.6] },
    );
    itemRefs.current.forEach((el) => el && obs.observe(el));
    return () => obs.disconnect();
  }, [reels.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        root.current?.scrollBy({ top: (e.key === "ArrowDown" ? 1 : -1) * window.innerHeight, behavior: "smooth" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="fixed inset-0 bg-[#05040a]">
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-3">
        <Link href="/" className="pointer-events-auto rounded-full bg-black/55 px-4 py-2 text-sm backdrop-blur hover:bg-black/75">
          ← Studio
        </Link>
        <div className="font-display text-lg drop-shadow">
          <span className="vice-text">REELS</span>
        </div>
        <Link href="/" className="pointer-events-auto rounded-full bg-black/55 px-4 py-2 text-sm backdrop-blur hover:bg-black/75">
          + New clip
        </Link>
      </div>

      <div ref={root} className="snap-feed h-full overflow-y-scroll">
        {reels.map((r, i) => (
          <div
            key={r.id}
            data-idx={i}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="flex h-dvh snap-start snap-always items-center justify-center"
          >
            <div style={{ width: "min(100vw, calc(100dvh * 9 / 16))", height: "min(100dvh, calc(100vw * 16 / 9))" }}>
              <ReelItem reel={r} active={active === i} soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
