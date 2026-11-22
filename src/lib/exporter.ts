// Client-side renderer: draws the reel onto a 720x1280 canvas and records it with MediaRecorder.
// Works for local video files (YouTube's embedded player can't be captured).

import {
  buildFilter,
  captionActive,
  captionFontScale,
  computeLayout,
  type Caption,
  type CaptionStyle,
  type Settings,
} from "@/lib/reel";

export const OUT_W = 720;
export const OUT_H = 1280;

type AudioBundle = { ctx: AudioContext; src: MediaElementAudioSourceNode; dest: MediaStreamAudioDestinationNode };
const audioCache = new WeakMap<HTMLVideoElement, AudioBundle>();

function getAudio(video: HTMLVideoElement): AudioBundle | null {
  const hit = audioCache.get(video);
  if (hit) return hit;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const src = ctx.createMediaElementSource(video);
    const dest = ctx.createMediaStreamDestination();
    src.connect(ctx.destination);
    const b = { ctx, src, dest };
    audioCache.set(video, b);
    return b;
  } catch {
    return null;
  }
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawText(ctx: CanvasRenderingContext2D, raw: string, style: CaptionStyle, cx: number, cy: number, px: number) {
  const upper = style === "impact" || style === "vice";
  const text = upper ? raw.toUpperCase() : raw;
  ctx.save();
  ctx.font =
    style === "clean"
      ? `700 ${px}px system-ui, "Segoe UI", Roboto, sans-serif`
      : `${style === "vice" ? "italic " : ""}900 ${px}px Impact, "Arial Black", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  const maxW = OUT_W * 0.9 - (style === "clean" ? px * 1.2 : 0);
  const lines = wrapLines(ctx, text, maxW);
  const lh = px * 1.12;
  const top = cy - (lines.length * lh) / 2 + lh / 2;

  if (style === "clean") {
    const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const bw = widest + px * 1.2;
    const bh = lines.length * lh + px * 0.5;
    ctx.fillStyle = "rgba(0,0,0,0.62)";
    roundRect(ctx, cx - bw / 2, cy - bh / 2, bw, bh, px * 0.5);
    ctx.fill();
  }

  lines.forEach((line, i) => {
    const y = top + i * lh;
    switch (style) {
      case "impact":
        ctx.shadowColor = "rgba(0,0,0,.55)";
        ctx.shadowBlur = px * 0.1;
        ctx.shadowOffsetY = px * 0.05;
        ctx.lineWidth = px * 0.16;
        ctx.strokeStyle = "#000";
        ctx.strokeText(line, cx, y);
        ctx.shadowColor = "transparent";
        ctx.fillStyle = "#fff";
        ctx.fillText(line, cx, y);
        break;
      case "vice":
        ctx.fillStyle = "#ff9a3c";
        ctx.fillText(line, cx + px * 0.05, y + px * 0.05);
        ctx.shadowColor = "#ff2d95";
        ctx.shadowBlur = px * 0.3;
        ctx.fillStyle = "#fff";
        ctx.fillText(line, cx, y);
        break;
      case "neon":
        ctx.fillStyle = "#fff";
        for (const [blur, color] of [
          [px * 0.8, "#0891b2"],
          [px * 0.4, "#22d3ee"],
          [px * 0.15, "#22d3ee"],
        ] as const) {
          ctx.shadowColor = color;
          ctx.shadowBlur = blur;
          ctx.fillText(line, cx, y);
        }
        break;
      case "clean":
        ctx.fillStyle = "#fff";
        ctx.fillText(line, cx, y);
        break;
    }
  });
  ctx.restore();
}

function supportsFilter(ctx: CanvasRenderingContext2D) {
  return "filter" in ctx;
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  s: Settings,
  captions: Caption[],
  rel: number,
) {
  const W = OUT_W;
  const H = OUT_H;
  const aspect = video.videoWidth / video.videoHeight || 16 / 9;
  const filterCss = buildFilter(s);
  const canFilter = supportsFilter(ctx);

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);

  if (s.layout === "fit") {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#3b0a45");
    g.addColorStop(0.5, "#0b0914");
    g.addColorStop(1, "#431407");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // blurred cover version of the video behind the main picture
    const scale = Math.max(W / video.videoWidth, H / video.videoHeight) * 1.1;
    const bw = video.videoWidth * scale;
    const bh = video.videoHeight * scale;
    ctx.save();
    if (canFilter) ctx.filter = `blur(28px) brightness(.55) ${filterCss}`;
    ctx.globalAlpha = canFilter ? 0.9 : 0.35;
    ctx.drawImage(video, (W - bw) / 2, (H - bh) / 2, bw, bh);
    ctx.restore();
  }

  const r = computeLayout(s, aspect);
  ctx.save();
  if (canFilter) ctx.filter = filterCss || "none";
  ctx.drawImage(video, r.left * W, r.top * H, r.width * W, r.height * H);
  ctx.restore();

  if (s.vignette) {
    const rg = ctx.createRadialGradient(W / 2, H / 2, H * 0.28, W / 2, H / 2, H * 0.72);
    rg.addColorStop(0, "rgba(0,0,0,0)");
    rg.addColorStop(1, "rgba(0,0,0,.55)");
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, W, H);
    const lg = ctx.createLinearGradient(0, 0, 0, H);
    lg.addColorStop(0, "rgba(0,0,0,.35)");
    lg.addColorStop(0.18, "rgba(0,0,0,0)");
    lg.addColorStop(0.7, "rgba(0,0,0,0)");
    lg.addColorStop(1, "rgba(0,0,0,.45)");
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);
  }

  if (s.letterbox) {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H * 0.11);
    ctx.fillRect(0, H * 0.89, W, H * 0.11);
  }

  const px = W * captionFontScale(s.captionSize);
  if (s.title) drawText(ctx, s.title, s.captionStyle, W / 2, H * 0.1, px * 0.85);
  for (const c of captionActive(captions, rel)) {
    drawText(ctx, c.text, s.captionStyle, W / 2, (s.captionY / 100) * H, px);
  }
}

export type ExportArgs = {
  video: HTMLVideoElement;
  settings: Settings;
  captions: Caption[];
  start: number;
  end: number;
  onProgress: (p: number) => void;
  signal: AbortSignal;
};

export function exportSupported() {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement !== "undefined" && "captureStream" in HTMLCanvasElement.prototype;
}

export async function exportReel(a: ExportArgs): Promise<{ blob: Blob; ext: string }> {
  const { video, settings, captions, start, end } = a;
  const canvas = document.createElement("canvas");
  canvas.width = OUT_W;
  canvas.height = OUT_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  const prevMuted = video.muted;
  const prevRate = video.playbackRate;
  video.pause();
  video.currentTime = start;
  await new Promise<void>((res) => {
    const done = () => {
      video.removeEventListener("seeked", done);
      res();
    };
    video.addEventListener("seeked", done);
    setTimeout(done, 1500);
  });
  video.playbackRate = settings.speed;

  const stream = canvas.captureStream(30);
  const audio = getAudio(video);
  if (audio && !settings.muted) {
    await audio.ctx.resume();
    video.muted = false;
    audio.src.disconnect();
    audio.src.connect(audio.dest); // record only, stay silent while rendering
    audio.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  } else {
    video.muted = true;
  }

  const mimes = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  const mime = mimes.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
  const recorder = new MediaRecorder(stream, {
    ...(mime ? { mimeType: mime } : {}),
    videoBitsPerSecond: 8_000_000,
    audioBitsPerSecond: 160_000,
  });
  const chunks: BlobPart[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((res) => {
    recorder.onstop = () => res();
  });

  const cleanup = () => {
    video.pause();
    video.muted = prevMuted;
    video.playbackRate = prevRate;
    video.currentTime = start;
    if (audio) {
      audio.src.disconnect();
      audio.src.connect(audio.ctx.destination);
    }
    stream.getTracks().forEach((t) => t.stop());
  };

  recorder.start(250);
  await video.play();

  await new Promise<void>((resolve, reject) => {
    const loop = () => {
      if (a.signal.aborted) return reject(new DOMException("Cancelled", "AbortError"));
      const t = video.currentTime;
      drawFrame(ctx, video, settings, captions, t - start);
      a.onProgress(Math.min(1, Math.max(0, (t - start) / (end - start))));
      if (t >= end - 0.03 || video.ended) return resolve();
      requestAnimationFrame(loop);
    };
    loop();
  }).catch((err) => {
    if (recorder.state !== "inactive") recorder.stop();
    cleanup();
    throw err;
  });

  recorder.stop();
  await stopped;
  cleanup();
  a.onProgress(1);
  const type = recorder.mimeType || mime || "video/webm";
  return { blob: new Blob(chunks, { type }), ext: type.includes("mp4") ? "mp4" : "webm" };
}
