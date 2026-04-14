import type { ActorRow } from "@/lib/types/actor";

function dedupeOrdered(urls: string[], max: number): string[] {
  const seen = new Set<string>();
  return urls
    .filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    })
    .slice(0, max);
}

function normalizedHeadshotArray(actor: ActorRow): string[] {
  return (actor.headshot_urls ?? [])
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);
}

/**
 * Home / search gallery tile: only the first public image.
 * Uses `headshot_urls[0]` when the array has any value; otherwise `headshot_url`.
 */
export function getGalleryCoverUrl(actor: ActorRow): string | null {
  const arr = normalizedHeadshotArray(actor);
  if (arr.length > 0) return arr[0];
  const legacy = actor.headshot_url?.trim();
  return legacy || null;
}

function columnExtras(actor: ActorRow): string[] {
  return [
    actor.headshot_2_url,
    actor.headshot_3_url,
    actor.headshot_4_url,
    actor.headshot_5_url,
  ]
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);
}

/**
 * Actor profile + downloads: up to five images in order.
 * Uses `headshot_urls` first (cover + in-array extras), then appends
 * `headshot_2_url`…`headshot_5_url` from the Table Editor so those still show.
 * Gallery tile still uses only {@link getGalleryCoverUrl}.
 *
 * **Production pack (minimum 4 assets):** `headshot_urls[0]` = master **9:16** hero;
 * `headshot_urls[1]` and `[2]` = **16:9** stills; plus `turnaround_url` = **16:9 horizontal** sheet.
 */
export function buildProfileImageUrls(actor: ActorRow): string[] {
  const arr = normalizedHeadshotArray(actor);
  const extras = columnExtras(actor);

  if (arr.length > 0) {
    return dedupeOrdered([...arr, ...extras], 5);
  }

  const legacyCols = [actor.headshot_url, ...extras]
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);

  return dedupeOrdered(legacyCols, 5);
}

/**
 * Maps five admin form slots into DB fields: ordered `headshot_urls` plus
 * `headshot_url` mirror of [0]; clears legacy `headshot_*_url` columns.
 */
export function headshotPayloadFromSlots(slots: (string | null)[]): {
  headshot_url: string | null;
  headshot_urls: string[];
  headshot_2_url: string | null;
  headshot_3_url: string | null;
  headshot_4_url: string | null;
  headshot_5_url: string | null;
} {
  const compact = slots
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .map((s) => s || null)
    .filter((s): s is string => Boolean(s));

  return {
    headshot_url: compact[0] ?? null,
    headshot_urls: compact,
    // Mirror ordered slots into legacy columns for clearer Table Editor visibility.
    headshot_2_url: compact[1] ?? null,
    headshot_3_url: compact[2] ?? null,
    headshot_4_url: compact[3] ?? null,
    headshot_5_url: compact[4] ?? null,
  };
}
