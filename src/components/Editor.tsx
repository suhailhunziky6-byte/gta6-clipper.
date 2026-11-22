"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Stage, { type PlayerHandle, type Source } from "@/components/Stage";
import Timeline from "@/components/Timeline";
import { exportReel, exportSupported } from "@/lib/exporter";
import {
  CAPTION_STYLES,
  DEFAULT_SETTINGS,
  FILTERS,
  HASHTAGS,
  formatTime,
  parseTime,
  type Caption,
  type Settings,
} from "@/lib/reel";

export type EditorInit = {
  youtubeId: string;
  sourceTitle: string;
  channel: string;
  startAt?: number;
  reel?: {
    id: number;
    title: string;
    startSec: number;
    endSec: number;
    settings: Settings;
    captions: Caption[];
  };
};

type Tab = "frame" | "look" | "text" | "speed" | "export";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "frame", label: "Frame", icon: "▣" },
  { key: "look", label: "Look", icon: "✦" },
  { key: "text", label: "Text", icon: "T" },
  { key: "speed", label: "Speed & Audio", icon: "♪" },
  { key: "export", label: "Export", icon: "⬇" },
];

const QUICK_CAPTIONS = ["WAIT FOR IT…", "GTA 6 IS INSANE 🔥", "Welcome to Vice City 🌴", "Did you catch this?", "Rockstar cooked 👨‍🍳", "Lucia is HER"];

const uid = () => Math.random().toString(36).slice(2, 10);
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "reel";

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block">
      <div className="mb-1 flex justify-between text-xs text-white/60">
        <span>{props.label}</span>
        <span className="tabular-nums text-white/80">
          {Number.isInteger(props.value) ? props.value : props.value.toFixed(2)}
          {props.suffix}
        </span>
      </div>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step ?? 1}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

