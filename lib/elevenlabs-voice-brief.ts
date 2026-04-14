import type { ActorRow } from "@/lib/types/actor";
import { elevenlabsPreviewUsageNote } from "@/lib/elevenlabs-links";

/** Any actor-shaped object with enough fields for a paste block into ElevenLabs. */
export type ElevenlabsVoiceBriefSource = Partial<ActorRow> & { name?: string | null };

function trim(s: string | null | undefined): string {
  return typeof s === "string" ? s.trim() : "";
}

function joinArr(arr: string[] | null | undefined): string {
  return (arr ?? []).map((t) => String(t).trim()).filter(Boolean).join(", ");
}

function pushLine(lines: string[], label: string, value: string) {
  if (value) lines.push(`${label}: ${value}`);
}

/**
 * Single block of text to paste into ElevenLabs (Voice Library, voice search, etc.)
 * so a human can shortlist voices that fit the character. Later, the same shape can
 * feed an automated “describe → suggest voice id” integration.
 */
export function buildElevenlabsVoiceMatchingBrief(actor: ElevenlabsVoiceBriefSource): string {
  const name = trim(actor.name);
  if (!name) {
    return "Character name is missing — add 1.txt / name on the casting form first.";
  }

  const lines: string[] = [`VOICE MATCHING BRIEF — ${name}`, ""];

  pushLine(lines, "Stage name", trim(actor.stage_name));
  pushLine(lines, "Pack / story", trim(actor.pack_name));
  pushLine(lines, "Playing age", trim(actor.age_range));
  pushLine(lines, "Ethnicity", trim(actor.ethnicity));
  pushLine(lines, "Sex", trim(actor.sex));
  pushLine(lines, "Height", trim(actor.height));
  pushLine(lines, "Weight", trim(actor.weight));
  pushLine(lines, "Origin", trim(actor.origin_city));

  const phys = trim(actor.physical_description);
  if (phys) lines.push("", "Physical / Face DNA:", phys);

  const must = trim(actor.must_keep_identity_traits);
  if (must) lines.push("", "Must-keep identity:", must);

  pushLine(lines, "Personality archetype", trim(actor.personality_archetype));
  pushLine(lines, "Role archetype", trim(actor.role_archetype));
  pushLine(lines, "Vocal range (casting)", trim(actor.vocal_range));

  const story = trim(actor.backstory_summary);
  if (story) lines.push("", "Backstory:", story);

  pushLine(lines, "Primary goal", trim(actor.primary_goal));
  pushLine(lines, "Core wound", trim(actor.core_wound));
  pushLine(lines, "Fatal flaw", trim(actor.fatal_flaw));
  pushLine(lines, "Signature style", trim(actor.signature_style));
  pushLine(lines, "Fashion", trim(actor.fashion_style));
  pushLine(lines, "Mood / tone", trim(actor.mood_keywords));
  pushLine(lines, "Market segment", trim(actor.market_segment));

  const speech = trim(actor.speech);
  if (speech) lines.push("", "Speech & voice notes (primary hook for timbre / dialect):", speech);

  const tg = joinArr(actor.tags);
  if (tg) lines.push("", `Tags: ${tg}`);
  const tr = joinArr(actor.traits);
  if (tr) lines.push(`Traits: ${tr}`);
  const sk = joinArr(actor.search_keywords);
  if (sk) lines.push(`Search keywords: ${sk}`);

  lines.push(
    "",
    "---",
    "Next (manual today): paste this block into ElevenLabs Voice Library / search. If you pick a voice, copy its id into 29.txt for the next zip import (recommended when ready) or into the casting form / Voice review any time — voice ids are optional at first pass; you can always backfill later.",
    "",
    elevenlabsPreviewUsageNote,
    "---",
  );

  return lines.join("\n");
}
