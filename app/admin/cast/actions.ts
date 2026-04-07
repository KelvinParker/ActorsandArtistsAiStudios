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

export type CastActionResult =
  | { ok: true }
  | { ok: false; error: string };

/** Five positional slots (null = empty field in admin). */
function parseCommaList(raw: string): string[] {
  return raw
    .split(/[,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
}

function collectHeadshotSlots(fd: FormData): (string | null)[] {
  const out: (string | null)[] = [];
  for (let i = 0; i < 5; i++) {
    const u = String(fd.get(`headshot_${i}`) ?? "").trim();
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
  const name = String(formData.get("name") ?? "").trim();
  if (!name) {
    return { ok: false, error: "Name is required" };
  }

  const ageParsed = parseAgeRangeText(String(formData.get("age_range") ?? ""));
  if (!ageParsed.ok) {
    return { ok: false, error: ageParsed.error };
  }
  const race = String(formData.get("race") ?? "").trim() || null;
  const sex = String(formData.get("sex") ?? "").trim() || null;
  const height = String(formData.get("height") ?? "").trim() || null;
  const weight = String(formData.get("weight") ?? "").trim() || null;
  const tags = parseCommaList(String(formData.get("tags") ?? ""));
  const traits = parseCommaList(String(formData.get("traits") ?? ""));
  const search_keywords = parseCommaList(
    String(formData.get("search_keywords") ?? ""),
  );
  const speech = String(formData.get("speech") ?? "").trim() || null;
  const levellabs_speech_id =
    String(formData.get("levellabs_speech_id") ?? "").trim() || null;

  const slots = collectHeadshotSlots(formData);
  const headshots = headshotPayloadFromSlots(slots);
  const turnaround_url =
    String(formData.get("turnaround") ?? "").trim() || null;

  const row = {
    name,
    age_range: ageParsed.text,
    age_range_min: ageParsed.min,
    age_range_max: ageParsed.max,
    race,
    sex,
    height,
    weight,
    tags,
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
    revalidatePath(`/actors/${created.id}`);
  }

  revalidatePath("/");
  revalidatePath("/admin/cast");
  if (actorId) {
    revalidatePath(`/actors/${actorId}`);
  }
  return { ok: true };
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

  const { error } = await supabase.from("actors").delete().eq("id", actorId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/");
  revalidatePath("/admin/cast");
  return { ok: true };
}
