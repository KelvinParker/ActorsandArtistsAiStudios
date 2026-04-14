"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { runCharacterAutomation } from "@/lib/character-automation";
import { headshotPayloadFromSlots } from "@/lib/actor-headshots";
import { parseAgeRangeText } from "@/lib/playing-age";
import { syncActorAssetsFromRemoteUrls } from "@/lib/actor-assets-upload";
import { schedulePartnerPackWebhooks } from "@/lib/partner-pack-webhook-dispatch";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";
import { sanitizeRtfImportFieldText } from "@/lib/sanitize-rtf-import-field";

export type CreateCharacterResult =
  | { ok: true; actorId: string }
  | { ok: false; error: string };

function parseTagList(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function collectBridgeHeadshots(fd: FormData): string[] {
  const out: string[] = [];
  for (let i = 0; i < 4; i++) {
    const u = String(fd.get(`headshot_${i}`) ?? "").trim();
    if (u) out.push(u);
  }
  return out;
}

export async function createCharacterAction(formData: FormData): Promise<CreateCharacterResult> {
  const { userId } = await auth();
  if (!userId) {
    return { ok: false, error: "Sign in required." };
  }
  if (!hasSupabaseServiceRoleKey()) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  const seedPrompt = String(formData.get("seed_prompt") ?? "").trim();
  if (!seedPrompt) {
    return { ok: false, error: "Seed prompt is required." };
  }

  const visibility = String(formData.get("visibility") ?? "public") === "private" ? "private" : "public";
  const qualityMode =
    String(formData.get("quality_mode") ?? "studio") === "fast" ? "fast" : "studio";
  const imageSourceMode =
    String(formData.get("image_source_mode") ?? "bridge") === "auto" ? "auto" : "bridge";
  const extraTags = parseTagList(String(formData.get("tags") ?? ""));
  const nameOverride = sanitizeRtfImportFieldText(String(formData.get("name_override") ?? "").trim());

  try {
    const draft =
      imageSourceMode === "auto"
        ? await runCharacterAutomation(seedPrompt, {
            headshotProvider: "flow",
            turnaroundProvider: "nano-banana",
            qualityMode,
          })
        : {
            profile: {
              name: nameOverride || "Untitled Character",
              stage_name: null,
              age_range: "22-28",
              role_archetype: null,
              origin_city: null,
              ethnicity: null,
              sex: null,
              height: null,
              weight: null,
              vocal_range: null,
              personality_archetype: null,
              backstory_summary: seedPrompt,
              primary_goal: null,
              core_wound: null,
              fatal_flaw: null,
              signature_style: null,
              market_segment: null,
              mood_tone: null,
              must_keep_traits: null,
              tags: [],
              traits: [],
              speech: null,
              visual_prompt: seedPrompt,
              turnaround_prompt: seedPrompt,
            },
            headshots: collectBridgeHeadshots(formData),
            turnaroundUrl: String(formData.get("turnaround") ?? "").trim() || null,
          };

    if (imageSourceMode === "bridge") {
      if (draft.headshots.length !== 4) {
        return { ok: false, error: "Bridge mode requires 4 headshot URLs." };
      }
      if (!draft.turnaroundUrl) {
        return { ok: false, error: "Bridge mode requires 1 turnaround URL." };
      }
    }

    const ageParsed = parseAgeRangeText(draft.profile.age_range);
    if (!ageParsed.ok) {
      return { ok: false, error: ageParsed.error };
    }

    const supabase = createSupabaseServiceRoleClient();
    const slots: (string | null)[] = [null, null, null, null, null];
    for (let i = 0; i < Math.min(4, draft.headshots.length); i++) {
      slots[i] = draft.headshots[i] ?? null;
    }
    const headshotsPayload = headshotPayloadFromSlots(slots);

    const name = sanitizeRtfImportFieldText(
      nameOverride || draft.profile.name || "Untitled Character",
    );
    const tags = Array.from(new Set([...draft.profile.tags, ...extraTags]));

    const { data: created, error } = await supabase
      .from("actors")
      .insert({
        name,
        stage_name: draft.profile.stage_name
          ? sanitizeRtfImportFieldText(draft.profile.stage_name)
          : null,
        age_range: ageParsed.text,
        age_range_min: ageParsed.min,
        age_range_max: ageParsed.max,
        role_archetype: draft.profile.role_archetype,
        origin_city: draft.profile.origin_city,
        ethnicity: draft.profile.ethnicity,
        sex: draft.profile.sex,
        height: draft.profile.height,
        weight: draft.profile.weight,
        vocal_range: draft.profile.vocal_range,
        personality_archetype: draft.profile.personality_archetype,
        backstory_summary: draft.profile.backstory_summary,
        primary_goal: draft.profile.primary_goal,
        core_wound: draft.profile.core_wound,
        fatal_flaw: draft.profile.fatal_flaw,
        signature_style: draft.profile.signature_style,
        market_segment: draft.profile.market_segment,
        must_keep_identity_traits: draft.profile.must_keep_traits,
        tags,
        traits: draft.profile.traits,
        speech: draft.profile.speech,
        created_by_user_id: userId,
        is_user_generated: true,
        visibility,
        generation_quality_mode: qualityMode,
        ...headshotsPayload,
        turnaround_url: draft.turnaroundUrl,
      })
      .select("id")
      .single();

    if (error || !created) {
      return { ok: false, error: error?.message ?? "Character save failed." };
    }

    const sync = await syncActorAssetsFromRemoteUrls(
      supabase,
      created.id,
      name,
      draft.headshots,
      draft.turnaroundUrl,
    );
    if (sync.error) {
      await supabase.from("actors").delete().eq("id", created.id);
      return { ok: false, error: sync.error };
    }

    schedulePartnerPackWebhooks(created.id, "character.created");

    revalidatePath("/");
    revalidatePath(`/actors/${created.id}`);
    return { ok: true, actorId: created.id };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Character generation failed.",
    };
  }
}
