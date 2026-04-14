import { buildProfileImageUrls } from "@/lib/actor-headshots";
import type { ActorRow } from "@/lib/types/actor";

/** Versioned JSON for partner pipelines (video studios, external renderers). */
export type CharacterPackExportV1 = {
  schema_version: "1.0";
  actor: {
    id: string;
    name: string;
    stage_name: string | null;
    pack_name: string | null;
    headshot_urls: string[];
    turnaround_url: string | null;
    dna_lora_url: string | null;
    dna_lora_trigger: string | null;
    dna_1_url: string | null;
    dna_2_url: string | null;
    dna_3_url: string | null;
    dna_4_url: string | null;
    dna_5_url: string | null;
    dna_6_url: string | null;
    dna_lora_training_urls: string[] | null;
    dna_lora_status: string | null;
    dna_lora_completed_at: string | null;
    levellabs_speech_id: string | null;
    physical_description: string | null;
    must_keep_identity_traits: string | null;
    fashion_style: string | null;
    mood_keywords: string | null;
    traits: string[] | null;
    tags: string[] | null;
    search_keywords: string[] | null;
    ethnicity: string | null;
    sex: string | null;
    age_range: string | null;
  };
};

export function buildCharacterPackExportV1(actor: ActorRow): CharacterPackExportV1 {
  return {
    schema_version: "1.0",
    actor: {
      id: actor.id,
      name: actor.name,
      stage_name: actor.stage_name?.trim() || null,
      pack_name: actor.pack_name?.trim() || null,
      headshot_urls: buildProfileImageUrls(actor),
      turnaround_url: actor.turnaround_url?.trim() || null,
      dna_lora_url: actor.dna_lora_url?.trim() || null,
      dna_lora_trigger: actor.dna_lora_trigger?.trim() || null,
      dna_1_url: actor.dna_1_url?.trim() || null,
      dna_2_url: actor.dna_2_url?.trim() || null,
      dna_3_url: actor.dna_3_url?.trim() || null,
      dna_4_url: actor.dna_4_url?.trim() || null,
      dna_5_url: actor.dna_5_url?.trim() || null,
      dna_6_url: actor.dna_6_url?.trim() || null,
      dna_lora_training_urls: actor.dna_lora_training_urls ?? null,
      dna_lora_status: actor.dna_lora_status?.trim() || null,
      dna_lora_completed_at: actor.dna_lora_completed_at?.trim() || null,
      levellabs_speech_id: actor.levellabs_speech_id?.trim() || null,
      physical_description: actor.physical_description?.trim() || null,
      must_keep_identity_traits: actor.must_keep_identity_traits?.trim() || null,
      fashion_style: actor.fashion_style?.trim() || null,
      mood_keywords: actor.mood_keywords?.trim() || null,
      traits: actor.traits ?? null,
      tags: actor.tags ?? null,
      search_keywords: actor.search_keywords ?? null,
      ethnicity: actor.ethnicity?.trim() || null,
      sex: actor.sex?.trim() || null,
      age_range: actor.age_range?.trim() || null,
    },
  };
}
