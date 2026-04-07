import type { SupabaseClient } from "@supabase/supabase-js";
import { headshotPayloadFromSlots } from "@/lib/actor-headshots";
import { actorAssetFolderPrefix } from "@/lib/actor-storage-path";
import { ACTOR_ASSETS_BUCKET } from "@/lib/supabase";

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const ALLOWED_IMAGE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

function mimeToExt(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
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

function publicUrlForPath(supabase: SupabaseClient, objectPath: string): string {
  const { data } = supabase.storage.from(ACTOR_ASSETS_BUCKET).getPublicUrl(objectPath);
  return data.publicUrl;
}

/**
 * Ensures the canonical storage prefix exists and links id + name (Supabase has no empty folders).
 */
export async function uploadActorFolderMarker(
  supabase: SupabaseClient,
  actorId: string,
  actorName: string,
): Promise<{ error: string | null }> {
  const prefix = actorAssetFolderPrefix(actorId, actorName);
  const path = `${prefix}/actor-root.txt`;
  const body = `actor_id=${actorId}\nname=${actorName}\n`;
  const { error } = await supabase.storage.from(ACTOR_ASSETS_BUCKET).upload(path, body, {
    contentType: "text/plain;charset=UTF-8",
    upsert: true,
  });
  return { error: error?.message ?? null };
}

async function uploadImageFile(
  supabase: SupabaseClient,
  objectPath: string,
  file: File,
): Promise<{ error: string | null }> {
  if (file.size > MAX_IMAGE_BYTES) {
    return { error: `File too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB).` };
  }
  const type = file.type || "application/octet-stream";
  if (!ALLOWED_IMAGE.has(type)) {
    return { error: "Image must be JPEG, PNG, WebP, or GIF." };
  }
  const buf = await file.arrayBuffer();
  const { error } = await supabase.storage.from(ACTOR_ASSETS_BUCKET).upload(objectPath, buf, {
    contentType: type,
    upsert: true,
  });
  return { error: error?.message ?? null };
}

/**
 * After insert/update, merge optional file uploads into `headshot_*` / turnaround URLs.
 * Reads `headshot_0`…`headshot_4` URLs and `headshot_file_0`…`headshot_file_4` files,
 * plus `turnaround` URL and `turnaround_file`.
 */
export async function syncActorAssetsFromFormData(
  supabase: SupabaseClient,
  actorId: string,
  actorName: string,
  formData: FormData,
): Promise<{ error: string | null }> {
  const { error: markerErr } = await uploadActorFolderMarker(supabase, actorId, actorName);
  if (markerErr) {
    return { error: `Storage folder marker failed: ${markerErr}` };
  }

  const prefix = actorAssetFolderPrefix(actorId, actorName);
  const urlSlots: (string | null)[] = [];
  for (let i = 0; i < 5; i++) {
    const u = String(formData.get(`headshot_${i}`) ?? "").trim();
    urlSlots.push(u || null);
  }

  const merged: (string | null)[] = [...urlSlots];

  for (let i = 0; i < 5; i++) {
    const raw = formData.get(`headshot_file_${i}`);
    if (!isFile(raw) || raw.size <= 0) continue;
    const ext = mimeToExt(raw.type);
    const objectPath = `${prefix}/headshot-${String(i + 1).padStart(2, "0")}.${ext}`;
    const { error: upErr } = await uploadImageFile(supabase, objectPath, raw);
    if (upErr) {
      return { error: `Headshot ${i + 1} upload failed: ${upErr}` };
    }
    merged[i] = publicUrlForPath(supabase, objectPath);
  }

  const turnaroundUrl = String(formData.get("turnaround") ?? "").trim() || null;
  let finalTurnaround = turnaroundUrl;
  const tFile = formData.get("turnaround_file");
  if (isFile(tFile) && tFile.size > 0) {
    const ext = mimeToExt(tFile.type);
    const objectPath = `${prefix}/turnaround.${ext}`;
    const { error: upErr } = await uploadImageFile(supabase, objectPath, tFile);
    if (upErr) {
      return { error: `Turnaround upload failed: ${upErr}` };
    }
    finalTurnaround = publicUrlForPath(supabase, objectPath);
  }

  const payload = headshotPayloadFromSlots(merged);
  const { error: dbErr } = await supabase
    .from("actors")
    .update({
      ...payload,
      turnaround_url: finalTurnaround,
    })
    .eq("id", actorId);

  return { error: dbErr?.message ?? null };
}
