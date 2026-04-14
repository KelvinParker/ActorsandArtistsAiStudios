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

function extFromContentType(type: string): string {
  const normalized = type.split(";")[0].trim().toLowerCase();
  return mimeToExt(normalized);
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

function publicUrlForPath(
  supabase: SupabaseClient,
  objectPath: string,
  cacheBuster?: string,
): string {
  const { data } = supabase.storage.from(ACTOR_ASSETS_BUCKET).getPublicUrl(objectPath);
  if (!cacheBuster) return data.publicUrl;
  const sep = data.publicUrl.includes("?") ? "&" : "?";
  return `${data.publicUrl}${sep}v=${encodeURIComponent(cacheBuster)}`;
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

async function uploadImageBuffer(
  supabase: SupabaseClient,
  objectPath: string,
  buffer: ArrayBuffer,
  contentType: string,
): Promise<{ error: string | null }> {
  const type = contentType.split(";")[0].trim().toLowerCase();
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    return { error: `File too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB).` };
  }
  if (!ALLOWED_IMAGE.has(type)) {
    return { error: "Image must be JPEG, PNG, WebP, or GIF." };
  }
  const { error } = await supabase.storage.from(ACTOR_ASSETS_BUCKET).upload(objectPath, buffer, {
    contentType: type,
    upsert: true,
  });
  return { error: error?.message ?? null };
}

export type ActorImportAssetBuffer = {
  buffer: ArrayBuffer;
  contentType: string;
};

/**
 * After bulk import upsert, uploads local image buffers to `actor-assets` and
 * updates headshot / turnaround columns (file wins over the same slot from `32`/`33` URLs).
 */
export async function syncActorAssetsFromImportBuffers(
  supabase: SupabaseClient,
  actorId: string,
  actorName: string,
  payloadSnapshot: Record<string, unknown>,
  files: {
    turnaround: ActorImportAssetBuffer | null;
    headshots: ActorImportAssetBuffer[];
  },
): Promise<{ error: string | null }> {
  if (!files.turnaround && files.headshots.length === 0) {
    return { error: null };
  }

  const { error: markerErr } = await uploadActorFolderMarker(supabase, actorId, actorName);
  if (markerErr) {
    return { error: `Storage folder marker failed: ${markerErr}` };
  }

  const prefix = actorAssetFolderPrefix(actorId, actorName);
  const cacheBuster = Date.now().toString();
  const urlSlots: (string | null)[] = [null, null, null, null, null];

  const arr = payloadSnapshot.headshot_urls;
  if (Array.isArray(arr)) {
    for (let i = 0; i < 5; i++) {
      const u = arr[i];
      if (typeof u === "string" && u.trim()) {
        urlSlots[i] = u.trim();
      }
    }
  }
  const legacy = payloadSnapshot.headshot_url;
  if (!urlSlots[0] && typeof legacy === "string" && legacy.trim()) {
    urlSlots[0] = legacy.trim();
  }

  for (let i = 0; i < files.headshots.length && i < 5; i++) {
    const slot = files.headshots[i];
    const ext = mimeToExt(slot.contentType);
    const objectPath = `${prefix}/headshot-${String(i + 1).padStart(2, "0")}.${ext}`;
    const { error: upErr } = await uploadImageBuffer(supabase, objectPath, slot.buffer, slot.contentType);
    if (upErr) {
      return { error: `Headshot ${i + 1} upload failed: ${upErr}` };
    }
    urlSlots[i] = publicUrlForPath(supabase, objectPath, cacheBuster);
  }

  let finalTurnaround: string | null =
    typeof payloadSnapshot.turnaround_url === "string" && payloadSnapshot.turnaround_url.trim()
      ? String(payloadSnapshot.turnaround_url).trim()
      : null;

  if (files.turnaround) {
    const ext = mimeToExt(files.turnaround.contentType);
    const objectPath = `${prefix}/turnaround.${ext}`;
    const { error: upErr } = await uploadImageBuffer(
      supabase,
      objectPath,
      files.turnaround.buffer,
      files.turnaround.contentType,
    );
    if (upErr) {
      return { error: `Turnaround upload failed: ${upErr}` };
    }
    finalTurnaround = publicUrlForPath(supabase, objectPath, cacheBuster);
  }

  const payload = headshotPayloadFromSlots(urlSlots);
  const { error: dbErr } = await supabase
    .from("actors")
    .update({
      ...payload,
      turnaround_url: finalTurnaround,
    })
    .eq("id", actorId);

  return { error: dbErr?.message ?? null };
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
  const cacheBuster = Date.now().toString();
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
    merged[i] = publicUrlForPath(supabase, objectPath, cacheBuster);
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
    finalTurnaround = publicUrlForPath(supabase, objectPath, cacheBuster);
  }

  const payload = headshotPayloadFromSlots(merged);
  const dnaUrls: (string | null)[] = [];
  for (let i = 1; i <= 6; i++) {
    const u = String(formData.get(`dna_${i}`) ?? "").trim();
    dnaUrls.push(u || null);
  }
  for (let i = 1; i <= 6; i++) {
    const raw = formData.get(`dna_file_${i}`);
    if (!isFile(raw) || raw.size <= 0) continue;
    const ext = mimeToExt(raw.type);
    const objectPath = `${prefix}/dna_${i}.${ext}`;
    const { error: upErr } = await uploadImageFile(supabase, objectPath, raw);
    if (upErr) {
      return { error: `DNA ${i} upload failed: ${upErr}` };
    }
    dnaUrls[i - 1] = publicUrlForPath(supabase, objectPath, cacheBuster);
  }
  const dna_lora_training_urls = dnaUrls
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);
  const dnaSlots = {
    dna_1_url: dna_lora_training_urls[0] ?? null,
    dna_2_url: dna_lora_training_urls[1] ?? null,
    dna_3_url: dna_lora_training_urls[2] ?? null,
    dna_4_url: dna_lora_training_urls[3] ?? null,
    dna_5_url: dna_lora_training_urls[4] ?? null,
    dna_6_url: dna_lora_training_urls[5] ?? null,
  };
  const { error: dbErr } = await supabase
    .from("actors")
    .update({
      ...payload,
      turnaround_url: finalTurnaround,
      dna_lora_training_urls,
      ...dnaSlots,
    })
    .eq("id", actorId);

  return { error: dbErr?.message ?? null };
}

