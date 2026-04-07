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
  const tags = parseTags(String(formData.get("tags") ?? ""));

  const slots: (string | null)[] = [];
  for (let i = 0; i < 5; i++) {
    const u = String(formData.get(`headshot_${i}`) ?? "").trim();
    slots.push(u || null);
  }

  const turnaround = String(formData.get("turnaround") ?? "").trim() || null;

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
      race,
      sex,
      height,
      weight,
      tags,
      ...headshots,
      turnaround_url: turnaround,
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

  revalidatePath("/");
  revalidatePath(`/actors/${created.id}`);
  return { ok: true };
}
