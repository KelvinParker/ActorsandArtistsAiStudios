"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  ageRangeTextFromRow,
  parseSeekerAgeFromQuery,
  playingAgeSearchBlob,
  seekOverlapsPlayingRange,
} from "@/lib/playing-age";
import { trackEvent } from "@/lib/analytics";
import type { ActorRow } from "@/lib/types/actor";
import { ActorGalleryTile } from "./ActorGalleryTile";
import { downloadCharacterPack } from "./download-character-pack";

type Props = {
  actors: ActorRow[];
  /** When true, gallery cards show Edit / Delete for casting admin. */
  isAdmin?: boolean;
  /** Optional deep-link to start on favorites tab (`/?view=favs`). */
  initialFavoritesOnly?: boolean;
};

const FAVORITES_STORAGE_KEY_PREFIX = "actors-and-artists:favorites:v1";

function favoritesStorageKey(userId: string | null | undefined): string {
  if (userId && userId.trim()) {
    return `${FAVORITES_STORAGE_KEY_PREFIX}:user:${userId}`;
  }
  return `${FAVORITES_STORAGE_KEY_PREFIX}:guest`;
}

function persistFavoritesToStorage(ids: Set<string>, userId: string | null | undefined) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(favoritesStorageKey(userId), JSON.stringify([...ids]));
}

/** Extra tokens so "6 ft 1" matches stored `6'1"`. */
function heightSearchAliases(height: string | null | undefined): string[] {
  const t = height?.trim();
  if (!t) return [];
  const out = [t];
  const m = /^(\d+)[''](\d{1,2})\s*"?\s*$/i.exec(t);
  if (m) {
    const ft = m[1];
    const inch = m[2];
    out.push(`${ft} ft ${inch}`, `${ft}ft ${inch}`, `${ft} foot ${inch}`);
  }
  return out;
}

function searchBlobFor(actor: ActorRow): string {
  const playingBlob = playingAgeSearchBlob(actor);
  const parts = [
    actor.name,
    ...(actor.search_keywords?.filter(Boolean) ?? []),
    ...(actor.taxonomy ?? []).map((t) => t.label),
    actor.race?.trim(),
    playingBlob,
    ageRangeTextFromRow(actor.age_range),
    actor.age?.trim(),
    ...heightSearchAliases(actor.height),
    actor.weight?.trim(),
    actor.sex?.trim(),
    actor.speech?.trim(),
    ...(actor.traits?.filter(Boolean) ?? []),
    ...(actor.tags?.filter(Boolean) ?? []),
  ].filter(Boolean);
  return parts.join(" ").toLowerCase();
}

