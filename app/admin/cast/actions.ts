"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { syncActorAssetsFromFormData } from "@/lib/actor-assets-upload";
import { headshotPayloadFromSlots } from "@/lib/actor-headshots";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { parseAgeRangeText } from "@/lib/playing-age";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";
import { applyLibraryDropToActor } from "@/lib/actor-admin-library-drop";
import {
  coerceCastingHeightEnum,
  coerceCastingRaceEthnicityEnum,
  coerceCastingSexEnum,
} from "@/lib/casting-picklists";
import { fetchActorById } from "@/lib/actors-query";
import { schedulePartnerPackWebhooks } from "@/lib/partner-pack-webhook-dispatch";
import { sanitizeRtfImportFieldText } from "@/lib/sanitize-rtf-import-field";

export type CastActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type LibraryDropActionResult =
  | { ok: true; textFieldsUpdated: number; imagesUpdated: boolean }
  | { ok: false; error: string };

function sf(raw: unknown): string {
  return sanitizeRtfImportFieldText(String(raw ?? ""));
}

function sfNull(raw: unknown): string | null {
  const s = sf(raw);
  return s || null;
}

/** Five positional slots (null = empty field in admin). */
function parseCommaList(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((t) => sanitizeRtfImportFieldText(t.trim()))
    .filter(Boolean);
}

function collectHeadshotSlots(fd: FormData): (string | null)[] {
  const out: (string | null)[] = [];
  for (let i = 0; i < 5; i++) {
    const u = sf(fd.get(`headshot_${i}`));
    out.push(u || null);
  }
  return out;
}

export async function upsertActorCastAction(
  formData: FormData,
): Promise<CastActionResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }

  if (!hasSupabaseServiceRoleKey()) {
    return {
      ok: false,
      error: "Server needs SUPABASE_SERVICE_ROLE_KEY for admin casting.",
    };
  }
  const supabase = createSupabaseServiceRoleClient();

  const actorId = String(formData.get("actor_id") ?? "").trim();
  const name = sf(formData.get("name"));
  if (!name) {
    return { ok: false, error: "Name is required" };
  }

  const ageParsed = parseAgeRangeText(sf(formData.get("age_range")));
  if (!ageParsed.ok) {
    return { ok: false, error: ageParsed.error };
  }
  const ethRaw = sf(formData.get("ethnicity")) || null;
  const ethnicity = ethRaw ? coerceCastingRaceEthnicityEnum(ethRaw) : null;
  const sexRaw = sf(formData.get("sex")) || null;
  const sex = sexRaw ? coerceCastingSexEnum(sexRaw) : null;
  const stageRaw = sf(formData.get("stage_name"));
  const stage_name = stageRaw || null;
  const vocal_range = sfNull(formData.get("vocal_range"));
  const personality_archetype = sfNull(formData.get("personality_archetype"));
  const primary_goal = sfNull(formData.get("primary_goal"));
  const must_keep_identity_traits = sfNull(formData.get("must_keep_identity_traits"));
  const heightRaw = sf(formData.get("height")) || null;
  const height = heightRaw ? coerceCastingHeightEnum(heightRaw) : null;
  const weight = sfNull(formData.get("weight"));
  const tags = parseCommaList(String(formData.get("tags") ?? ""));
  const pack_name = sfNull(formData.get("pack_name"));
  const traits = parseCommaList(String(formData.get("traits") ?? ""));
  const search_keywords = parseCommaList(
    String(formData.get("search_keywords") ?? ""),
  );
  const speech = sfNull(formData.get("speech"));
  const levellabs_speech_id = sfNull(formData.get("levellabs_speech_id"));

  const slots = collectHeadshotSlots(formData);
  const headshots = headshotPayloadFromSlots(slots);
  const turnaround_url = sfNull(formData.get("turnaround"));

  const row = {
    name,
    age_range: ageParsed.text,
    age_range_min: ageParsed.min,
    age_range_max: ageParsed.max,
    ethnicity,
    sex,
    stage_name,
    vocal_range,
    personality_archetype,
    primary_goal,
    must_keep_identity_traits,
    height,
    weight,
    tags,
    pack_name,
    traits,
    speech,
    levellabs_speech_id,
    search_keywords,
    ...headshots,
    turnaround_url,
  };

  if (actorId) {
    const { error } = await supabase.from("actors").update(row).eq("id", actorId);
    if (error) {
      return { ok: false, error: error.message };
    }
    const sync = await syncActorAssetsFromFormData(supabase, actorId, name, formData);
    if (sync.error) {
      return { ok: false, error: sync.error };
    }
    schedulePartnerPackWebhooks(actorId, "character.pack_updated");
  } else {
    const { data: created, error } = await supabase
      .from("actors")
      .insert({
        ...row,
      })
      .select("id")
      .single();
    if (error || !created) {
      return { ok: false, error: error?.message ?? "Insert failed" };
    }
    const sync = await syncActorAssetsFromFormData(supabase, created.id, name, formData);
    if (sync.error) {
      await supabase.from("actors").delete().eq("id", created.id);
      return { ok: false, error: sync.error };
    }
    schedulePartnerPackWebhooks(created.id, "character.created");
    revalidatePath(`/actors/${created.id}`);
  }

  revalidatePath("/");
  revalidatePath("/admin/cast");
  if (actorId) {
    revalidatePath(`/actors/${actorId}`);
  }
  return { ok: true };
}

