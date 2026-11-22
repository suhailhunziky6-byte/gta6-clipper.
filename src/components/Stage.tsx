"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  buildFilter,
  captionActive,
  captionFontScale,
  computeLayout,
  thumbUrl,
  type Caption,
  type CaptionStyle,
  type Settings,
} from "@/lib/reel";
import { loadYouTubeApi, type YTPlayer } from "@/lib/youtube";

export type Source = { type: "youtube"; id: string } | { type: "file"; url: string };

export interface PlayerHandle {
  play(): void;
  pause(): void;
  seek(t: number): void;
  getTime(): number;
  getDuration(): number;
  isPlaying(): boolean;
  getVideoEl(): HTMLVideoElement | null;
  setMuted(m: boolean): void;
}

type Props = {
  source: Source;
  settings: Settings;
  captions: Caption[];
  start: number;
  end: number;
  /** keep playback inside [start,end] and loop it */
  loop?: boolean;
  autoplay?: boolean;
  forceMuted?: boolean;
  onTime?: (t: number) => void;
  onReady?: (duration: number) => void;
  onPlayState?: (playing: boolean) => void;
  onClick?: () => void;
  onError?: (msg: string) => void;
};

export function textCss(style: CaptionStyle, sizeFrac: number): CSSProperties {
  const base: CSSProperties = {
    fontSize: `${sizeFrac * 100}cqw`,
    lineHeight: 1.12,
    textAlign: "center",
    fontFamily: "Impact, 'Arial Black', 'Helvetica Neue', sans-serif",
    fontWeight: 900,
    letterSpacing: "0.01em",
    wordBreak: "break-word",
  };
  switch (style) {
    case "impact":
      return {
        ...base,
        textTransform: "uppercase",
        color: "#fff",
        WebkitTextStroke: "0.16em #000",
        paintOrder: "stroke fill",
        textShadow: "0 0.05em 0.1em rgba(0,0,0,.55)",
      };
    case "vice":
      return {
        ...base,
        textTransform: "uppercase",
        color: "#fff",
        fontStyle: "italic",
        textShadow: "0.05em 0.05em 0 #ff9a3c, 0 0 0.3em #ff2d95",
      };
    case "neon":
      return {
        ...base,
        color: "#fff",
        textShadow: "0 0 0.15em #22d3ee, 0 0 0.4em #22d3ee, 0 0 0.8em #0891b2",
      };
    case "clean":
      return {
        ...base,
        fontFamily: "system-ui, 'Segoe UI', Roboto, sans-serif",
        fontWeight: 700,
        color: "#fff",
        background: "rgba(0,0,0,.62)",
        padding: "0.25em 0.6em",
        borderRadius: "0.5em",
        display: "inline-block",
        letterSpacing: 0,
      };
  }
}