export function CharacterGallery({
  actors,
  isAdmin = false,
  initialFavoritesOnly = false,
}: Props) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [query, setQuery] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoritesHydrated, setFavoritesHydrated] = useState(false);
  const [favoritesOnly, setFavoritesOnly] = useState(initialFavoritesOnly);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkPending, startBulkTransition] = useTransition();

  useEffect(() => {
    if (!isLoaded) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(favoritesStorageKey(userId));
      if (!raw) {
        setFavoriteIds(new Set());
      } else {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
          setFavoriteIds(new Set());
        } else {
          const ids = parsed.filter((x): x is string => typeof x === "string");
          setFavoriteIds(new Set(ids));
        }
      }
    } catch {
      // ignore bad storage values
      setFavoriteIds(new Set());
    } finally {
      setFavoritesHydrated(true);
    }
  }, [isLoaded, isSignedIn, userId]);

  useEffect(() => {
    if (!favoritesHydrated) return;
    if (typeof window === "undefined") return;
    persistFavoritesToStorage(favoriteIds, userId);
  }, [favoriteIds, isLoaded, isSignedIn, favoritesHydrated, userId]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/favorites", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { actorIds?: string[] };
        const ids = Array.isArray(payload.actorIds)
          ? payload.actorIds.filter((x): x is string => typeof x === "string")
          : [];
        if (!cancelled) setFavoriteIds(new Set(ids));
      } catch {
        // ignore sync errors; user can still browse
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  const blobs = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of actors) {
      m.set(a.id, searchBlobFor(a));
    }
    return m;
  }, [actors]);

  const filtered = useMemo(() => {
    const raw = query.trim();
    if (!raw) return actors;

    const ageParsed = parseSeekerAgeFromQuery(raw);
    const seekMin = ageParsed.hasFilter ? ageParsed.seekMin : null;
    const seekMax = ageParsed.hasFilter ? ageParsed.seekMax : null;
    const textForTokens = ageParsed.hasFilter
      ? ageParsed.stripped.trim().toLowerCase()
      : raw.toLowerCase();
    const tokens = textForTokens.split(/\s+/).filter(Boolean);

    return actors.filter((a) => {
      if (ageParsed.hasFilter) {
        if (!seekOverlapsPlayingRange(a, seekMin, seekMax)) return false;
      }
      if (tokens.length === 0) return true;
      const blob = blobs.get(a.id) ?? "";
      return tokens.every((t) => blob.includes(t));
    });
  }, [actors, query, blobs]);

  const visible = useMemo(() => {
    if (!favoritesOnly) return filtered;
    if (favoriteIds.size === 0) return filtered;
    return filtered.filter((a) => favoriteIds.has(a.id));
  }, [filtered, favoritesOnly, favoriteIds]);

  const favoriteActors = useMemo(
    () => actors.filter((a) => favoriteIds.has(a.id)),
    [actors, favoriteIds],
  );

  const selectableIds = useMemo(
    () => new Set(visible.map((a) => a.id)),
    [visible],
  );

  useEffect(() => {
    if (!favoritesOnly) return;
    setSelectedIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (selectableIds.has(id)) next.add(id);
      }
      return next;
    });
  }, [favoritesOnly, selectableIds]);

  async function toggleFavorite(actorId: string) {
    const shouldAdd = !favoriteIds.has(actorId);
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(actorId)) {
        next.delete(actorId);
      } else {
        next.add(actorId);
      }
      // Persist immediately so quick navigation does not drop user favorites.
      persistFavoritesToStorage(next, userId);
      return next;
    });

    if (!isLoaded || !isSignedIn) {
      trackEvent("fav_toggle", {
        actorId,
        action: shouldAdd ? "add" : "remove",
        signedIn: false,
      });
      return;
    }

    try {
      const res = shouldAdd
        ? await fetch("/api/favorites", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            keepalive: true,
            body: JSON.stringify({ actorId }),
          })
        : await fetch(`/api/favorites/${actorId}`, {
            method: "DELETE",
            keepalive: true,
          });
      if (!res.ok) {
        throw new Error("Favorite sync failed");
      }
      trackEvent("fav_toggle", {
        actorId,
        action: shouldAdd ? "add" : "remove",
        signedIn: true,
      });
    } catch {
      // keep local favorite state so user does not lose shortlist context
      if (typeof window !== "undefined") {
        window.alert(
          "Could not sync favorites right now. Your local selection is kept.",
        );
      }
    }
  }

  function toggleSelected(actorId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(actorId)) next.delete(actorId);
      else next.add(actorId);
      return next;
    });
  }

  function downloadActorsSequentially(list: ActorRow[]) {
    startBulkTransition(async () => {
      trackEvent("download_bulk_started", {
        count: list.length,
        mode:
          favoritesOnly && selectedIds.size > 0
            ? "selected"
            : favoritesOnly
              ? "all_favs"
              : "list",
      });
      for (const actor of list) {
        try {
          await downloadCharacterPack(actor.id, actor.name);
          await new Promise((r) => setTimeout(r, 250));
        } catch (err) {
          if (typeof window !== "undefined") {
            window.alert(
              err instanceof Error
                ? `Download failed for ${actor.name}: ${err.message}`
                : `Download failed for ${actor.name}`,
            );
          }
          trackEvent("download_bulk_failed", {
            actorId: actor.id,
            actorName: actor.name,
          });
          return;
        }
      }
      trackEvent("download_bulk_completed", {
        count: list.length,
      });
    });
  }

  if (actors.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mx-auto mb-8 w-full max-w-xl">
        <label
          htmlFor="gallery-character-search"
          className="mb-1.5 block text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-metallic-orange/90 sm:text-left"
        >
          Search gallery
        </label>
        <p className="mb-2 text-center text-xs leading-relaxed text-white/45 sm:text-left">
          Matches name, sex, race / ethnicity, height, weight, tags, traits,
          taxonomy, keywords, and speech. For{" "}
          <span className="text-white/55">playing age</span>, use{" "}
          <span className="text-white/55">age 45</span>,{" "}
          <span className="text-white/55">45–55</span> (whole query),{" "}
          <span className="text-white/55">45 yo</span>, or a single number{" "}
          <span className="text-white/55">45</span> /{" "}
          <span className="text-white/55">male 45</span> — numeric tokens 0–100 work
          the same way. Casting saves a
          range per character; anyone whose band includes that age appears. Other
          words still must all match.
        </p>
        <input
          id="gallery-character-search"
          type="search"
          autoComplete="off"
          placeholder="e.g. male, African American, 6'1, age 45, short hair"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-sm border border-white/15 bg-black/55 py-2.5 pl-3 pr-3 text-sm text-white shadow-inner placeholder:text-white/35 focus:border-metallic-orange/50 focus:outline-none focus:ring-1 focus:ring-metallic-orange/30"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setFavoritesOnly(false)}
            className={`rounded-sm border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
              !favoritesOnly
                ? "border-metallic-orange/70 bg-metallic-orange/20 text-metallic-orange"
                : "border-white/20 bg-black/40 text-white/70 hover:border-metallic-orange/40 hover:text-metallic-orange"
            }`}
          >
            All ({filtered.length})
          </button>
          <button
            type="button"
            onClick={() => setFavoritesOnly(true)}
            className={`rounded-sm border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] transition ${
              favoritesOnly
                ? "border-metallic-orange/70 bg-metallic-orange/20 text-metallic-orange"
                : "border-white/20 bg-black/40 text-white/70 hover:border-metallic-orange/40 hover:text-metallic-orange"
            }`}
          >
            Favs ({favoriteActors.length})
          </button>
          <button
            type="button"
            disabled={favoriteIds.size === 0}
            onClick={() => {
              setFavoriteIds(new Set());
              setSelectedIds(new Set());
            }}
            className="rounded-sm border border-white/25 bg-black/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:border-metallic-orange/45 hover:text-metallic-orange hover:bg-black/70 disabled:opacity-40"
          >
            Deselect favs
          </button>
          {favoritesOnly ? (
            <>
              <p className="w-full text-[11px] text-white/45">
                Select cards, then use <span className="text-white/65">Download selected</span>{" "}
                or export the full shortlist.
              </p>
              <button
                type="button"
                disabled={bulkPending || favoriteActors.length === 0}
                onClick={() => {
                  trackEvent("download_all_favs_click", {
                    count: favoriteActors.length,
                  });
                  downloadActorsSequentially(favoriteActors);
                }}
                className="rounded-sm border border-white/25 bg-black/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:border-metallic-orange/45 hover:text-metallic-orange hover:bg-black/70 disabled:opacity-40"
              >
                {bulkPending ? "Preparing…" : "Download all favs"}
              </button>
              <button
                type="button"
                disabled={bulkPending || selectedIds.size === 0}
                onClick={() => {
                  const selectedActors = visible.filter((a) => selectedIds.has(a.id));
                  trackEvent("download_selected_click", {
                    count: selectedActors.length,
                  });
                  downloadActorsSequentially(selectedActors);
                }}
                className="rounded-sm border border-white/25 bg-black/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:border-metallic-orange/45 hover:text-metallic-orange hover:bg-black/70 disabled:opacity-40"
              >
                {bulkPending
                  ? "Preparing…"
                  : `Download selected (${selectedIds.size})`}
              </button>
              <button
                type="button"
                disabled={selectedIds.size === 0}
                onClick={() => setSelectedIds(new Set())}
                className="rounded-sm border border-white/25 bg-black/50 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/80 transition hover:border-metallic-orange/45 hover:text-metallic-orange hover:bg-black/70 disabled:opacity-40"
              >
                Deselect all
              </button>
            </>
          ) : null}
        </div>
      </div>

      {visible.length === 0 ? (
        <p className="mb-10 text-center text-sm text-white/50">
          {favoritesOnly
            ? "No favorites match this search yet. Clear search or add more favorites."
            : `No characters match “${query.trim()}”. Try another name or keyword.`}
        </p>
      ) : (
        <>
          {favoritesOnly && favoriteIds.size === 0 ? (
            <p className="mb-4 text-center text-sm text-white/55">
              No favorites yet — showing gallery so you can start favoriting.
            </p>
          ) : null}
        <ul className="mx-auto grid max-w-[1600px] grid-cols-2 gap-5 sm:gap-6 md:grid-cols-3 md:gap-8 lg:grid-cols-4 xl:gap-10">
          {visible.map((actor) => (
            <li key={actor.id}>
              <ActorGalleryTile
                actor={actor}
                showAdminControls={isAdmin}
                isFavorite={favoriteIds.has(actor.id)}
                onToggleFavorite={toggleFavorite}
                selectable={favoritesOnly}
                selected={selectedIds.has(actor.id)}
                onSelectToggle={toggleSelected}
              />
            </li>
          ))}
        </ul>
        </>
      )}
    </>
  );
}
