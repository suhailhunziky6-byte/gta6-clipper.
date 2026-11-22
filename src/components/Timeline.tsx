"use client";

import { useRef } from "react";
import { formatTime } from "@/lib/reel";

type Props = {
  duration: number;
  start: number;
  end: number;
  time: number;
  view: [number, number];
  onSeek: (t: number) => void;
  onRange: (start: number, end: number) => void;
};

const MIN_LEN = 0.3;
const STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

export default function Timeline({ duration, start, end, time, view, onSeek, onRange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ mode: "start" | "end" | "move" | "seek"; offset: number } | null>(null);

  const [vs, ve] = view;
  const span = Math.max(0.001, ve - vs);
  const pct = (t: number) => ((t - vs) / span) * 100;

  const toTime = (clientX: number) => {
    const r = trackRef.current!.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    return vs + x * span;
  };

  const down = (mode: "start" | "end" | "move" | "seek") => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget.closest("[data-track]") as HTMLElement).setPointerCapture(e.pointerId);
    const t = toTime(e.clientX);
    drag.current = { mode, offset: mode === "move" ? t - start : 0 };
    if (mode === "seek") onSeek(Math.min(duration, Math.max(0, t)));
  };

  const move = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const t = toTime(e.clientX);
    if (d.mode === "seek") onSeek(Math.min(duration, Math.max(0, t)));
    else if (d.mode === "start") {
      const ns = Math.min(Math.max(0, t), end - MIN_LEN);
      onRange(ns, end);
    } else if (d.mode === "end") {
      const ne = Math.max(Math.min(duration, t), start + MIN_LEN);
      onRange(start, ne);
    } else {
      const len = end - start;
      const ns = Math.min(Math.max(0, t - d.offset), Math.max(0, duration - len));
      onRange(ns, ns + len);
    }
  };

  const up = () => {
    drag.current = null;
  };

  const step = STEPS.find((s) => span / s <= 10) ?? 3600;
  const ticks: number[] = [];
  for (let t = Math.ceil(vs / step) * step; t <= ve; t += step) ticks.push(t);

  const selLeft = Math.max(0, pct(start));
  const selRight = Math.min(100, pct(end));

  return (
    <div className="select-none">
      <div className="relative h-5 text-[10px] text-white/45">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pct(t)}%` }}>
            {formatTime(t)}
          </span>
        ))}
      </div>
      <div
        ref={trackRef}
        data-track
        className="relative h-16 touch-none cursor-pointer overflow-visible rounded-xl border border-white/10 bg-[#0b0914]"
        onPointerDown={down("seek")}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      >
        {/* tick grid */}
        {ticks.map((t) => (
          <div key={t} className="absolute top-0 h-full w-px bg-white/[0.06]" style={{ left: `${pct(t)}%` }} />
        ))}

        {/* dim outside selection */}
        <div className="absolute inset-y-0 left-0 rounded-l-xl bg-black/50" style={{ width: `${Math.max(0, Math.min(100, pct(start)))}%` }} />
        <div
          className="absolute inset-y-0 right-0 rounded-r-xl bg-black/50"
          style={{ width: `${Math.max(0, Math.min(100, 100 - pct(end)))}%` }}
        />

        {/* selection */}
        {selRight > selLeft && (
          <div
            className="absolute inset-y-0 cursor-grab border-y-2 border-pink-500 bg-gradient-to-r from-pink-500/25 to-orange-400/25 active:cursor-grabbing"
            style={{ left: `${selLeft}%`, width: `${selRight - selLeft}%` }}
            onPointerDown={down("move")}
          />
        )}

        {/* handles */}
        {[
          { k: "start" as const, t: start, round: "rounded-l-lg" },
          { k: "end" as const, t: end, round: "rounded-r-lg" },
        ].map(({ k, t, round }) => (
          <div
            key={k}
            className={`absolute inset-y-0 z-10 flex w-3.5 cursor-ew-resize items-center justify-center bg-pink-500 ${round}`}
            style={{ left: `calc(${pct(t)}% - ${k === "start" ? 0 : 14}px)` }}
            onPointerDown={down(k)}
            title={k === "start" ? "Drag to set IN point" : "Drag to set OUT point"}
          >
            <div className="h-6 w-0.5 rounded bg-white/90" />
          </div>
        ))}

        {/* playhead */}
        <div
          className="pointer-events-none absolute -top-1 bottom-[-4px] z-20 w-0.5 bg-white shadow-[0_0_8px_#fff]"
          style={{ left: `${pct(time)}%`, display: time < vs || time > ve ? "none" : "block" }}
        >
          <div className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rotate-45 bg-white" />
        </div>
      </div>
    </div>
  );
}
