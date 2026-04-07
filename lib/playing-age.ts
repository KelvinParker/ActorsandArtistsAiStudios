import type { ActorRow } from "@/lib/types/actor";

/** Normalize PostgREST `age_range` (text or occasional number). */
export function ageRangeTextFromRow(cell: unknown): string {
  if (cell == null) return "";
  if (typeof cell === "string") return cell.trim();
  if (typeof cell === "number" && Number.isFinite(cell)) {
    return String(Math.trunc(cell));
  }
  return String(cell).trim();
}

/** Inclusive bounds for playing age (infants through centenarians). */
export const MIN_AGE = 0;
export const MAX_AGE = 100;

/**
 * Parse "45-55", "45 – 55", "45 55", or a single integer into bounds.
 * Returns null if the string is empty or not a simple numeric range.
 */
export function numericAgeSpanFromString(raw: string): { min: number; max: number } | null {
  const t = raw.trim();
  if (!t) return null;
  const dash = /^(\d{1,3})\s*[-–]\s*(\d{1,3})$/.exec(t);
  if (dash) {
    let a = Number.parseInt(dash[1], 10);
    let b = Number.parseInt(dash[2], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (a > b) [a, b] = [b, a];
    if (a < MIN_AGE || b > MAX_AGE) return null;
    return { min: a, max: b };
  }
  const spaced = /^(\d{1,3})\s+(\d{1,3})$/.exec(t);
  if (spaced) {
    let a = Number.parseInt(spaced[1], 10);
    let b = Number.parseInt(spaced[2], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (a > b) [a, b] = [b, a];
    if (a < MIN_AGE || b > MAX_AGE) return null;
    return { min: a, max: b };
  }
  const single = /^(\d{1,3})$/.exec(t);
  if (single) {
    const n = Number.parseInt(single[1], 10);
    if (!Number.isFinite(n) || n < MIN_AGE || n > MAX_AGE) return null;
    return { min: n, max: n };
  }
  return null;
}

/**
 * Numeric age-range span for overlap checks: DB min/max, else parse {@link ActorRow.age_range},
 * else integers from legacy `age` text.
 */
export function actorPlayingAgeSpan(
  actor: ActorRow,
): { min: number; max: number } | null {
  const min = actor.age_range_min;
  const max = actor.age_range_max;
  if (
    min != null &&
    max != null &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min <= max
  ) {
    return { min, max };
  }
  const ar = ageRangeTextFromRow(actor.age_range);
  if (ar) {
    const parsed = numericAgeSpanFromString(ar);
    if (parsed) return parsed;
  }
  const t = actor.age?.trim();
  if (!t) return null;
  const matches = t.match(/\d{1,3}/g);
  if (!matches?.length) return null;
  const nums = matches
    .map((x) => Number.parseInt(x, 10))
    .filter((n) => n >= MIN_AGE && n <= MAX_AGE);
  if (nums.length === 0) return null;
  if (nums.length === 1) return { min: nums[0], max: nums[0] };
  return { min: Math.min(...nums), max: Math.max(...nums) };
}

/** Display string: typable `age_range` first, else numeric band from columns, else legacy `age`. */
export function formatPlayingAgeRange(actor: ActorRow): string | null {
  const ar = ageRangeTextFromRow(actor.age_range);
  if (ar) return ar;
  const min = actor.age_range_min;
  const max = actor.age_range_max;
  if (min == null || max == null) return null;
  if (Number.isNaN(min) || Number.isNaN(max) || min > max) return null;
  return `${min}-${max}`;
}

/** Tokens for gallery text search (years in band + raw `age_range`). */
export function playingAgeSearchBlob(actor: ActorRow): string {
  const parts: string[] = [];
  const ar = ageRangeTextFromRow(actor.age_range);
  if (ar) {
    parts.push(ar.toLowerCase());
    const dashNorm = ar.replace(/\s*[-–]\s*/g, "-");
    if (dashNorm !== ar.toLowerCase()) parts.push(dashNorm.toLowerCase());
  }
  const span = actorPlayingAgeSpan(actor);
  if (span) {
    const { min, max } = span;
    parts.push(`${min}-${max}`, `${min}–${max}`, `ages ${min} to ${max}`);
    for (let n = min; n <= max; n++) parts.push(String(n));
  }
  return parts.join(" ");
}

/**
 * Seeker range [seekMin, seekMax] overlaps actor playing range.
 * Returns true when seek filter is off (null bounds).
 */
export function seekOverlapsPlayingRange(
  actor: ActorRow,
  seekMin: number | null,
  seekMax: number | null,
): boolean {
  if (seekMin == null || seekMax == null) return true;
  if (Number.isNaN(seekMin) || Number.isNaN(seekMax) || seekMin > seekMax) return true;
  const span = actorPlayingAgeSpan(actor);
  if (!span) return false;
  return seekMin <= span.max && seekMax >= span.min;
}

/**
 * Lone numeric tokens in this band may mean “seek this age” alongside other words.
 * Very low ages are allowed for child casting; prefer “6 ft” for height to avoid “male 6” as age 6.
 */
const IMPLICIT_SEEK_AGE_TOKEN_MIN = 0;

function clampPlayingAgePair(a: number, b: number): { min: number; max: number } | null {
  let lo = Math.trunc(a);
  let hi = Math.trunc(b);
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  if (lo > hi) [lo, hi] = [hi, lo];
  if (lo < MIN_AGE || hi > MAX_AGE) return null;
  return { min: lo, max: hi };
}

function clampPlayingAgeOne(n: number): number | null {
  const t = Math.trunc(n);
  if (!Number.isFinite(t) || t < MIN_AGE || t > MAX_AGE) return null;
  return t;
}

/**
 * Parse gallery search for a seeker age or band. Matching text is removed from
 * {@link stripped} so remaining words still use substring AND matching.
 */
export type SeekerAgeFromQuery =
  | { hasFilter: false; stripped: string }
  | { hasFilter: true; seekMin: number; seekMax: number; stripped: string };

export function parseSeekerAgeFromQuery(raw: string): SeekerAgeFromQuery {
  const s = raw.trim();
  if (!s) return { hasFilter: false, stripped: "" };

  const tryHit = (
    re: RegExp,
    kind: "range" | "point",
  ): SeekerAgeFromQuery | null => {
    const m = s.match(re);
    if (!m) return null;
    if (kind === "range") {
      const span = clampPlayingAgePair(
        Number.parseInt(m[1], 10),
        Number.parseInt(m[2], 10),
      );
      if (!span) return null;
      const stripped = s.replace(re, " ").replace(/\s+/g, " ").trim();
      return {
        hasFilter: true,
        seekMin: span.min,
        seekMax: span.max,
        stripped,
      };
    }
    const p = clampPlayingAgeOne(Number.parseInt(m[1], 10));
    if (p == null) return null;
    const stripped = s.replace(re, " ").replace(/\s+/g, " ").trim();
    return { hasFilter: true, seekMin: p, seekMax: p, stripped };
  };

  const fullStringRange = tryHit(
    /^\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\s*$/i,
    "range",
  );
  if (fullStringRange?.hasFilter) return fullStringRange;

  const fullStringPoint = tryHit(/^\s*(\d{1,3})\s*$/i, "point");
  if (fullStringPoint?.hasFilter) return fullStringPoint;

  const inline: Array<{ re: RegExp; kind: "range" | "point" }> = [
    {
      re: /\b(?:playing\s+)?age(?:s)?\s*(\d{1,3})\s*[-–]\s*(\d{1,3})\b/i,
      kind: "range",
    },
    { re: /\b(?:between|from)\s+(\d{1,3})\s+and\s+(\d{1,3})\b/i, kind: "range" },
    { re: /\b(?:playing\s+)?age(?:s)?\s*(\d{1,3})\b/i, kind: "point" },
    { re: /\b(\d{1,3})\s*(?:years?\s+old|yo|y\.o\.|y\/o)\b/i, kind: "point" },
  ];

  for (const { re, kind } of inline) {
    const hit = tryHit(re, kind);
    if (hit?.hasFilter) return hit;
  }

  const tokens = s.toLowerCase().split(/\s+/).filter(Boolean);
  const numericTokens = tokens.filter((t) => /^\d{1,3}$/.test(t));
  const ages = numericTokens
    .map((t) => Number.parseInt(t, 10))
    .filter((n) => n >= IMPLICIT_SEEK_AGE_TOKEN_MIN && n <= MAX_AGE);
  if (ages.length === 1) {
    const n = ages[0];
    const stripped = tokens.filter((t) => t !== String(n)).join(" ");
    return { hasFilter: true, seekMin: n, seekMax: n, stripped };
  }

  return { hasFilter: false, stripped: s };
}

export type ParsedAgeRangeText =
  | { ok: true; text: string | null; min: number | null; max: number | null }
  | { ok: false; error: string };

/**
 * Single typable field (admin / Supabase). Parses 45-55 (or one number) into min/max;
 * other text is stored for display only (min/max cleared).
 */
export function parseAgeRangeText(raw: string): ParsedAgeRangeText {
  const s = raw.trim();
  if (!s) {
    return { ok: true, text: null, min: null, max: null };
  }
  const span = numericAgeSpanFromString(s);
  if (span) {
    return {
      ok: true,
      text: `${span.min}-${span.max}`,
      min: span.min,
      max: span.max,
    };
  }
  return { ok: true, text: s, min: null, max: null };
}

/**
 * Legacy two-field admin shape (low / high). Prefer {@link parseAgeRangeText} with one
 * `age_range` input.
 */
export function parseAgeRangeFromForm(
  minRaw: string,
  maxRaw: string,
): ParsedAgeRangeText {
  const minS = minRaw.trim();
  const maxS = maxRaw.trim();
  if (minS === "" && maxS === "") {
    return { ok: true, text: null, min: null, max: null };
  }
  if (minS === "" || maxS === "") {
    return {
      ok: false,
      error: "Set both age range low and high, or leave both empty.",
    };
  }
  return parseAgeRangeText(`${minS}-${maxS}`);
}
