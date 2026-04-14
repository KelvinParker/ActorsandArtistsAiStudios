"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import {
  syncActorAssetsFromFormData,
  syncActorAssetsFromRemoteUrls,
} from "@/lib/actor-assets-upload";
import { headshotPayloadFromSlots } from "@/lib/actor-headshots";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { runCharacterAutomation } from "@/lib/character-automation";
import {
  coerceCastingHeightEnum,
  coerceCastingRaceEthnicityEnum,
  coerceCastingSexEnum,
} from "@/lib/casting-picklists";
import { parseAgeRangeText } from "@/lib/playing-age";
import { schedulePartnerPackWebhooks } from "@/lib/partner-pack-webhook-dispatch";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";
import { sanitizeRtfImportFieldText } from "@/lib/sanitize-rtf-import-field";

export type AddActorResult =
  | { ok: true }
  | { ok: false; error: string };

function parseTags(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

export async function addActorAction(formData: FormData): Promise<AddActorResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }

  const autoGenerate = String(formData.get("auto_generate") ?? "") === "on";
  const seedPrompt = String(formData.get("seed_prompt") ?? "").trim();
  const headshotProvider =
    String(formData.get("headshot_provider") ?? "flow") === "flux" ? "flux" : "flow";
  const turnaroundProvider =
    String(formData.get("turnaround_provider") ?? "flux") === "nano-banana"
      ? "nano-banana"
      : "flux";

  const incomingName = sanitizeRtfImportFieldText(String(formData.get("name") ?? ""));
  let name = incomingName;
  let ageRangeText = String(formData.get("age_range") ?? "");
  let stageName = (() => {
    const raw = String(formData.get("stage_name") ?? "").trim();
    return raw ? sanitizeRtfImportFieldText(raw) : null;
  })();
  let originCity = String(formData.get("origin_city") ?? "").trim() || null;
  let ethnicity = String(formData.get("ethnicity") ?? "").trim() || null;
  if (ethnicity) ethnicity = coerceCastingRaceEthnicityEnum(ethnicity);
  let sex = String(formData.get("sex") ?? "").trim() || null;
  let height = String(formData.get("height") ?? "").trim() || null;
  let weight = String(formData.get("weight") ?? "").trim() || null;
  let vocalRange = String(formData.get("vocal_range") ?? "").trim() || null;
  let personalityArchetype =
    String(formData.get("personality_archetype") ?? "").trim() || null;
  let backstorySummary = String(formData.get("backstory_summary") ?? "").trim() || null;
  let primaryGoal = String(formData.get("primary_goal") ?? "").trim() || null;
  let coreWound = String(formData.get("core_wound") ?? "").trim() || null;
  let fatalFlaw = String(formData.get("fatal_flaw") ?? "").trim() || null;
  let signatureStyle = String(formData.get("signature_style") ?? "").trim() || null;
  let fashionStyle = String(formData.get("fashion_style") ?? "").trim() || null;
  let moodKeywords = String(formData.get("mood_keywords") ?? "").trim() || null;
  let marketSegment = String(formData.get("market_segment") ?? "").trim() || null;
  let mustKeepIdentityTraits =
    String(formData.get("must_keep_identity_traits") ?? "").trim() || null;
  let physicalDescription =
    String(formData.get("physical_description") ?? "").trim() || null;
  let tags = parseTags(String(formData.get("tags") ?? ""));
  const packName = String(formData.get("pack_name") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  let traits: string[] = [];
  let speech: string | null = null;
  let autoHeadshots: string[] = [];
  let autoTurnaround: string | null = null;

  if (autoGenerate) {
    if (!seedPrompt) {
      return { ok: false, error: "Seed prompt is required when Auto Pipeline is enabled." };
    }
    try {
      const draft = await runCharacterAutomation(seedPrompt, {
        headshotProvider,
        turnaroundProvider,
      });
      name = sanitizeRtfImportFieldText(draft.profile.name || name);
      stageName = draft.profile.stage_name
        ? sanitizeRtfImportFieldText(draft.profile.stage_name)
        : null;
      originCity = draft.profile.origin_city;
      ageRangeText = draft.profile.age_range || ageRangeText;
      ethnicity = draft.profile.ethnicity;
      sex = draft.profile.sex;
      height = draft.profile.height;
      weight = draft.profile.weight;
      vocalRange = draft.profile.vocal_range;
      personalityArchetype = draft.profile.personality_archetype;
      backstorySummary = draft.profile.backstory_summary;
      primaryGoal = draft.profile.primary_goal;
      coreWound = draft.profile.core_wound;
      fatalFlaw = draft.profile.fatal_flaw;
      signatureStyle = draft.profile.signature_style;
      fashionStyle =
        fashionStyle || String(draft.profile.signature_style ?? "").trim() || null;
      moodKeywords =
        moodKeywords || String(draft.profile.mood_tone ?? "").trim() || null;
      marketSegment = draft.profile.market_segment;
      mustKeepIdentityTraits = draft.profile.must_keep_traits;
      tags = draft.profile.tags;
      traits = draft.profile.traits;
      speech = draft.profile.speech;
      autoHeadshots = draft.headshots;
      autoTurnaround = draft.turnaroundUrl;
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? `Auto pipeline failed: ${e.message}` : "Auto pipeline failed",
      };
    }
  }

  if (!name) {
    return { ok: false, error: "Name is required" };
  }

  const ageParsed = parseAgeRangeText(ageRangeText);
  if (!ageParsed.ok) {
    return { ok: false, error: ageParsed.error };
  }

  if (sex) sex = coerceCastingSexEnum(sex);
  if (height) height = coerceCastingHeightEnum(height);

  const slots: (string | null)[] = [];
  for (let i = 0; i < 5; i++) {
    if (autoGenerate) {
      slots.push(autoHeadshots[i] ?? null);
      continue;
    }
    const u = String(formData.get(`headshot_${i}`) ?? "").trim();
    slots.push(u || null);
  }

  const turnaround = autoTurnaround || (String(formData.get("turnaround") ?? "").trim() || null);

  if (!hasSupabaseServiceRoleKey()) {
    return {
      ok: false,
      error:
        "Server needs SUPABASE_SERVICE_ROLE_KEY to insert actors from admin.",
    };
  }
  const supabase = createSupabaseServiceRoleClient();

  const headshots = headshotPayloadFromSlots(slots);

  const { data: created, error } = await supabase
    .from("actors")
    .insert({
      name,
      age_range: ageParsed.text,
      age_range_min: ageParsed.min,
      age_range_max: ageParsed.max,
      stage_name: stageName,
      origin_city: originCity,
      ethnicity,
      sex,
      height,
      weight,
      vocal_range: vocalRange,
      personality_archetype: personalityArchetype,
      backstory_summary: backstorySummary,
      primary_goal: primaryGoal,
      core_wound: coreWound,
      fatal_flaw: fatalFlaw,
      signature_style: signatureStyle,
      fashion_style: fashionStyle,
      mood_keywords: moodKeywords,
      market_segment: marketSegment,
      pack_name: packName,
      notes,
      physical_description: physicalDescription,
      must_keep_identity_traits: mustKeepIdentityTraits,
      tags,
      traits,
      speech,
      ...headshots,
      turnaround_url: turnaround,
    })
    .select("id")
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? "Insert failed" };
  }

  const sync = autoGenerate
    ? await syncActorAssetsFromRemoteUrls(
        supabase,
        created.id,
        name,
        autoHeadshots,
        autoTurnaround,
      )
    : await syncActorAssetsFromFormData(supabase, created.id, name, formData);
  if (sync.error) {
    await supabase.from("actors").delete().eq("id", created.id);
    return { ok: false, error: sync.error };
  }

  schedulePartnerPackWebhooks(created.id, "character.created");

  revalidatePath("/");
  revalidatePath(`/actors/${created.id}`);
  return { ok: true };
}
