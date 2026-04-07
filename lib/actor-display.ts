import { ageRangeTextFromRow } from "@/lib/playing-age";

/** Display a single stat from DB; empty / null → N/A. */
export function statOrNA(value: string | null | undefined): string {
  const t = typeof value === "string" ? value.trim() : "";
  return t.length > 0 ? t : "N/A";
}

/** Race column, falling back to ethnicity for the same casting slot. */
export function raceDisplay(actor: {
  race?: string | null;
  ethnicity?: string | null;
}): string {
  const r = statOrNA(actor.race);
  if (r !== "N/A") return r;
  return statOrNA(actor.ethnicity);
}

/** `age_range` text (e.g. 45-55), else numeric columns, else legacy `age`. */
export function playingAgeDisplay(actor: {
  age_range?: string | null;
  age_range_min?: number | null;
  age_range_max?: number | null;
  age?: string | null;
}): string {
  const ar = ageRangeTextFromRow(actor.age_range);
  if (ar.length > 0) return ar;
  const min = actor.age_range_min;
  const max = actor.age_range_max;
  if (
    min != null &&
    max != null &&
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min <= max
  ) {
    return `${min}-${max}`;
  }
  return statOrNA(actor.age);
}
