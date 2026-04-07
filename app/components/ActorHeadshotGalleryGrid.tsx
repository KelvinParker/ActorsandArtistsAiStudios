"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
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
const img =
  "h-full w-full object-contain object-center bg-black/30";

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
          <div className="flex flex-col gap-2">
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

  if (n === 0) {
    return (
      <div
        className={`${tile} flex min-h-[280px] flex-col items-center justify-center p-8 text-center md:min-h-[320px]`}
      >
        <span className="text-sm text-metallic-orange/90">No headshots yet</span>
        <span className="mt-2 max-w-sm text-xs text-white/40">
          Add image URLs in admin or Supabase to populate this gallery.
        </span>
      </div>
    );
  }

  const inner = (node: React.ReactNode) => (
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

  if (n === 1) {
    return inner(
      wrapTile(
        <div
          className={`${tile} flex min-h-[min(50vh,420px)] items-center justify-center p-2 md:min-h-[min(55vh,520px)]`}
        >
          <img
            src={urls[0]}
            alt={`${name} — primary headshot`}
            className={`${img} max-h-[min(72vh,720px)] w-auto max-w-full`}
            loading="eager"
            decoding="async"
          />
        </div>,
        0,
      ),
    );
  }

  if (n === 2) {
    return inner(
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {urls.map((u, i) => (
          <div key={`${u}-${i}`}>
            {wrapTile(
              <div
                className={`${tile} flex min-h-[220px] items-center justify-center p-2 sm:min-h-[280px] md:min-h-[320px]`}
              >
                <img
                  src={u}
                  alt={`${name} — headshot ${i + 1} of 2`}
                  className={img}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              </div>,
              i,
            )}
          </div>
        ))}
      </div>,
    );
  }

  if (n === 3) {
    return inner(
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:grid-rows-2 sm:gap-4 lg:min-h-[min(56vh,600px)]">
        <div className="sm:row-span-2">
          {wrapTile(
            <div
              className={`${tile} flex min-h-[280px] items-center justify-center p-2 sm:min-h-0`}
            >
              <img
                src={urls[0]}
                alt={`${name} — primary headshot`}
                className={`${img} max-h-[min(60vh,620px)] sm:max-h-full`}
                loading="eager"
                decoding="async"
              />
            </div>,
            0,
          )}
        </div>
        <div>
          {wrapTile(
            <div
              className={`${tile} flex min-h-[200px] items-center justify-center p-2 sm:min-h-0`}
            >
              <img
                src={urls[1]}
                alt={`${name} — headshot 2 of 3`}
                className={img}
                loading="lazy"
                decoding="async"
              />
            </div>,
            1,
          )}
        </div>
        <div>
          {wrapTile(
            <div
              className={`${tile} flex min-h-[200px] items-center justify-center p-2 sm:min-h-0`}
            >
              <img
                src={urls[2]}
                alt={`${name} — headshot 3 of 3`}
                className={img}
                loading="lazy"
                decoding="async"
              />
            </div>,
            2,
          )}
        </div>
      </div>,
    );
  }

  if (n === 4) {
    return inner(
      <div className="grid grid-cols-2 grid-rows-2 gap-3 sm:gap-4">
        {urls.map((u, i) => (
          <div key={`${u}-${i}`}>
            {wrapTile(
              <div
                className={`${tile} flex min-h-[180px] items-center justify-center p-2 sm:min-h-[220px] md:min-h-[260px]`}
              >
                <img
                  src={u}
                  alt={`${name} — headshot ${i + 1} of 4`}
                  className={img}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                />
              </div>,
              i,
            )}
          </div>
        ))}
      </div>,
    );
  }

  /* 5 headshots: responsive grid */
  return inner(
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
      {urls.map((u, i) => (
        <div key={`${u}-${i}`}>
          {wrapTile(
            <div
              className={`${tile} flex min-h-[160px] items-center justify-center p-2 sm:min-h-[200px] md:min-h-[240px]`}
            >
              <img
                src={u}
                alt={`${name} — headshot ${i + 1} of 5`}
                className={img}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
              />
            </div>,
            i,
          )}
        </div>
      ))}
    </div>,
  );
}
