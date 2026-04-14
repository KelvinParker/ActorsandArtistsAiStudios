"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { schedulePartnerPackWebhooks } from "@/lib/partner-pack-webhook-dispatch";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";

export type VoiceReviewActionResult = { ok: true } | { ok: false; error: string };

export async function approveSuggestedElevenlabsVoiceAction(
  actorId: string,
): Promise<VoiceReviewActionResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!hasSupabaseServiceRoleKey()) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }
  const id = actorId.trim();
  if (!id) {
    return { ok: false, error: "Missing actor id." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: row, error: qErr } = await supabase
    .from("actors")
    .select("elevenlabs_voice_suggested_id")
    .eq("id", id)
    .maybeSingle();

  if (qErr) {
    return { ok: false, error: qErr.message };
  }
  const suggested = String(
    (row as { elevenlabs_voice_suggested_id?: string | null } | null)?.elevenlabs_voice_suggested_id ??
      "",
  ).trim();
  if (!suggested) {
    return { ok: false, error: "No suggested voice id on this actor." };
  }

  const { error: uErr } = await supabase
    .from("actors")
    .update({
      levellabs_speech_id: suggested,
      elevenlabs_voice_approved_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (uErr) {
    return { ok: false, error: uErr.message };
  }
  schedulePartnerPackWebhooks(id, "character.pack_updated");
  revalidatePath("/");
  revalidatePath("/admin/voice-review");
  revalidatePath("/admin/cast");
  return { ok: true };
}

export async function dismissSuggestedElevenlabsVoiceAction(
  actorId: string,
): Promise<VoiceReviewActionResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!hasSupabaseServiceRoleKey()) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }
  const id = actorId.trim();
  if (!id) {
    return { ok: false, error: "Missing actor id." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("actors")
    .update({ elevenlabs_voice_suggested_id: null })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }
  schedulePartnerPackWebhooks(id, "character.pack_updated");
  revalidatePath("/");
  revalidatePath("/admin/voice-review");
  return { ok: true };
}

/** Call when production `levellabs_speech_id` was set manually and matches your QA bar. */
export async function markProductionElevenlabsVoiceReviewedAction(
  actorId: string,
): Promise<VoiceReviewActionResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!hasSupabaseServiceRoleKey()) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }
  const id = actorId.trim();
  if (!id) {
    return { ok: false, error: "Missing actor id." };
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: row, error: qErr } = await supabase
    .from("actors")
    .select("levellabs_speech_id")
    .eq("id", id)
    .maybeSingle();

  if (qErr) {
    return { ok: false, error: qErr.message };
  }
  const prod = String(
    (row as { levellabs_speech_id?: string | null } | null)?.levellabs_speech_id ?? "",
  ).trim();
  if (!prod) {
    return { ok: false, error: "Set a production ElevenLabs voice id on the casting form first." };
  }

  const { error } = await supabase
    .from("actors")
    .update({ elevenlabs_voice_approved_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { ok: false, error: error.message };
  }
  schedulePartnerPackWebhooks(id, "character.pack_updated");
  revalidatePath("/");
  revalidatePath("/admin/voice-review");
  revalidatePath("/admin/cast");
  return { ok: true };
}
