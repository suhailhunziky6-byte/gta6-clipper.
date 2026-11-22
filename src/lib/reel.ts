// Shared types + pure helpers used by the editor, the viewer, the API and the exporter.

export type FilterKey = "none" | "vice" | "neon" | "cinema" | "noir" | "vivid" | "retro";
export type CaptionStyle = "impact" | "vice" | "neon" | "clean";
export type Layout = "fill" | "fit";

export type Caption = {
  id: string;
  text: string;
  /** seconds relative to the start of the clip */
  start: number;
  end: number;
};

export type Settings = {
  layout: Layout;
  zoom: number; // 1 - 3
  posX: number; // -100 .. 100
  posY: number; // -100 .. 100
  filter: FilterKey;
  brightness: number; // percent, 100 = neutral
  contrast: number;
  saturate: number;
  speed: number;
  muted: boolean;
  vignette: boolean;
  letterbox: boolean;
  title: string;
  captionStyle: CaptionStyle;
  captionY: number; // percent from top
  captionSize: number; // percent, 100 = default
};

export const DEFAULT_SETTINGS: Settings = {
  layout: "fill",
  zoom: 1,
  posX: 0,
  posY: 0,
  filter: "none",
  brightness: 100,
  contrast: 100,
  saturate: 100,
  speed: 1,
  muted: false,
  vignette: true,
  letterbox: false,
  title: "",
  captionStyle: "impact",
  captionY: 72,
  captionSize: 100,
};

export const FILTERS: { key: FilterKey; label: string; css: string; swatch: string }[] = [
  { key: "none", label: "Original", css: "", swatch: "linear-gradient(135deg,#334155,#64748b)" },
  {
    key: "vice",
    label: "Vice City",
    css: "saturate(1.45) contrast(1.1) hue-rotate(-14deg) sepia(0.15)",
    swatch: "linear-gradient(135deg,#ff2d95,#ff9a3c)",
  },
  {
    key: "neon",
    label: "Neon Night",
    css: "saturate(1.7) contrast(1.15) hue-rotate(22deg) brightness(1.05)",
    swatch: "linear-gradient(135deg,#22d3ee,#a855f7)",
  },
  {
    key: "cinema",
    label: "Cinematic",
    css: "contrast(1.2) saturate(0.85) brightness(0.95) sepia(0.1)",
    swatch: "linear-gradient(135deg,#0f766e,#d97706)",
  },
  {
    key: "noir",
    label: "Noir",
    css: "grayscale(1) contrast(1.25)",
    swatch: "linear-gradient(135deg,#111827,#d1d5db)",
  },
  {
    key: "vivid",
    label: "Vivid",
    css: "saturate(1.6) contrast(1.1)",
    swatch: "linear-gradient(135deg,#84cc16,#f43f5e)",
  },
  {
    key: "retro",
    label: "Retro VHS",
    css: "sepia(0.45) saturate(1.2) contrast(0.95) hue-rotate(-10deg)",
    swatch: "linear-gradient(135deg,#b45309,#7c3aed)",
  },
];

export const CAPTION_STYLES: { key: CaptionStyle; label: string }[] = [
  { key: "impact", label: "Impact" },
  { key: "vice", label: "Vice" },
  { key: "neon", label: "Neon" },
  { key: "clean", label: "Clean" },
];

export function buildFilter(s: Settings): string {
  const preset = FILTERS.find((f) => f.key === s.filter)?.css ?? "";
  const adj = `brightness(${s.brightness / 100}) contrast(${s.contrast / 100}) saturate(${s.saturate / 100})`;
  return `${adj} ${preset}`.trim();
}

export const FRAME_W = 9;
export const FRAME_H = 16;

export type Rect = { left: number; top: number; width: number; height: number }; // fractions of frame