function isFile(v: unknown): v is File {
  return (
    typeof v === "object" &&
    v !== null &&
    "arrayBuffer" in v &&
    typeof (v as File).arrayBuffer === "function" &&
    "size" in v &&
    typeof (v as File).size === "number"
  );
}

/**
 * Apply RTF / numbered .txt / images from an admin drag-drop to the actor
 * being edited (overwrites only columns present in the drop).
 */
export async function applyActorLibraryDropAction(formData: FormData): Promise<LibraryDropActionResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!hasSupabaseServiceRoleKey()) {
    return { ok: false, error: "Server needs SUPABASE_SERVICE_ROLE_KEY for admin actions." };
  }

  const actorId = String(formData.get("actor_id") ?? "").trim();
  if (!actorId) {
    return { ok: false, error: "Missing actor id." };
  }

  let manifest: string[] = [];
  try {
    manifest = JSON.parse(String(formData.get("manifest") ?? "[]")) as string[];
  } catch {
    return { ok: false, error: "Invalid manifest JSON." };
  }

  const files = formData.getAll("files").filter(isFile);
  if (files.length === 0) {
    return { ok: false, error: "No files uploaded." };
  }
  if (manifest.length !== files.length) {
    return { ok: false, error: "Manifest length does not match file count." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { actor, error: fetchErr } = await fetchActorById(supabase, actorId);
  if (fetchErr) {
    return { ok: false, error: fetchErr.message };
  }
  if (!actor) {
    return { ok: false, error: "Actor not found." };
  }

  const drops = files.map((file, i) => ({
    relativePath: typeof manifest[i] === "string" ? manifest[i]! : file.name,
    file,
  }));

  const result = await applyLibraryDropToActor(supabase, actorId, drops, actor);
  if (!result.ok) {
    return result;
  }

  schedulePartnerPackWebhooks(actorId, "character.pack_updated");

  revalidatePath("/");
  revalidatePath("/admin/cast");
  revalidatePath(`/actors/${actorId}`);
  return result;
}

export async function deleteActorAction(actorId: string): Promise<CastActionResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }

  if (!hasSupabaseServiceRoleKey()) {
    return {
      ok: false,
      error: "Server needs SUPABASE_SERVICE_ROLE_KEY for admin actions.",
    };
  }
  const supabase = createSupabaseServiceRoleClient();

  schedulePartnerPackWebhooks(actorId, "character.deleted");

  const { error } = await supabase.from("actors").delete().eq("id", actorId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/admin/cast");
  return { ok: true };
}
