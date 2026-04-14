"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@clerk/nextjs";
import { buildProfileImageUrls } from "@/lib/actor-headshots";
import { trackEvent } from "@/lib/analytics";
import type { ActorRow } from "@/lib/types/actor";

type Props = {
  actor: ActorRow;
  /** Optional override; otherwise derived from actor. */
  urls?: string[];
  /** Signed-in users can select headshots (and optional turnaround) and download a zip. */
  enableDownloadSelection?: boolean;
  /** When set, shows an extra row to include the turnaround sheet in the zip. */
  turnaroundUrl?: string | null;
};

const tile =
  "relative overflow-hidden rounded-sm border border-white/10 bg-black/50 shadow-[0_0_0_1px_rgba(255,140,0,0.1)]";
/** Portrait frame 9:16; headshots fill the tile (cover + top bias for faces). */
const headshotCell = `${tile} aspect-[9/16] w-full min-h-0 min-w-0`;
const headshotImg =
  "h-full w-full object-cover object-top bg-black/40";
/** Two-up profile row: same width columns, full image visible (no crop). */
const pairHeadshotCell =
  `${tile} relative flex aspect-[9/16] w-full min-h-0 min-w-0 items-center justify-center overflow-hidden bg-black/40`;
const pairHeadshotImg =
  "max-h-full max-w-full object-contain object-center bg-black/40";
/** 16:9 stills (slots 2–3 in `headshot_urls`): full frame visible in profile. */
const still169Cell =
  `${tile} flex aspect-video w-full min-h-0 min-w-0 items-center justify-center overflow-hidden bg-black/40`;
const still169Img =
  "h-full w-full object-contain object-center bg-black/40";
/** 16:9 horizontal frame for turnaround sheets; `object-contain` keeps legacy vertical sheets fully visible (letterboxed). */
const turnaroundFrame =
  `${tile} relative mx-auto flex w-full max-w-[1600px] min-h-0 min-w-0 items-center justify-center border-metallic-orange/25 bg-black/60 aspect-video max-h-[min(92vh,960px)]`;
const turnaroundImg =
  "max-h-full max-w-full object-contain object-center";
const singleCell = `${tile} relative mx-auto aspect-[9/16] w-full max-w-[min(100%,min(96vw,520px))] min-h-0 overflow-hidden sm:max-w-[min(100%,560px)]`;

function ToggleRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-center gap-2 text-xs font-medium text-white/75 md:text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-metallic-orange"
      />
      <span>{label}</span>
    </label>
  );
}

/**
 * Profile gallery with optional per-asset download selection (signed-in users).
 */