function Toggle({ on, onChange, label, hint }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-[#181527] px-3 py-2 text-left text-sm hover:border-white/25"
    >
      <span>
        {label}
        {hint && <span className="block text-[11px] text-white/40">{hint}</span>}
      </span>
      <span className={`relative h-5 w-9 rounded-full transition ${on ? "bg-pink-500" : "bg-white/15"}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
    </button>
  );
}

function TimeInput({ value, onCommit, className = "" }: { value: number; onCommit: (n: number) => void; className?: string }) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      className={`field !px-2 !py-1 text-center tabular-nums ${className}`}
      value={text ?? formatTime(value, 1)}
      onChange={(e) => setText(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={() => {
        if (text !== null) {
          const n = parseTime(text);
          if (n !== null) onCommit(n);
          setText(null);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export default function Editor({ init }: { init: EditorInit }) {
  const handle = useRef<PlayerHandle>(null);
  const reel = init.reel;

  const [source, setSource] = useState<Source>({ type: "youtube", id: init.youtubeId });
  const [localName, setLocalName] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [range, setRange] = useState(() => {
    const s = reel?.startSec ?? init.startAt ?? 0;
    return { s, e: reel?.endSec ?? s + 30 };
  });
  const [settings, setSettings] = useState<Settings>(reel?.settings ?? DEFAULT_SETTINGS);
  const [captions, setCaptions] = useState<Caption[]>(reel?.captions ?? []);
  const [title, setTitle] = useState(reel?.title ?? "");
  const [reelId, setReelId] = useState<number | null>(reel?.id ?? null);
  const [time, setTime] = useState(range.s);
  const [playing, setPlaying] = useState(false);
  const [loopClip, setLoopClip] = useState(true);
  const [view, setView] = useState<[number, number]>([0, 1]);
  const [tab, setTab] = useState<Tab>("frame");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<{ url: string; ext: string; size: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const stopRecRef = useRef<(() => void) | null>(null);
  const lastDragSeek = useRef(0);

  const clipLen = range.e - range.s;
  const exporting = progress !== null;

  const patch = useCallback((p: Partial<Settings>) => setSettings((s) => ({ ...s, ...p })), []);
  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast((t) => (t === m ? null : t)), 3000);
  }, []);

  const onReady = useCallback((d: number) => {
    if (!d || !Number.isFinite(d)) return;
    setDuration(d);
    setView([0, d]);
    setRange((r) => {
      let s = Math.min(Math.max(0, r.s), Math.max(0, d - 0.5));
      let e = Math.min(r.e, d);
      if (e - s < 0.3) {
        s = 0;
        e = Math.min(d, 30);
      }
      return { s, e };
    });
  }, []);

  // seek to clip start when the player becomes ready the first time
  const seekedInit = useRef(false);
  useEffect(() => {
    if (duration > 0 && !seekedInit.current) {
      seekedInit.current = true;
      setTimeout(() => handle.current?.seek(range.s), 300);
    }
  }, [duration, range.s]);

  const togglePlay = useCallback(() => {
    const h = handle.current;
    if (!h) return;
    if (h.isPlaying()) return h.pause();
    const t = h.getTime();
    if (loopClip && (t < range.s || t >= range.e - 0.08)) h.seek(range.s);
    h.play();
  }, [loopClip, range.s, range.e]);

  const seekTo = useCallback(
    (t: number) => {
      handle.current?.seek(Math.min(Math.max(0, t), duration || t));
    },
    [duration],
  );

  const setIn = useCallback(() => setRange((r) => ({ s: Math.min(time, r.e - 0.3), e: r.e })), [time]);
  const setOut = useCallback(() => setRange((r) => ({ s: r.s, e: Math.max(time, r.s + 0.3) })), [time]);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const el = ev.target as HTMLElement;
      if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const k = ev.key.toLowerCase();
      if (k === " ") {
        ev.preventDefault();
        togglePlay();
      } else if (k === "i") setIn();
      else if (k === "o") setOut();
      else if (k === "arrowleft") {
        ev.preventDefault();
        seekTo(time - (ev.shiftKey ? 5 : 1 / 12));
      } else if (k === "arrowright") {
        ev.preventDefault();
        seekTo(time + (ev.shiftKey ? 5 : 1 / 12));
      } else if (k === "j") seekTo(time - 5);
      else if (k === "l") seekTo(time + 5);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [togglePlay, setIn, setOut, seekTo, time]);

  const dragSeek = (t: number) => {
    const n = performance.now();
    if (n - lastDragSeek.current > 120) {
      lastDragSeek.current = n;
      handle.current?.seek(t);
    }
  };

  const onRange = (s: number, e: number) => {
    if (s !== range.s && e === range.e) dragSeek(s);
    else if (e !== range.e && s === range.s) dragSeek(Math.max(s, e - 0.4));
    setRange({ s, e });
  };

  const setLength = (len: number) => {
    const e = duration ? Math.min(duration, range.s + len) : range.s + len;
    setRange({ s: range.s, e: Math.max(e, range.s + 0.3) });
  };

  const zoomView = (factor: number) => {
    const [vs, ve] = view;
    const span = (ve - vs) * factor;
    const center = Math.min(Math.max(time, vs), ve);
    let ns = center - span / 2;
    let ne = center + span / 2;
    if (ns < 0) {
      ne -= ns;
      ns = 0;
    }
    if (ne > duration) {
      ns -= ne - duration;
      ne = duration;
    }
    setView([Math.max(0, ns), Math.min(duration, ne)]);
  };
  const focusClip = () => {
    const pad = Math.max(4, clipLen * 0.5);
    setView([Math.max(0, range.s - pad), Math.min(duration, range.e + pad)]);
  };

  // ---- captions ---------------------------------------------------------------------------
  const addCaption = (text = "Your caption", at?: number) => {
    const rel = Math.min(Math.max(0, at ?? time - range.s), Math.max(0, clipLen - 0.5));
    const c: Caption = { id: uid(), text, start: rel, end: Math.min(clipLen, rel + 2.5) };
    setCaptions((cs) => [...cs, c].sort((a, b) => a.start - b.start));
    setTab("text");
  };
  const updateCaption = (id: string, p: Partial<Caption>) =>
    setCaptions((cs) => cs.map((c) => (c.id === id ? { ...c, ...p } : c)));

  // ---- save -------------------------------------------------------------------------------
  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: title.trim() || init.sourceTitle || "Untitled reel",
        youtubeId: init.youtubeId,
        sourceTitle: init.sourceTitle,
        channel: init.channel,
        startSec: range.s,
        endSec: range.e,
        settings,
        captions,
      };
      const res = await fetch(reelId ? `/api/reels/${reelId}` : "/api/reels", {
        method: reelId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setReelId(data.id);
      if (!title.trim()) setTitle(data.title);
      flash(reelId ? "Reel updated ✓" : "Reel saved ✓");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ---- local file + export ----------------------------------------------------------------
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (source.type === "file") URL.revokeObjectURL(source.url);
    setResult(null);
    setDuration(0);
    seekedInit.current = false;
    setSource({ type: "file", url: URL.createObjectURL(f) });
    setLocalName(f.name);
    flash("Local footage loaded — you can now render a video file");
  };
  const backToYouTube = () => {
    if (source.type === "file") URL.revokeObjectURL(source.url);
    setResult(null);
    setDuration(0);
    seekedInit.current = false;
    setSource({ type: "youtube", id: init.youtubeId });
    setLocalName(null);
  };

  const runExport = async () => {
    const v = handle.current?.getVideoEl();
    if (!v) return;
    handle.current?.pause();
    setError(null);
    setResult(null);
    setProgress(0);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const out = await exportReel({
        video: v,
        settings,
        captions,
        start: range.s,
        end: range.e,
        onProgress: setProgress,
        signal: ac.signal,
      });
      setResult({ url: URL.createObjectURL(out.blob), ext: out.ext, size: out.blob.size });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "Export failed");
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  // Records the on-screen 9:16 preview (filters, captions and title included) using
  // screen capture cropped to the preview element. Chrome / Edge only.
  const recordPreview = async () => {
    const h = handle.current;
    const box = previewRef.current;
    if (!h || !box) return;
    setError(null);
    setResult(null);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: true,
        preferCurrentTab: true,
      } as DisplayMediaStreamOptions);
    } catch {
      setError("Recording was cancelled. In the share dialog choose “This Tab” and tick “Share tab audio”.");
      return;
    }

    const videoTrack = stream.getVideoTracks()[0];
    const CropTargetApi = (window as unknown as { CropTarget?: { fromElement(el: Element): Promise<unknown> } }).CropTarget;
    if (CropTargetApi && videoTrack && "cropTo" in videoTrack) {
      try {
        const target = await CropTargetApi.fromElement(box);
        await (videoTrack as unknown as { cropTo(t: unknown): Promise<void> }).cropTo(target);
      } catch {
        /* cropping unavailable: keep the full tab */
      }
    }
    if (settings.muted) stream.getAudioTracks().forEach((t) => stream.removeTrack(t));

    const mime =
      ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      ) ?? "";
    const chunks: BlobPart[] = [];
    const rec = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      videoBitsPerSecond: 8_000_000,
      audioBitsPerSecond: 160_000,
    });
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    const stopped = new Promise<void>((res) => {
      rec.onstop = () => res();
    });
    const finish = () => {
      if (rec.state !== "inactive") rec.stop();
    };
    stopRecRef.current = finish;
    videoTrack?.addEventListener("ended", finish); // user pressed "Stop sharing"

    setProgress(0);
    try {
      h.pause();
      h.seek(range.s);
      rec.start(250);
      await new Promise((r) => setTimeout(r, 400));
      h.play();

      const startedAt = performance.now();
      const expectedMs = ((range.e - range.s) / settings.speed) * 1000;
      await new Promise<void>((resolve) => {
        const loop = () => {
          const t = h.getTime();
          setProgress(Math.min(1, Math.max(0, (t - range.s) / (range.e - range.s))));
          const timedOut = performance.now() - startedAt > expectedMs + 3000;
          if (t >= range.e - 0.05 || timedOut || rec.state === "inactive") return resolve();
          requestAnimationFrame(loop);
        };
        loop();
      });
    } finally {
      h.pause();
      finish();
      await stopped;
      stream.getTracks().forEach((t) => t.stop());
      stopRecRef.current = null;
      setProgress(null);
    }

    if (!chunks.length) {
      setError("Nothing was recorded. Try again and keep this tab in front.");
      return;
    }
    const type = rec.mimeType || mime || "video/webm";
    const blob = new Blob(chunks, { type });
    setResult({ url: URL.createObjectURL(blob), ext: type.includes("mp4") ? "mp4" : "webm", size: blob.size });
    flash("Reel rendered ✓");
  };

  const shareUrl = () => `${window.location.origin}/reel/${reelId}`;
  const copy = async (text: string, msg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      flash(msg);
    } catch {
      setError("Couldn't access the clipboard");
    }
  };

  const speedClipLen = clipLen / settings.speed;

  const outputView = (
    <>
      {exporting && (
        <div className="mt-3">
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-gradient-to-r from-pink-500 to-orange-400 transition-all" style={{ width: `${(progress ?? 0) * 100}%` }} />
          </div>
          <div className="mt-1 text-xs text-white/50">Rendering… {Math.round((progress ?? 0) * 100)}%</div>
        </div>
      )}
      {result && (
        <div className="mt-4 flex flex-col items-start gap-3 sm:flex-row">
          <video src={result.url} controls playsInline className="h-64 rounded-xl border border-white/10 bg-black" />
          <div>
            <div className="text-sm text-emerald-300">Done! {(result.size / 1024 / 1024).toFixed(1)} MB · .{result.ext}</div>
            <a href={result.url} download={`${slug(title || "gta6-reel")}.${result.ext}`} className="vice-btn mt-2 inline-block rounded-lg px-4 py-2 text-sm">
              ⬇ Download reel
            </a>
          </div>
        </div>
      )}
    </>
  );
  const sourceLabel = useMemo(() => init.sourceTitle || "YouTube video", [init.sourceTitle]);

  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col gap-4 px-4 py-4">
      {/* top bar */}
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/" className="chip !px-3 !py-2">
          ← Studio
        </Link>
        <div className="font-display text-xl">
          <span className="vice-text">CLIP</span>EDITOR
        </div>
        <input
          className="field max-w-md flex-1"
          placeholder="Name your reel…"
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="ml-auto flex items-center gap-2">
          {reelId && (
            <Link href={`/reel/${reelId}`} className="chip !py-2">
              ▶ Open reel
            </Link>
          )}
          <Link href="/reels" className="chip !py-2">
            Reels feed
          </Link>
          <button onClick={save} disabled={saving || clipLen < 0.2} className="vice-btn rounded-xl px-5 py-2 text-sm">
            {saving ? "Saving…" : reelId ? "Update reel" : "Save reel"}
          </button>
        </div>
      </header>

      {(error || toast) && (
        <div
          className={`rounded-xl border px-4 py-2 text-sm ${
            error ? "border-red-500/40 bg-red-500/10 text-red-200" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          }`}
          onClick={() => setError(null)}
        >
          {error ?? toast}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        {/* preview */}
        <div className="flex flex-col items-center gap-3">
          <div
            ref={previewRef}
            className="relative overflow-hidden rounded-[2rem] border-[6px] border-[#1e1a30] bg-black shadow-[0_30px_80px_-20px_rgba(255,45,149,.35)]"
            style={{ height: "min(66vh, 620px)", aspectRatio: "9 / 16" }}
          >
            <Stage
              ref={handle}
              source={source}
              settings={settings}
              captions={captions}
              start={range.s}
              end={range.e}
              loop={loopClip && !exporting}
              onTime={setTime}
              onReady={onReady}
              onPlayState={setPlaying}
              onClick={togglePlay}
              onError={setError}
            />
            {!playing && duration > 0 && (
              <button
                onClick={togglePlay}
                className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/55 text-2xl backdrop-blur hover:bg-black/70"
                aria-label="Play"
              >
                ▶
              </button>
            )}
          </div>
          <div className="max-w-[300px] text-center text-xs text-white/45">
            <span className="text-white/70">{sourceLabel}</span>
            {init.channel && <> · {init.channel}</>}
            {localName && <div className="mt-1 text-pink-300">Local file: {localName}</div>}
          </div>
        </div>

        {/* tools */}
        <div className="panel flex min-h-0 flex-col overflow-hidden">
          <div className="flex overflow-x-auto border-b border-white/10">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-2 px-4 py-3 text-sm transition ${
                  tab === t.key ? "border-b-2 border-pink-500 bg-white/5 text-white" : "text-white/55 hover:text-white"
                }`}
              >
                <span className="text-pink-400">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          <div className="max-h-[66vh] min-h-[320px] space-y-4 overflow-y-auto p-5">
            {tab === "frame" && (
              <>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-white/45">Layout</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="chip !py-3 text-left" data-on={settings.layout === "fill"} onClick={() => patch({ layout: "fill" })}>
                      <b className="block text-sm">Fill 9:16</b>
                      <span className="text-[11px] text-white/50">Crops the video to fill the whole reel</span>
                    </button>
                    <button className="chip !py-3 text-left" data-on={settings.layout === "fit"} onClick={() => patch({ layout: "fit" })}>
                      <b className="block text-sm">Fit + blur</b>
                      <span className="text-[11px] text-white/50">Full widescreen picture on a blurred backdrop</span>
                    </button>
                  </div>
                </div>
                {settings.layout === "fill" && (
                  <Slider label="Zoom" min={1} max={3} step={0.01} value={settings.zoom} suffix="×" onChange={(n) => patch({ zoom: n })} />
                )}
                <Slider
                  label={settings.layout === "fill" ? "Pan horizontally (reframe)" : "Horizontal"}
                  min={-100}
                  max={100}
                  value={settings.posX}
                  onChange={(n) => patch({ posX: n })}
                />
                <Slider label="Vertical position" min={-100} max={100} value={settings.posY} onChange={(n) => patch({ posY: n })} />
                <div className="flex gap-2">
                  <button className="chip" onClick={() => patch({ posX: 0, posY: 0, zoom: 1 })}>
                    Reset framing
                  </button>
                  <button className="chip" onClick={() => patch({ posX: -45, zoom: 1.2 })}>
                    Left subject
                  </button>
                  <button className="chip" onClick={() => patch({ posX: 45, zoom: 1.2 })}>
                    Right subject
                  </button>
                </div>
                <p className="text-xs text-white/40">
                  Tip: in Fill mode a 16:9 video is cropped to the centre. Use the pan slider to follow the action.
                </p>
              </>
            )}

            {tab === "look" && (
              <>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-white/45">Filters</div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {FILTERS.map((f) => (
                      <button key={f.key} className="chip !p-1.5" data-on={settings.filter === f.key} onClick={() => patch({ filter: f.key })}>
                        <div className="h-10 rounded-md" style={{ background: f.swatch }} />
                        <div className="mt-1 text-center text-[11px]">{f.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <Slider label="Brightness" min={50} max={150} value={settings.brightness} suffix="%" onChange={(n) => patch({ brightness: n })} />
                <Slider label="Contrast" min={50} max={150} value={settings.contrast} suffix="%" onChange={(n) => patch({ contrast: n })} />
                <Slider label="Saturation" min={0} max={200} value={settings.saturate} suffix="%" onChange={(n) => patch({ saturate: n })} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Toggle on={settings.vignette} onChange={(v) => patch({ vignette: v })} label="Vignette" hint="Darkened edges" />
                  <Toggle on={settings.letterbox} onChange={(v) => patch({ letterbox: v })} label="Cinematic bars" hint="Black bars top & bottom" />
                </div>
                <button className="chip" onClick={() => patch({ filter: "none", brightness: 100, contrast: 100, saturate: 100 })}>
                  Reset look
                </button>
              </>
            )}

            {tab === "text" && (
              <>
                <div>
                  <div className="mb-1 text-xs uppercase tracking-wider text-white/45">Title (shown the whole clip)</div>
                  <input
                    className="field"
                    placeholder="e.g. GTA 6 TRAILER BREAKDOWN"
                    value={settings.title}
                    maxLength={80}
                    onChange={(e) => patch({ title: e.target.value })}
                  />
                </div>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-white/45">Text style</div>
                  <div className="flex flex-wrap gap-2">
                    {CAPTION_STYLES.map((c) => (
                      <button key={c.key} className="chip" data-on={settings.captionStyle === c.key} onClick={() => patch({ captionStyle: c.key })}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Slider label="Text size" min={50} max={160} value={settings.captionSize} suffix="%" onChange={(n) => patch({ captionSize: n })} />
                  <Slider label="Caption height" min={10} max={92} value={settings.captionY} suffix="%" onChange={(n) => patch({ captionY: n })} />
                </div>

                <div className="border-t border-white/10 pt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-white/45">Captions ({captions.length})</div>
                    <button className="vice-btn rounded-lg px-3 py-1.5 text-xs" onClick={() => addCaption()}>
                      + Add at playhead
                    </button>
                  </div>
                  <div className="mb-3 flex flex-wrap gap-1.5">
                    {QUICK_CAPTIONS.map((q) => (
                      <button key={q} className="chip !py-1 text-[11px]" onClick={() => addCaption(q)}>
                        {q}
                      </button>
                    ))}
                  </div>
                  {captions.length === 0 && <p className="text-sm text-white/40">No captions yet. Move the playhead and add one.</p>}
                  <div className="space-y-2">
                    {captions.map((c) => (
                      <div key={c.id} className="rounded-xl border border-white/10 bg-[#181527] p-2.5">
                        <div className="flex gap-2">
                          <input className="field" value={c.text} maxLength={200} onChange={(e) => updateCaption(c.id, { text: e.target.value })} />
                          <button
                            className="chip !px-2.5 text-red-300"
                            onClick={() => setCaptions((cs) => cs.filter((x) => x.id !== c.id))}
                            aria-label="Delete caption"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-xs text-white/50">
                          <button className="chip !py-1" onClick={() => seekTo(range.s + c.start)}>
                            Go
                          </button>
                          from
                          <TimeInput className="w-20" value={c.start} onCommit={(n) => updateCaption(c.id, { start: Math.max(0, Math.min(n, c.end - 0.1)) })} />
                          to
                          <TimeInput className="w-20" value={c.end} onCommit={(n) => updateCaption(c.id, { end: Math.max(n, c.start + 0.1) })} />
                          <span className="ml-auto">into clip</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {tab === "speed" && (
              <>
                <div>
                  <div className="mb-2 text-xs uppercase tracking-wider text-white/45">Playback speed</div>
                  <div className="flex flex-wrap gap-2">
                    {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2].map((s) => (
                      <button key={s} className="chip" data-on={settings.speed === s} onClick={() => patch({ speed: s })}>
                        {s}×
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-white/40">
                    Slow-mo is perfect for trailer details. Final reel length: <b className="text-white/70">{formatTime(speedClipLen, 1)}</b>
                  </p>
                </div>
                <Toggle on={settings.muted} onChange={(v) => patch({ muted: v })} label="Mute original audio" hint="Add your own sound in Instagram / TikTok / Shorts" />
              </>
            )}

            {tab === "export" && (
              <>
                <div className="rounded-xl border border-white/10 bg-[#181527] p-4">
                  <div className="mb-1 font-semibold">1 · Save & share</div>
                  <p className="mb-3 text-xs text-white/50">
                    Reels are saved as non-destructive edits of the original YouTube video, playable in the built-in Reels feed.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={save} disabled={saving} className="vice-btn rounded-lg px-4 py-2 text-sm">
                      {saving ? "Saving…" : reelId ? "Update reel" : "Save reel"}
                    </button>
                    {reelId && (
                      <>
                        <button className="chip !py-2" onClick={() => copy(shareUrl(), "Share link copied ✓")}>
                          🔗 Copy share link
                        </button>
                        <Link className="chip !py-2" href={`/reel/${reelId}`}>
                          ▶ Open reel
                        </Link>
                      </>
                    )}
                    <button
                      className="chip !py-2"
                      onClick={() => copy(`${title || settings.title || "GTA 6 clip"}\n\n${HASHTAGS}`, "Caption + hashtags copied ✓")}
                    >
                      # Copy caption & hashtags
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#181527] p-4">
                  <div className="mb-1 font-semibold">2 · Render a video file (9:16, 720×1280)</div>
                  {source.type === "youtube" ? (
                    <>
                      <p className="mb-3 text-xs leading-relaxed text-white/50">
                        Click <b className="text-white/80">Record &amp; render</b>, then in the share box choose <b className="text-white/80">This Tab</b> and tick{" "}
                        <b className="text-white/80">Share tab audio</b>. The reel plays once from your IN point to your OUT point and is saved as a 9:16 video
                        with your framing, filters, captions and title. Works in Chrome and Edge; render runs in real time ({formatTime(speedClipLen, 1)}).
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {!exporting ? (
                          <button onClick={recordPreview} disabled={duration === 0 || !exportSupported()} className="vice-btn rounded-lg px-4 py-2 text-sm">
                            ⚡ Record &amp; render
                          </button>
                        ) : (
                          <button onClick={() => stopRecRef.current?.()} className="chip !py-2 text-red-300">
                            ■ Stop recording
                          </button>
                        )}
                      </div>
                      {outputView}
                      {!exporting && !result && (
                        <p className="mt-4 text-xs text-white/40">
                          Have the footage on your device instead? Load it below for a full-quality render.{" "}
                          <label className="chip inline-block cursor-pointer !py-1 text-[11px]">
                            📁 Load local video file
                            <input type="file" accept="video/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
                          </label>
                        </p>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="mb-3 text-xs text-white/50">
                        Rendering happens in real time ({formatTime(speedClipLen, 1)}). Keep this tab visible until it finishes.
                      </p>
                      {!exportSupported() && <p className="mb-3 text-sm text-red-300">Your browser doesn&apos;t support in-browser recording. Try Chrome, Edge or Firefox.</p>}
                      <div className="flex flex-wrap items-center gap-2">
                        {!exporting ? (
                          <button onClick={runExport} disabled={!exportSupported() || duration === 0} className="vice-btn rounded-lg px-4 py-2 text-sm">
                            ⚡ Render reel
                          </button>
                        ) : (
                          <button onClick={() => abortRef.current?.abort()} className="chip !py-2 text-red-300">
                            Cancel
                          </button>
                        )}
                        <button onClick={backToYouTube} className="chip !py-2" disabled={exporting}>
                          ← Back to YouTube source
                        </button>
                      </div>
                      {outputView}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* timeline */}
      <section className="panel p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={togglePlay} disabled={!duration} className="vice-btn grid h-10 w-10 place-items-center rounded-full" aria-label="Play / pause">
            {playing ? "❚❚" : "▶"}
          </button>
          <div className="min-w-[120px] text-sm tabular-nums">
            <span className="text-white">{formatTime(time, 1)}</span>
            <span className="text-white/40"> / {formatTime(duration, 0)}</span>
          </div>
          <button className="chip" onClick={() => seekTo(time - 5)} title="J">
            ⏪ 5s
          </button>
          <button className="chip" onClick={() => seekTo(time + 5)} title="L">
            5s ⏩
          </button>
          <div className="mx-1 hidden h-6 w-px bg-white/10 sm:block" />
          <button className="chip !border-pink-500/50" onClick={setIn} title="Shortcut: I">
            [ Set IN
          </button>
          <button className="chip !border-pink-500/50" onClick={setOut} title="Shortcut: O">
            Set OUT ]
          </button>
          <button className="chip" data-on={loopClip} onClick={() => setLoopClip((v) => !v)}>
            ⟲ Loop clip
          </button>
          <div className="ml-auto flex items-center gap-1.5 text-xs text-white/50">
            Zoom timeline
            <button className="chip !px-2.5" onClick={() => zoomView(2)} disabled={!duration}>
              −
            </button>
            <button className="chip !px-2.5" onClick={() => zoomView(0.5)} disabled={!duration}>
              +
            </button>
            <button className="chip" onClick={focusClip} disabled={!duration}>
              Clip
            </button>
            <button className="chip" onClick={() => setView([0, duration])} disabled={!duration}>
              Full
            </button>
          </div>
        </div>

        {duration > 0 ? (
          <Timeline duration={duration} start={range.s} end={range.e} time={time} view={view} onSeek={seekTo} onRange={onRange} />
        ) : (
          <div className="grid h-24 place-items-center rounded-xl border border-dashed border-white/15 text-sm text-white/40">Loading video…</div>
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/50">IN</span>
              <button className="chip !px-2" onClick={() => setRange((r) => ({ ...r, s: Math.max(0, r.s - 0.1) }))}>
                −.1
              </button>
              <TimeInput className="w-24" value={range.s} onCommit={(n) => setRange((r) => ({ s: Math.max(0, Math.min(n, r.e - 0.3)), e: r.e }))} />
              <button className="chip !px-2" onClick={() => setRange((r) => ({ ...r, s: Math.min(r.e - 0.3, r.s + 0.1) }))}>
                +.1
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/50">OUT</span>
              <button className="chip !px-2" onClick={() => setRange((r) => ({ ...r, e: Math.max(r.s + 0.3, r.e - 0.1) }))}>
                −.1
              </button>
              <TimeInput
                className="w-24"
                value={range.e}
                onCommit={(n) => setRange((r) => ({ s: r.s, e: Math.max(r.s + 0.3, duration ? Math.min(n, duration) : n) }))}
              />
              <button className="chip !px-2" onClick={() => setRange((r) => ({ ...r, e: duration ? Math.min(duration, r.e + 0.1) : r.e + 0.1 }))}>
                +.1
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-white/50">Length</span>
              {[15, 30, 45, 60, 90].map((l) => (
                <button key={l} className="chip !px-2.5" data-on={Math.abs(clipLen - l) < 0.05} onClick={() => setLength(l)}>
                  {l}s
                </button>
              ))}
            </div>
          </div>
          <div className="text-right text-sm">
            <span className="text-white/50">Clip: </span>
            <b className={clipLen > 90 ? "text-orange-300" : "text-pink-300"}>{formatTime(clipLen, 1)}</b>
            {clipLen > 90 && <div className="text-[11px] text-orange-300/80">Over 90s — may be too long for Shorts / Reels</div>}
          </div>
        </div>
        <div className="mt-3 text-[11px] text-white/35">
          Shortcuts: <kbd>Space</kbd> play · <kbd>I</kbd> / <kbd>O</kbd> set in / out · <kbd>←</kbd> <kbd>→</kbd> frame step · <kbd>Shift</kbd>+arrows ±5s · <kbd>J</kbd> <kbd>L</kbd> ±5s
        </div>
      </section>
    </div>
  );
}
