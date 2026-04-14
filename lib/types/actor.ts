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
  /** Home gallery order (ascending). Migration `20260412120000_actors_gallery_sort_order.sql`. */
  gallery_sort_order?: number | null;
  name: string;
  stage_name?: string | null;
  /** Legacy free-text age (column may be dropped; prefer {@link age_range}). */
  age?: string | null;
  /** Typable band shown on profile (e.g. 45-55); see migration `20260413090000`. */
  age_range?: string | null;
  /** Parsed bounds when `age_range` is numeric; used for overlap search. */
  age_range_min?: number | null;
  age_range_max?: number | null;
  /** Heritage / casting label (import `6.txt` / `7.txt`, admin Ethnicity dropdown). Enum `casting_race_ethnicity` when casting migrations are applied. */
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
  /** Distinct visual features (eyes, skin, facial hair); migration `20260416120000`. */
  physical_description?: string | null;
  /** Present after migration `20260408120000_actors_sex.sql` */
  sex?: string | null;
  traits?: string[] | null;
  speech?: string | null;
  vocal_range?: string | null;
  personality_archetype?: string | null;
  /** Present after migration `20260407180000_actors_role_archetype.sql` */
  role_archetype?: string | null;
  origin_city?: string | null;
  backstory_summary?: string | null;
  primary_goal?: string | null;
  core_wound?: string | null;
  fatal_flaw?: string | null;
  signature_style?: string | null;
  /** Locked uniform / wardrobe line; migration `20260416140000` (Field 3.0). */
  fashion_style?: string | null;
  /** Visual tone, lighting, palette keywords; migration `20260416140000` (Field 4.0). */
  mood_keywords?: string | null;
  market_segment?: string | null;
  /** Flux DNA LoRA weights URL (Fal `flux-lora-general-training`); migration `20260421130000`. */
  dna_lora_url?: string | null;
  /** Trigger token paired with {@link dna_lora_url} for prompts / inference. */
  dna_lora_trigger?: string | null;
  /** Explicit LoRA training slots (Table Editor-friendly). */
  dna_1_url?: string | null;
  dna_2_url?: string | null;
  dna_3_url?: string | null;
  dna_4_url?: string | null;
  dna_5_url?: string | null;
  dna_6_url?: string | null;
  /** Optional extra training images (beyond gallery headshots/turnaround), e.g. dna_1...dna_6. */
  dna_lora_training_urls?: string[] | null;
  dna_lora_fal_request_id?: string | null;
  /** `queued` | `processing` | `completed` | `failed` */
  dna_lora_status?: string | null;
  dna_lora_error?: string | null;
  dna_lora_completed_at?: string | null;
  /** Library / batch label; migration `20260416130000`. */
  pack_name?: string | null;
  /** Production notes; migration `20260416130000`. */
  notes?: string | null;
  must_keep_identity_traits?: string | null;
  created_by_user_id?: string | null;
  is_user_generated?: boolean | null;
  visibility?: string | null;
  generation_quality_mode?: string | null;
  /** Optional external voice id (e.g. ElevenLabs); column name kept for DB compatibility. */
  levellabs_speech_id?: string | null;
  /** AI / import suggestion; production id is {@link levellabs_speech_id} after admin approval. */
  elevenlabs_voice_suggested_id?: string | null;
  /** When production voice was confirmed (voice review or casting). */
  elevenlabs_voice_approved_at?: string | null;
  /** Present after migration `20260406200000_actors_height_weight_search.sql` */
  height?: string | null;
  weight?: string | null;
  search_keywords?: string[] | null;
  /** Present after `20260407120000_taxonomy_system.sql`; empty array if none linked. */
  taxonomy?: TaxonomyTerm[];
}
