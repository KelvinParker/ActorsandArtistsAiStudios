import { sanitizeRtfImportFieldText } from "@/lib/sanitize-rtf-import-field";

/**
 * Controlled vocabularies for admin casting **Ethnicity** (stored in `actors.ethnicity`).
 * Labels align with `taxonomy_terms` category `race_ethnicity` in
 * `supabase/migrations/20260407120100_taxonomy_seed.sql`.
 */

export const CASTING_SEX_OPTIONS = [
  "Male",
  "Female",
  "Non-binary",
  "Trans man",
  "Trans woman",
  "Genderqueer / gender non-conforming",
  "Agender",
  "Two-Spirit",
  "Prefer not to specify",
  "N/A",
] as const;

/** Imperial heights for breakdowns (4'10"–7'0"); matches stored strings like 6'1". */
export function castingHeightFeetInchesOptions(): string[] {
  const out: string[] = [];
  for (let ft = 4; ft <= 7; ft++) {
    for (let inch = 0; inch < 12; inch++) {
      if (ft === 4 && inch < 10) continue;
      if (ft === 7 && inch > 0) break;
      out.push(`${ft}'${inch}"`);
    }
  }
  return out;
}

const RACE_ETHNICITY_RAW = [
  "African American",
  "African (unspecified region)",
  "Afghan",
  "Afro-Caribbean",
  "Afro-Latino",
  "Arab",
  "Armenian",
  "Bangladeshi",
  "Biracial",
  "Black",
  "Black British",
  "Black Canadian",
  "Cambodian",
  "Central Asian heritage",
  "Chinese",
  "Cuban",
  "Dominican",
  "East African heritage",
  "Egyptian",
  "Ethiopian",
  "Filipino",
  "French Canadian",
  "German",
  "Ghanaian",
  "Greek",
  "Guatemalan",
  "Haitian",
  "Hmong",
  "Indian (South Asian)",
  "Indigenous (Central/South American)",
  "Indigenous Australian",
  "Inuit",
  "Iranian",
  "Irish",
  "Israeli",
  "Italian",
  "Jamaican",
  "Japanese",
  "Jewish (ethnic/cultural)",
  "Korean",
  "Latin American",
  "Latino",
  "Lebanese",
  "Marshallese",
  "Mexican",
  "Middle Eastern",
  "Multiracial",
  "Native American",
  "Native Hawaiian",
  "Nigerian",
  "North African heritage",
  "Pacific Islander",
  "Pakistani",
  "Palestinian",
  "Persian",
  "Polish",
  "Portuguese",
  "Puerto Rican",
  "Romani",
  "Russian",
  "Salvadoran",
  "Samoan",
  "Scottish",
  "Somali",
  "South Asian",
  "Southeast Asian",
  "Southern African heritage",
  "Spanish",
  "Sri Lankan",
  "Syrian",
  "Taiwanese",
  "Thai",
  "Tongan",
  "Turkish",
  "Ukrainian",
  "Vietnamese",
  "Welsh",
  "West African heritage",
  "White",
  "White British",
  "White European (general)",
  "Prefer not to specify",
] as const;

/** Same labels as taxonomy `race_ethnicity` seed + N/A (matches Postgres enum + Table Editor). */
const PREFER_NOT = "Prefer not to specify";
export const RACE_ETHNICITY_OPTIONS: string[] = [
  ...RACE_ETHNICITY_RAW.filter((x) => x !== PREFER_NOT).sort((a, b) =>
    a.localeCompare(b),
  ),
  PREFER_NOT,
  "N/A",
];

const RACE_ETHNICITY_CANON = new Set(RACE_ETHNICITY_OPTIONS);

const SEX_OPTIONS: string[] = [...CASTING_SEX_OPTIONS];
const SEX_CANON = new Set(SEX_OPTIONS);

/** Re-export for call sites that predate {@link sanitizeRtfImportFieldText}. */
export const sanitizeCastingEnumRaw = sanitizeRtfImportFieldText;

/**
 * Map folder / RTF / model drift to a label Postgres accepts as `casting_race_ethnicity`.
 */
export function coerceCastingRaceEthnicityEnum(raw: string | null | undefined): string {
  const s = sanitizeCastingEnumRaw(raw);
  if (!s) return "N/A";
  if (RACE_ETHNICITY_CANON.has(s)) return s;
  const low = s.toLowerCase();
  for (const opt of RACE_ETHNICITY_OPTIONS) {
    if (opt.toLowerCase() === low) return opt;
  }
  return "N/A";
}

/** Postgres `casting_sex` — same labels as {@link CASTING_SEX_OPTIONS}. */
export function coerceCastingSexEnum(raw: string | null | undefined): string {
  const s = sanitizeCastingEnumRaw(raw);
  if (!s) return "N/A";
  if (SEX_CANON.has(s)) return s;
  const low = s.toLowerCase();
  for (const opt of SEX_OPTIONS) {
    if (opt.toLowerCase() === low) return opt;
  }
  return "N/A";
}

/** Height <select> options: N/A first (matches DB default + enum), then 4'10"–7'0". */
export function castingHeightFormOptions(): string[] {
  return ["N/A", ...castingHeightFeetInchesOptions()];
}

/** Postgres `casting_height` — N/A + 4'10"–7'0". */
export function coerceCastingHeightEnum(raw: string | null | undefined): string {
  const opts = castingHeightFormOptions();
  const canon = new Set(opts);
  const s = sanitizeCastingEnumRaw(raw);
  if (!s) return "N/A";
  if (canon.has(s)) return s;
  const low = s.toLowerCase();
  for (const opt of opts) {
    if (opt.toLowerCase() === low) return opt;
  }
  return "N/A";
}

export function optionsWithCurrent(
  base: readonly string[],
  current: string | null | undefined,
): string[] {
  const c = current?.trim();
  if (!c) return [...base];
  if (base.includes(c)) return [...base];
  return [c, ...base];
}
