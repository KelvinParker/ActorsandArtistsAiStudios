"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteActorAction } from "@/app/admin/cast/actions";
import { getGalleryCoverUrl } from "@/lib/actor-headshots";
import type { ActorRow } from "@/lib/types/actor";
import { downloadCharacterPack } from "./download-character-pack";

type Props = {
  actor: ActorRow;
  showAdminControls?: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: (actorId: string) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelectToggle?: (actorId: string) => void;
};

const titleStyle = {
  fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
} as const;

/**
 * Browse / search card: 9:16 headshot first, catalog name, then link to full profile.
 */
export function ActorGalleryTile({
  actor,
  showAdminControls = false,
  isFavorite = false,
  onToggleFavorite,
  selectable = false,
  selected = false,
  onSelectToggle,
}: Props) {
  const router = useRouter();
  const [deletePending, startDeleteTransition] = useTransition();
  const [downloadPackPending, startDownloadPackTransition] = useTransition();
  const name = actor.name;
  const primary = getGalleryCoverUrl(actor);

  function handleAdminDelete() {
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Remove “${name}” from the gallery? This cannot be undone.`,
      )
    ) {
      return;
    }
    startDeleteTransition(async () => {
      const result = await deleteActorAction(actor.id);
      if (result.ok) {
        router.refresh();
        return;
      }
      if (typeof window !== "undefined") {
        window.alert(result.error);
      }
    });
  }

  function handleDownloadPack() {
    startDownloadPackTransition(async () => {
      try {
        await downloadCharacterPack(actor.id, name);
      } catch (err) {
        if (typeof window !== "undefined") {
          window.alert(err instanceof Error ? err.message : "Download failed.");
        }
      }
    });
  }

  return (
    <article className="flex flex-col gap-3">
      <div className="relative">
        <div className="absolute right-2 top-2 z-20 flex gap-2">
          <button
            type="button"
            onClick={() => onToggleFavorite?.(actor.id)}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
            title={isFavorite ? "Remove favorite" : "Add favorite"}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-base leading-none transition ${
              isFavorite
                ? "border-metallic-orange/70 bg-metallic-orange/20 text-metallic-orange shadow-[0_0_0_1px_rgba(255,140,0,0.22)]"
                : "border-white/25 bg-black/65 text-white/80 hover:border-metallic-orange/45 hover:text-metallic-orange"
            }`}
          >
            {isFavorite ? "♥" : "♡"}
          </button>
          {selectable ? (
            <button
              type="button"
              onClick={() => onSelectToggle?.(actor.id)}
              aria-label={selected ? "Deselect character" : "Select character"}
              title={selected ? "Deselect" : "Select"}
              className={`rounded-sm border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                selected
                  ? "border-metallic-orange/70 bg-metallic-orange/20 text-metallic-orange"
                  : "border-white/25 bg-black/65 text-white/80 hover:border-metallic-orange/45 hover:text-metallic-orange"
              }`}
            >
              {selected ? "Selected" : "Select"}
            </button>
          ) : null}
        </div>
        <Link
          href={`/actors/${actor.id}`}
          className="group block rounded-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-metallic-orange/60"
        >
          <div className="relative aspect-[9/16] w-full overflow-hidden rounded-sm border border-white/10 bg-black/50 shadow-[0_0_0_1px_rgba(255,140,0,0.12)]">
          {primary ? (
            <img
              src={primary}
              alt={`${name} — headshot`}
              className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-end bg-gradient-to-b from-white/[0.05] to-black/70 p-4 text-center">
              <span className="text-xs text-metallic-orange/90">No headshot</span>
              <span className="mt-1 text-[10px] text-white/40">
                Add URLs in admin or Supabase.
              </span>
            </div>
          )}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[28%] bg-gradient-to-t from-black/75 to-transparent"
            aria-hidden
          />
        </div>
        </Link>
      </div>

      <div className="text-center">
        <Link
          href={`/actors/${actor.id}`}
          className="group inline-block focus:outline-none focus-visible:ring-2 focus-visible:ring-metallic-orange/60 rounded-sm"
        >
          <h3
            className="text-lg font-semibold tracking-tight text-metallic-orange transition group-hover:brightness-110 md:text-xl"
            style={titleStyle}
          >
            {name}
          </h3>
        </Link>
        <p className="mt-2">
          <Link
            href={`/actors/${actor.id}`}
            className="text-[11px] font-semibold uppercase tracking-[0.2em] text-metallic-orange/85 transition hover:text-metallic-orange"
          >
            View full profile →
          </Link>
        </p>
      </div>

      {showAdminControls ? (
        <div className="flex min-w-0 flex-nowrap justify-center gap-1">
          <Link
            href={`/admin/cast?edit=${actor.id}`}
            className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-sm border border-metallic-orange/50 bg-metallic-orange/15 px-1 text-center text-[6px] font-semibold uppercase leading-none tracking-normal text-metallic-orange transition hover:bg-metallic-orange/25 sm:px-1.5 sm:text-[9px] sm:tracking-wide md:text-[10px]"
          >
            Edit
          </Link>
          <button
            type="button"
            onClick={handleDownloadPack}
            disabled={!primary || downloadPackPending}
            className="inline-flex h-8 min-w-0 flex-1 items-center justify-center whitespace-nowrap rounded-sm border border-metallic-orange/45 bg-black/45 px-1.5 text-center text-[6px] font-semibold uppercase leading-none tracking-normal text-metallic-orange transition hover:bg-black/60 disabled:opacity-40 sm:text-[9px] sm:tracking-wide md:text-[10px]"
            title={primary ? undefined : "Headshot not available to package yet"}
          >
            {downloadPackPending ? "Preparing…" : "Download"}
          </button>
          <button
            type="button"
            disabled={deletePending}
            onClick={handleAdminDelete}
            className="inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-sm border border-red-500/45 bg-red-500/10 px-1 text-center text-[6px] font-semibold uppercase tracking-[0.06em] text-red-200/95 transition hover:bg-red-500/20 disabled:opacity-40 sm:px-1.5 sm:text-[9px] sm:tracking-wide md:text-[10px]"
          >
            {deletePending ? "…" : "Delete"}
          </button>
        </div>
      ) : null}
    </article>
  );
}
