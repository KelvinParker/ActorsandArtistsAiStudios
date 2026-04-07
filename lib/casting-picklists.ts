/**
 * Controlled vocabularies for admin casting forms (`race` / `ethnicity` align with
 * `taxonomy_terms` seed category `race_ethnicity` in
 * `supabase/migrations/20260407120100_taxonomy_seed.sql`).
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

/** Height <select> options: N/A first (matches DB default + enum), then 4'10"–7'0". */
export function castingHeightFormOptions(): string[] {
  return ["N/A", ...castingHeightFeetInchesOptions()];
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
