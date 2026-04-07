/**
 * Linked row from `taxonomy_terms` via `actor_taxonomy` (optional until migration).
 */
export interface TaxonomyTerm {
  id: string;
  category: string;
  label: string;
}

/**
 * Row shape for `public.actors`.
 * Extended fields exist only after running migrations in `supabase/migrations/`.
 */
export interface ActorRow {
  id: string;
  name: string;
  /** Legacy free-text age (column may be dropped; prefer {@link age_range}). */
  age?: string | null;
  /** Typable band shown on profile (e.g. 45-55); see migration `20260413090000`. */
  age_range?: string | null;
  /** Parsed bounds when `age_range` is numeric; used for overlap search. */
  age_range_min?: number | null;
  age_range_max?: number | null;
  /** Removed from some DBs; prefer {@link race}. */
  ethnicity?: string | null;
  tags: string[] | null;
  /** Mirror of `headshot_urls[0]` for legacy queries; gallery cover when array is empty. */
  headshot_url: string | null;
  /** Table Editor extras; merged after `headshot_urls` on profile + downloads (not gallery tile). */
  headshot_2_url?: string | null;
  headshot_3_url?: string | null;
  headshot_4_url?: string | null;
  headshot_5_url?: string | null;
  /**
   * Ordered headshots: `[0]` = gallery cover; `[1]`…`[4]` = profile-only extras.
   */
  headshot_urls?: string[] | null;
  turnaround_url: string | null;
  /** Present after migration `20260406180000_actors_character_fields.sql` */
  race?: string | null;
  /** Present after migration `20260408120000_actors_sex.sql` */
  sex?: string | null;
  traits?: string[] | null;
  speech?: string | null;
  /** Optional external voice id (e.g. ElevenLabs); column name kept for DB compatibility. */
  levellabs_speech_id?: string | null;
  /** Present after migration `20260406200000_actors_height_weight_search.sql` */
  height?: string | null;
  weight?: string | null;
  search_keywords?: string[] | null;
  /** Present after `20260407120000_taxonomy_system.sql`; empty array if none linked. */
  taxonomy?: TaxonomyTerm[];
}