async function uploadImageFromUrl(
  supabase: SupabaseClient,
  objectPath: string,
  sourceUrl: string,
): Promise<{ error: string | null }> {
  if (sourceUrl.startsWith("data:image/")) {
    const comma = sourceUrl.indexOf(",");
    if (comma <= 0) {
      return { error: "Invalid data URL format." };
    }
    const meta = sourceUrl.slice(0, comma);
    const b64 = sourceUrl.slice(comma + 1);
    const mimeMatch = /^data:(image\/[a-z0-9.+-]+);base64$/i.exec(meta);
    const contentType = (mimeMatch?.[1] ?? "image/png").toLowerCase();
    if (!ALLOWED_IMAGE.has(contentType)) {
      return { error: `Unsupported data URL content type: ${contentType}` };
    }
    const bytes = Buffer.from(b64, "base64");
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return { error: `Remote image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB).` };
    }
    const { error } = await supabase.storage.from(ACTOR_ASSETS_BUCKET).upload(objectPath, bytes, {
      contentType,
      upsert: true,
    });
    return { error: error?.message ?? null };
  }

  const res = await fetch(sourceUrl, { cache: "no-store" });
  if (!res.ok) {
    return { error: `Download failed (${res.status})` };
  }
  const contentType = res.headers.get("content-type") || "image/jpeg";
  if (!ALLOWED_IMAGE.has(contentType.split(";")[0].trim().toLowerCase())) {
    return { error: `Unsupported content type: ${contentType}` };
  }
  const bytes = await res.arrayBuffer();
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    return { error: `Remote image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB).` };
  }
  const { error } = await supabase.storage.from(ACTOR_ASSETS_BUCKET).upload(objectPath, bytes, {
    contentType,
    upsert: true,
  });
  return { error: error?.message ?? null };
}

/**
 * Mirrors remote-generated images into canonical Supabase storage and updates actor URLs.
 */
export async function syncActorAssetsFromRemoteUrls(
  supabase: SupabaseClient,
  actorId: string,
  actorName: string,
  headshotUrls: string[],
  turnaroundUrl: string | null,
): Promise<{ error: string | null }> {
  const { error: markerErr } = await uploadActorFolderMarker(supabase, actorId, actorName);
  if (markerErr) {
    return { error: `Storage folder marker failed: ${markerErr}` };
  }

  const prefix = actorAssetFolderPrefix(actorId, actorName);
  const cacheBuster = Date.now().toString();
  const merged: (string | null)[] = [null, null, null, null, null];
  for (let i = 0; i < Math.min(headshotUrls.length, 5); i++) {
    const url = headshotUrls[i];
    if (!url) continue;
    const probe = await fetch(url, { method: "HEAD", cache: "no-store" });
    const ext = extFromContentType(probe.headers.get("content-type") || "image/jpeg");
    const objectPath = `${prefix}/headshot-${String(i + 1).padStart(2, "0")}.${ext}`;
    const { error } = await uploadImageFromUrl(supabase, objectPath, url);
    if (error) {
      return { error: `Headshot ${i + 1} mirror failed: ${error}` };
    }
    merged[i] = publicUrlForPath(supabase, objectPath, cacheBuster);
  }

  let finalTurnaround: string | null = null;
  if (turnaroundUrl) {
    const probe = await fetch(turnaroundUrl, { method: "HEAD", cache: "no-store" });
    const ext = extFromContentType(probe.headers.get("content-type") || "image/jpeg");
    const objectPath = `${prefix}/turnaround.${ext}`;
    const { error } = await uploadImageFromUrl(supabase, objectPath, turnaroundUrl);
    if (error) {
      return { error: `Turnaround mirror failed: ${error}` };
    }
    finalTurnaround = publicUrlForPath(supabase, objectPath, cacheBuster);
  }

  const payload = headshotPayloadFromSlots(merged);
  const { error: dbErr } = await supabase
    .from("actors")
    .update({ ...payload, turnaround_url: finalTurnaround })
    .eq("id", actorId);

  return { error: dbErr?.message ?? null };
}