const Stage = forwardRef<PlayerHandle, Props>(function Stage(props, ref) {
  const { source, settings, captions, start, end } = props;
  const [time, setTime] = useState(start);
  const [videoAspect, setVideoAspect] = useState(16 / 9);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const ytHost = useRef<HTMLDivElement>(null);
  const ytRef = useRef<YTPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readyRef = useRef(false);
  const playingRef = useRef(false);
  const lastSeekRef = useRef(0);
  const lastTimeRef = useRef(-1);
  const live = useRef(props);
  useEffect(() => {
    live.current = props;
  });

  const isYT = source.type === "youtube";
  const sourceKey = source.type === "youtube" ? `yt:${source.id}` : `file:${source.url}`;

  const setPlaying = useCallback((p: boolean) => {
    if (playingRef.current !== p) {
      playingRef.current = p;
      live.current.onPlayState?.(p);
    }
  }, []);

  const applyAudioRate = useCallback(() => {
    const { settings: s, forceMuted } = live.current;
    const muted = s.muted || !!forceMuted;
    const yt = ytRef.current;
    if (yt && readyRef.current) {
      try {
        if (muted) yt.mute();
        else yt.unMute();
        yt.setPlaybackRate(s.speed);
      } catch {
        /* player not ready */
      }
    }
    const v = videoRef.current;
    if (v) {
      v.muted = muted;
      v.playbackRate = s.speed;
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      play() {
        if (!readyRef.current) return;
        if (ytRef.current) ytRef.current.playVideo();
        else void videoRef.current?.play().catch(() => undefined);
      },
      pause() {
        if (ytRef.current) ytRef.current.pauseVideo();
        else videoRef.current?.pause();
      },
      seek(t: number) {
        if (!readyRef.current) return;
        lastSeekRef.current = performance.now();
        if (ytRef.current) ytRef.current.seekTo(Math.max(0, t), true);
        else if (videoRef.current) videoRef.current.currentTime = Math.max(0, t);
        lastTimeRef.current = t;
        setTime(t);
        live.current.onTime?.(t);
      },
      getTime() {
        if (!readyRef.current) return 0;
        if (ytRef.current) return ytRef.current.getCurrentTime() || 0;
        return videoRef.current?.currentTime ?? 0;
      },
      getDuration() {
        if (ytRef.current) return ytRef.current.getDuration() || 0;
        return videoRef.current?.duration || 0;
      },
      isPlaying: () => playingRef.current,
      getVideoEl: () => videoRef.current,
      setMuted(m: boolean) {
        if (ytRef.current && readyRef.current) {
          if (m) ytRef.current.mute();
          else ytRef.current.unMute();
        }
        if (videoRef.current) videoRef.current.muted = m;
      },
    }),
    [],
  );

  // --- create / destroy the YouTube player -------------------------------------------------
  useEffect(() => {
    readyRef.current = false;
    playingRef.current = false;
    setStatus("loading");
    if (source.type !== "youtube") return;
    let cancelled = false;
    const host = ytHost.current;
    if (!host) return;
    host.innerHTML = "";
    const mount = document.createElement("div");
    host.appendChild(mount);
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        ytRef.current = new YT.Player(mount, {
          videoId: source.id,
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            fs: 0,
            iv_load_policy: 3,
            cc_load_policy: 0,
            start: Math.floor(live.current.start),
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              readyRef.current = true;
              setStatus("ready");
              applyAudioRate();
              live.current.onReady?.(e.target.getDuration());
              if (live.current.autoplay) {
                e.target.seekTo(live.current.start, true);
                e.target.playVideo();
              }
            },
            onStateChange: (e) => {
              if (cancelled) return;
              setPlaying(e.data === 1 || e.data === 3);
              if (e.data === 1) applyAudioRate();
              if (e.data === 0 && live.current.loop) {
                e.target.seekTo(live.current.start, true);
                e.target.playVideo();
              }
            },
            onError: (e) => {
              setStatus("error");
              const msg =
                e.data === 101 || e.data === 150
                  ? "The owner of this video disabled embedding."
                  : e.data === 100
                    ? "This video is private or was removed."
                    : "YouTube could not play this video.";
              live.current.onError?.(msg);
            },
          },
        });
      })
      .catch(() => {
        setStatus("error");
        live.current.onError?.("Could not load the YouTube player. Check your connection.");
      });
    return () => {
      cancelled = true;
      readyRef.current = false;
      try {
        ytRef.current?.destroy();
      } catch {
        /* ignore */
      }
      ytRef.current = null;
      host.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceKey]);

  // apply speed / mute whenever they change
  useEffect(() => {
    applyAudioRate();
  }, [settings.speed, settings.muted, props.forceMuted, status, applyAudioRate]);

  // --- time loop: clip range enforcement + captions clock -----------------------------------
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(tick);
      if (!readyRef.current) return;
      const yt = ytRef.current;
      const v = videoRef.current;
      const t = yt ? yt.getCurrentTime() || 0 : (v?.currentTime ?? 0);
      const { start: s, end: e, loop } = live.current;
      if (playingRef.current && loop && performance.now() - lastSeekRef.current > 500) {
        if (t >= e - 0.04 || t < s - 0.6) {
          lastSeekRef.current = performance.now();
          if (yt) yt.seekTo(s, true);
          else if (v) v.currentTime = s;
          return;
        }
      }
      if (Math.abs(t - lastTimeRef.current) > 0.03) {
        lastTimeRef.current = t;
        setTime(t);
        live.current.onTime?.(t);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const rect = computeLayout(settings, videoAspect);
  const filter = buildFilter(settings);
  const rel = time - start;
  const active = captionActive(captions, rel);
  const sizeFrac = captionFontScale(settings.captionSize);

  return (
    <div
      className="relative h-full w-full select-none overflow-hidden bg-black"
      style={{ containerType: "size" }}
      onClick={props.onClick}
    >
      {/* background for "fit" layout */}
      {settings.layout === "fit" &&
        (isYT ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl(source.id)}
            alt=""
            className="absolute inset-0 h-full w-full scale-150 object-cover opacity-70 blur-2xl"
            style={{ filter: `${filter} blur(28px) brightness(.6)` }}
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-fuchsia-950 via-slate-950 to-orange-950" />
        ))}

      {/* media layer */}
      <div
        className="absolute"
        style={{
          left: `${rect.left * 100}%`,
          top: `${rect.top * 100}%`,
          width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`,
          filter,
        }}
      >
        {source.type === "youtube" ? (
          <div ref={ytHost} className="yt-host h-full w-full" />
        ) : (
          <video
            ref={videoRef}
            src={source.url}
            playsInline
            preload="auto"
            className="h-full w-full object-fill"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setVideoAspect(v.videoWidth / v.videoHeight);
              readyRef.current = true;
              setStatus("ready");
              applyAudioRate();
              props.onReady?.(v.duration);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => {
              if (live.current.loop && videoRef.current) {
                videoRef.current.currentTime = live.current.start;
                void videoRef.current.play().catch(() => undefined);
              }
            }}
            onError={() => {
              setStatus("error");
              props.onError?.("This file could not be played in your browser.");
            }}
          />
        )}
      </div>

      {settings.vignette && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.55) 100%), linear-gradient(to bottom, rgba(0,0,0,.35), transparent 18%, transparent 70%, rgba(0,0,0,.45))",
          }}
        />
      )}

      {settings.letterbox && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 bg-black" style={{ height: "11%" }} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black" style={{ height: "11%" }} />
        </>
      )}

      {settings.title && (
        <div
          className="pointer-events-none absolute left-1/2 w-[90%] -translate-x-1/2 -translate-y-1/2"
          style={{ top: "10%", ...textCss(settings.captionStyle, sizeFrac * 0.85), textAlign: "center" }}
        >
          {settings.title}
        </div>
      )}

      {active.map((c) => (
        <div
          key={c.id}
          className="pointer-events-none absolute left-1/2 w-[90%] -translate-x-1/2 -translate-y-1/2"
          style={{ top: `${settings.captionY}%`, ...textCss(settings.captionStyle, sizeFrac) }}
        >
          {c.text}
        </div>
      ))}

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-black/60">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
        </div>
      )}
    </div>
  );
});

export default Stage;
