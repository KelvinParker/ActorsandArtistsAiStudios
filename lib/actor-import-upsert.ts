import type { SupabaseClient } from "@supabase/supabase-js";
import { schedulePartnerPackWebhooks } from "@/lib/partner-pack-webhook-dispatch";
import { slugifyActorName } from "@/lib/actor-storage-path";

export type ActorImportUpsertResult =
  | { ok: true; actorId: string; name: string; wasInsert: boolean }
  | { ok: false; error: string };

export type ActorImportUpsertOptions = {
  /**
   * Last folder segment for this actor in Storage / zip layout (e.g. `Camille_St_James`).
   * When the RTF `name` string does not match an existing row, we still **update** a row whose
   * `slugify(name)` equals `slugify(profileFolderKey)` under the same `pack_name`, so one profile
   * folder never creates a second actor.
   */
  importProfileFolderKey?: string | null;
};

/** Last path segment of an import actor key (`Pack/Actor` → `Actor`). */
export function profileFolderSegmentFromImportKey(actorKey: string): string | null {
  const parts = actorKey.split("/").filter(Boolean);
  return parts.length ? (parts[parts.length - 1] ?? null) : null;
}

export async function upsertActorImportRow(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  opts?: ActorImportUpsertOptions | null,
): Promise<ActorImportUpsertResult> {
  const name = String(payload.name ?? "").trim();
  const pack = payload.pack_name != null ? String(payload.pack_name).trim() : null;

  let lookup = supabase.from("actors").select("id").eq("name", name);
  if (pack) lookup = lookup.eq("pack_name", pack);
  else lookup = lookup.is("pack_name", null);
  const { data: rows, error: qErr } = await lookup.limit(1);
  if (qErr) {
    return { ok: false, error: qErr.message };
  }
  let existingId = rows?.[0]?.id as string | undefined;

  if (!existingId && opts?.importProfileFolderKey?.trim()) {
    const folderSeg = opts.importProfileFolderKey.trim();
    const targetSlug = slugifyActorName(folderSeg);
    let listQ = supabase.from("actors").select("id,name");
    if (pack) {
      listQ = listQ.eq("pack_name", pack);
    } else {
      listQ = listQ.is("pack_name", null).limit(2500);
    }
    const { data: candidates, error: lErr } = await listQ;
    if (lErr) {
      return { ok: false, error: lErr.message };
    }
    const hit = (candidates ?? []).find(
      (r) => slugifyActorName(String((r as { name?: unknown }).name ?? "")) === targetSlug,
    );
    existingId = (hit as { id?: string } | undefined)?.id;
  }

  if (existingId) {
    const { error: uErr } = await supabase.from("actors").update(payload).eq("id", existingId);
    if (uErr) {
      return { ok: false, error: `${name}: ${uErr.message}` };
    }
    schedulePartnerPackWebhooks(existingId, "character.pack_updated");
    return { ok: true, actorId: existingId, name, wasInsert: false };
  }

  const { data: ins, error: iErr } = await supabase.from("actors").insert(payload).select("id").single();

  if (iErr) {
    return { ok: false, error: `${name}: ${iErr.message}` };
  }
  const actorId = ins?.id as string | undefined;
  if (!actorId) {
    return { ok: false, error: `${name}: insert returned no id` };
  }
  schedulePartnerPackWebhooks(actorId, "character.created");
  return { ok: true, actorId, name, wasInsert: true };
}