export function ActorHeadshotGalleryGrid({
  actor,
  urls: urlsProp,
  enableDownloadSelection = false,
  turnaroundUrl: turnaroundProp,
}: Props) {
  const urls = urlsProp ?? buildProfileImageUrls(actor);
  const name = actor.name;
  const n = urls.length;
  const { isSignedIn, isLoaded } = useAuth();

  const turnaround =
    (turnaroundProp ?? actor.turnaround_url)?.trim() || null;

  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [includeTurnaround, setIncludeTurnaround] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [fullView, setFullView] = useState<{ src: string; alt: string } | null>(null);

  useEffect(() => {
    if (!fullView) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullView(null);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [fullView]);

  const openFull = useCallback((src: string, alt: string) => {
    setFullView({ src, alt });
  }, []);

  function headshotZoomButton(
    src: string,
    alt: string,
    loading: "eager" | "lazy",
    fit: "crop" | "full" | "still169" = "crop",
  ) {
    const imgClass =
      fit === "full" ? pairHeadshotImg : fit === "still169" ? still169Img : headshotImg;
    return (
      <button
        type="button"
        className="group relative block h-full w-full min-h-0 min-w-0 cursor-zoom-in overflow-hidden border-0 bg-transparent p-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metallic-orange/70"
        onClick={() => openFull(src, alt)}
        aria-label={`Open full photo: ${alt}`}
      >
        <img src={src} alt={alt} className={imgClass} loading={loading} decoding="async" />
        <span
          className="pointer-events-none absolute bottom-1.5 right-1.5 rounded-sm bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-metallic-orange/95 opacity-0 shadow transition group-hover:opacity-100 group-focus-visible:opacity-100"
          aria-hidden
        >
          Full photo
        </span>
      </button>
    );
  }

  function fullViewLayer() {
    if (!fullView) return null;
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/92 p-4 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-label="Full image viewer"
        onClick={() => setFullView(null)}
      >
        <div className="relative max-h-[92vh] max-w-[min(96vw,1800px)]" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            className="absolute right-2 top-2 z-10 rounded-sm border border-white/25 bg-black/85 px-3 py-1.5 text-xs font-semibold text-white/90 shadow transition hover:border-metallic-orange/50"
            onClick={() => setFullView(null)}
          >
            Close
          </button>
          <img
            src={fullView.src}
            alt={fullView.alt}
            className="max-h-[88vh] max-w-full object-contain object-center shadow-lg"
          />
        </div>
      </div>
    );
  }

  const toggleIndex = useCallback((index: number, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(index);
      else next.delete(index);
      return next;
    });
  }, []);

  const selectAllHeadshots = useCallback(() => {
    setSelected(new Set(urls.map((_, i) => i)));
  }, [urls]);

  const clearHeadshots = useCallback(() => {
    setSelected(new Set());
  }, []);

  const canDownload =
    isSignedIn &&
    (selected.size > 0 || (includeTurnaround && Boolean(turnaround)));

  const handleDownload = useCallback(async () => {
    if (!canDownload) return;
    const selectedCount = selected.size;
    setDownloadError(null);
    setDownloading(true);
    try {
      const res = await fetch(`/api/actors/${actor.id}/download-assets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          indices: [...selected].sort((a, b) => a - b),
          includeTurnaround: includeTurnaround && Boolean(turnaround),
        }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setDownloadError(j.error ?? `Download failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.replace(/[^\w\s-]+/g, "").trim() || "character"}-assets.zip`;
      a.click();
      URL.revokeObjectURL(url);
      trackEvent("download_selected_assets", {
        actorId: actor.id,
        selectedCount,
        includeTurnaround: includeTurnaround && Boolean(turnaround),
      });
    } catch {
      setDownloadError("Network error while downloading.");
      trackEvent("download_selected_assets_failed", {
        actorId: actor.id,
      });
    } finally {
      setDownloading(false);
    }
  }, [actor.id, canDownload, includeTurnaround, name, selected, turnaround]);

  const showControls = enableDownloadSelection && isLoaded && isSignedIn && n > 0;

  const wrapTile = useMemo(
    () =>
      function Wrap(child: ReactNode, index: number): ReactNode {
        if (!showControls) return child;
        return (
          <div className="flex w-full min-w-0 flex-col gap-2">
            {child}
            <ToggleRow
              checked={selected.has(index)}
              onChange={(on) => toggleIndex(index, on)}
              label="Include in download"
            />
          </div>
        );
      },
    [showControls, selected, toggleIndex],
  );

  function inner(node: React.ReactNode) {
    return (
      <>
        {node}
        {showControls ? (
          <div className="mt-2 space-y-2 border-t border-white/10 pt-3 pb-0">
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/70 md:text-sm">
              <button
                type="button"
                onClick={selectAllHeadshots}
                className="text-metallic-orange/90 transition hover:text-metallic-orange"
              >
                Select all headshots
              </button>
              <span aria-hidden className="text-white/20">
                |
              </span>
              <button
                type="button"
                onClick={clearHeadshots}
                className="transition hover:text-metallic-orange"
              >
                Clear headshots
              </button>
            </div>
            {turnaround && enableDownloadSelection ? (
              <div className="flex justify-center">
                <ToggleRow
                  checked={includeTurnaround}
                  onChange={setIncludeTurnaround}
                  label="Include turnaround sheet in download"
                />
              </div>
            ) : null}
            <div
              className={`flex flex-col items-center ${downloadError ? "gap-1" : "gap-0"}`}
            >
              <button
                type="button"
                disabled={!canDownload || downloading}
                onClick={handleDownload}
                className="min-h-10 rounded-sm border-2 border-metallic-orange bg-metallic-orange/10 px-5 py-2 text-xs font-semibold uppercase tracking-wider text-metallic-orange transition hover:bg-metallic-orange/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {downloading
                  ? "Preparing…"
                  : `Download selected${selected.size > 0 ? ` (${selected.size})` : ""}`}
              </button>
              {downloadError ? (
                <p className="text-center text-xs text-red-300/90" role="alert">
                  {downloadError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </>
    );
  }

  const turnaroundTile = turnaround ? (
    <div className={`${turnaroundFrame} p-1 sm:p-2`}>
      <button
        type="button"
        className="group relative flex h-full min-h-0 w-full cursor-zoom-in items-center justify-center border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-metallic-orange/70"
        onClick={() => openFull(turnaround, `${name} — turnaround sheet`)}
        aria-label="Open full turnaround image"
      >
        <img
          src={turnaround}
          alt={`${name} — 5-panel turnaround sheet`}
          className={turnaroundImg}
          loading="lazy"
          decoding="async"
        />
        <span
          className="pointer-events-none absolute bottom-8 right-1.5 rounded-sm bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-metallic-orange/95 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100 sm:bottom-10"
          aria-hidden
        >
          Full
        </span>
      </button>
      <span className="pointer-events-none absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/85 to-transparent px-2 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-metallic-orange/95">
        5-Panel turnaround
      </span>
    </div>
  ) : null;

  if (n === 0) {
    if (turnaroundTile) {
      return (
        <>
          {inner(
            <ul className="mx-auto grid w-full max-w-[1600px] list-none grid-cols-1 gap-3 p-0 sm:gap-4">
              <li className="min-w-0">{turnaroundTile}</li>
            </ul>,
          )}
          {fullViewLayer()}
        </>
      );
    }
    return (
      <>
        <div
          className={`${tile} flex min-h-[280px] flex-col items-center justify-center p-8 text-center md:min-h-[320px]`}
        >
          <span className="text-sm text-metallic-orange/90">No headshots yet</span>
          <span className="mt-2 max-w-sm text-xs text-white/40">
            Add image URLs in admin or Supabase to populate this gallery.
          </span>
        </div>
        {fullViewLayer()}
      </>
    );
  }

  if (n === 1 && !turnaroundTile) {
    return (
      <>
        {inner(
          wrapTile(
            <div className={singleCell}>
              {headshotZoomButton(urls[0]!, `${name} — primary headshot`, "eager", "crop")}
            </div>,
            0,
          ),
        )}
        {fullViewLayer()}
      </>
    );
  }

  if (n === 1 && turnaroundTile) {
    return (
      <>
        {inner(
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 sm:gap-5">
            {wrapTile(
              <div
                className={`${headshotCell} mx-auto w-full max-w-[min(100%,min(96vw,520px))] sm:max-w-[min(100%,560px)]`}
              >
                {headshotZoomButton(urls[0]!, `${name} — primary headshot`, "eager", "crop")}
              </div>,
              0,
            )}
            <div className="min-w-0">{turnaroundTile}</div>
          </div>,
        )}
        {fullViewLayer()}
      </>
    );
  }

  /** Exactly two headshots: side-by-side, full image in each cell (like earlier profile gallery). */
  if (n === 2) {
    const pairGrid = (
      <ul className="mx-auto grid w-full max-w-[1600px] list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 sm:gap-4 xl:gap-6">
        {urls.map((u, i) => (
          <li key={`${u}-${i}`} className="min-w-0">
            {wrapTile(
              <div className={pairHeadshotCell}>
                {headshotZoomButton(u, `${name} — headshot ${i + 1} of 2`, i === 0 ? "eager" : "lazy", "full")}
              </div>,
              i,
            )}
          </li>
        ))}
        {turnaroundTile ? (
          <li className="min-w-0 sm:col-span-2">{turnaroundTile}</li>
        ) : null}
      </ul>
    );
    return (
      <>
        {inner(pairGrid)}
        {fullViewLayer()}
      </>
    );
  }

  /**
   * Three headshots: canonical pack — [0] hero 9:16 (cover), [1][2] 16:9 stills (contain), optional turnaround below.
   */
  if (n === 3) {
    const tripleGrid = (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 sm:gap-5">
        <ul className="grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-3 sm:gap-4">
          <li className="min-w-0">
            {wrapTile(
              <div className={headshotCell}>
                {headshotZoomButton(urls[0]!, `${name} — hero headshot (9:16)`, "eager", "crop")}
              </div>,
              0,
            )}
          </li>
          <li className="min-w-0">
            {wrapTile(
              <div className={still169Cell}>
                {headshotZoomButton(urls[1]!, `${name} — still 1 (16:9)`, "lazy", "still169")}
              </div>,
              1,
            )}
          </li>
          <li className="min-w-0">
            {wrapTile(
              <div className={still169Cell}>
                {headshotZoomButton(urls[2]!, `${name} — still 2 (16:9)`, "lazy", "still169")}
              </div>,
              2,
            )}
          </li>
        </ul>
        {turnaroundTile ? <div className="min-w-0">{turnaroundTile}</div> : null}
      </div>
    );
    return (
      <>
        {inner(tripleGrid)}
        {fullViewLayer()}
      </>
    );
  }

  /* Four+ headshot URLs: legacy / overflow grid (cropped 9:16 tiles + lightbox); optional turnaround. */
  return (
    <>
      {inner(
        <ul className="mx-auto grid w-full max-w-[1600px] list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 sm:gap-4 xl:gap-6">
          {urls.map((u, i) => (
            <li key={`${u}-${i}`} className="min-w-0">
              {wrapTile(
                <div className={headshotCell}>
                  {headshotZoomButton(u, `${name} — headshot ${i + 1} of ${n}`, i === 0 ? "eager" : "lazy", "crop")}
                </div>,
                i,
              )}
            </li>
          ))}
          {turnaroundTile ? (
            <li className="min-w-0 sm:col-span-2">{turnaroundTile}</li>
          ) : null}
        </ul>,
      )}
      {fullViewLayer()}
    </>
  );
}