/** Where the source video sits inside the 9:16 frame. Shared by CSS preview and canvas export. */
export function computeLayout(s: Settings, videoAspect: number): Rect {
  const W = FRAME_W;
  const H = FRAME_H;
  const fa = W / H;
  let w: number;
  let h: number;
  let cx = W / 2;
  let cy = H / 2;
  if (s.layout === "fill") {
    const z = Math.max(s.zoom, fa / videoAspect);
    h = z * H;
    w = h * videoAspect;
    const mx = Math.max(0, (w - W) / 2);
    const my = Math.max(0, (h - H) / 2);
    cx = W / 2 - (s.posX / 100) * mx;
    cy = H / 2 - (s.posY / 100) * my;
  } else {
    if (videoAspect >= fa) {
      w = W;
      h = w / videoAspect;
    } else {
      h = H;
      w = h * videoAspect;
    }
    cy = H / 2 + (s.posY / 100) * ((H - h) / 2);
  }
  return { left: (cx - w / 2) / W, top: (cy - h / 2) / H, width: w / W, height: h / H };
}

export function captionFontScale(size: number) {
  return 0.065 * (size / 100); // fraction of frame width
}

export function captionActive(captions: Caption[], rel: number): Caption[] {
  return captions.filter((c) => rel >= c.start && rel < c.end);
}

export function extractYouTubeId(input: string): { id: string; t?: number } | null {
  const raw = input.trim();
  if (!raw) return null;
  if (/^[\w-]{11}$/.test(raw)) return { id: raw };
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\.|^m\.|^music\./, "");
  let id: string | null = null;
  if (host === "youtu.be") id = url.pathname.split("/")[1] ?? null;
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    if (url.pathname === "/watch") id = url.searchParams.get("v");
    else {
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/);
      if (m) id = m[1];
    }
  }
  if (!id || !/^[\w-]{11}$/.test(id)) return null;
  const tRaw = url.searchParams.get("t") ?? url.searchParams.get("start");
  let t: number | undefined;
  if (tRaw) {
    const m = tRaw.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
    if (m && (m[1] || m[2] || m[3])) t = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
  }
  return { id, t };
}

export function formatTime(sec: number, decimals = 0): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const sStr = decimals > 0 ? s.toFixed(decimals).padStart(3 + decimals - 1, "0") : String(Math.floor(s)).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sStr}` : `${m}:${sStr}`;
}

export function parseTime(text: string): number | null {
  const t = text.trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const parts = t.split(":").map(Number);
  if (parts.some((p) => !Number.isFinite(p))) return null;
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

export const thumbUrl = (id: string, q: "hq" | "mq" | "maxres" = "hq") =>
  `https://i.ytimg.com/vi/${id}/${q}default.jpg`;

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === "number" && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
};

/** Sanitises untrusted settings input from the API. */
export function sanitizeSettings(input: unknown): Settings {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const D = DEFAULT_SETTINGS;
  return {
    layout: i.layout === "fit" ? "fit" : "fill",
    zoom: clamp(i.zoom, 1, 3, D.zoom),
    posX: clamp(i.posX, -100, 100, 0),
    posY: clamp(i.posY, -100, 100, 0),
    filter: FILTERS.some((f) => f.key === i.filter) ? (i.filter as FilterKey) : "none",
    brightness: clamp(i.brightness, 50, 150, 100),
    contrast: clamp(i.contrast, 50, 150, 100),
    saturate: clamp(i.saturate, 0, 200, 100),
    speed: clamp(i.speed, 0.25, 2, 1),
    muted: i.muted === true,
    vignette: i.vignette !== false,
    letterbox: i.letterbox === true,
    title: typeof i.title === "string" ? i.title.slice(0, 80) : "",
    captionStyle: CAPTION_STYLES.some((c) => c.key === i.captionStyle) ? (i.captionStyle as CaptionStyle) : "impact",
    captionY: clamp(i.captionY, 5, 95, 72),
    captionSize: clamp(i.captionSize, 50, 160, 100),
  };
}

export function sanitizeCaptions(input: unknown): Caption[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 200).flatMap((c, idx) => {
    if (!c || typeof c !== "object") return [];
    const o = c as Record<string, unknown>;
    if (typeof o.text !== "string" || !o.text.trim()) return [];
    const start = clamp(o.start, 0, 100000, 0);
    const end = clamp(o.end, 0, 100000, start + 2);
    return [
      {
        id: typeof o.id === "string" ? o.id.slice(0, 40) : `c${idx}`,
        text: o.text.slice(0, 200),
        start,
        end: Math.max(end, start + 0.1),
      },
    ];
  });
}

export const HASHTAGS = "#GTA6 #GTAVI #GrandTheftAutoVI #ViceCity #Rockstar #Lucia #Jason #Gaming #Reels #Shorts";
