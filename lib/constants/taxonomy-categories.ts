/**
 * Must match `taxonomy_terms.category` check constraint in
 * `supabase/migrations/20260407120000_taxonomy_system.sql`.
 */
export const TAXONOMY_CATEGORY_KEYS = [
  "race_ethnicity",
  "age_range",
  "height",
  "weight",
  "eye_color",
  "hair_style",
  "hair_length",
  "hair_color",
  "facial_hair",
  "beard_style",
] as const;

export type TaxonomyCategory = (typeof TAXONOMY_CATEGORY_KEYS)[number];

export const TAXONOMY_CATEGORY_LABELS: Record<TaxonomyCategory, string> = {
  race_ethnicity: "Race / ethnicity",
  age_range: "Age (casting band)",
  height: "Height",
  weight: "Weight / build",
  eye_color: "Eye color",
  hair_style: "Hair texture / style",
  hair_length: "Hair length",
  hair_color: "Hair color",
  facial_hair: "Facial hair",
  beard_style: "Beard style",
};

/** Shown first in dropdowns — casting-critical groupings. */
export const TAXONOMY_CATEGORY_ORDER: TaxonomyCategory[] = [
  "race_ethnicity",
  "age_range",
  "height",
  "weight",
  "eye_color",
  "hair_style",
  "hair_length",
  "hair_color",
  "facial_hair",
  "beard_style",
];

export function isTaxonomyCategory(v: string): v is TaxonomyCategory {
  return (TAXONOMY_CATEGORY_KEYS as readonly string[]).includes(v);
}

/** Attributes under the Physical tab (excludes profile-only fields). */
export const PHYSICAL_TAB_CATEGORIES: TaxonomyCategory[] = [
  "age_range",
  "height",
  "weight",
  "eye_color",
  "hair_style",
  "hair_length",
  "hair_color",
  "facial_hair",
  "beard_style",
];
