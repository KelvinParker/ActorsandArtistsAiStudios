import JSZip from "jszip";
import { timingSafeEqual } from "node:crypto";
import { fal } from "@fal-ai/client";
import type { SupabaseClient } from "@supabase/supabase-js";
import { schedulePartnerPackWebhooks } from "@/lib/partner-pack-webhook-dispatch";
import { buildProfileImageUrls } from "@/lib/actor-headshots";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import type { ActorRow } from "@/lib/types/actor";

/** Fal queue endpoint — general Flux LoRA training (zip of images). */
export const FAL_DNA_LORA_MODEL = "fal-ai/flux-lora-general-training" as const;

const MIN_TRAINING_IMAGES = 4;
const RECOMMENDED_TRAINING_IMAGES = 10;
const MAX_TRAINING_IMAGES = 14;

function ensureFalConfigured(): void {
  const key = process.env.FAL_KEY?.trim();
  if (!key) {
    throw new Error("FAL_KEY is not set. Add it to the server environment.");
  }
  fal.config({ credentials: key });
}

/**
 * Single token for captions / inference (letters, digits, underscore).
 * Prefix keeps collisions unlikely vs generic words.
 */
export function buildDnaLoraTrigger(actor: { id: string; name: string }): string {
  const raw = `${actor.name}_${actor.id.slice(0, 10)}`
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  const withPrefix = `AAAS_${raw}`.slice(0, 48);
  return withPrefix || `AAAS_${actor.id.replace(/-/g, "").slice(0, 16)}`;
}

function dedupeUrls(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const t = u.trim();
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
  }
  return out;
}

/**
 * Ordered training stills + turnaround for a zip sent to Fal.
 */
export function collectDnaLoraTrainingUrls(actor: ActorRow): string[] {
  const headshots = buildProfileImageUrls(actor);
  const turn = actor.turnaround_url?.trim() || null;
  const merged = turn && !headshots.includes(turn) ? [...headshots, turn] : headshots;
  return dedupeUrls(merged).slice(0, MAX_TRAINING_IMAGES);
}

async function fetchUrlBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function extFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() ?? "";
    const dot = last.lastIndexOf(".");
    if (dot === -1) return "jpg";
    const ext = last.slice(dot + 1).toLowerCase();
    return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "jpg";
  } catch {
    return "jpg";
  }
}

/**
 * Build a zip of JPEG/PNG files for `images_data_url` (Fal expects a hosted URL to this zip).
 */
export async function buildActorTrainingZipBuffer(urls: string[]): Promise<Buffer> {
  if (urls.length < MIN_TRAINING_IMAGES) {
    throw new Error(
      `Need at least ${MIN_TRAINING_IMAGES} reachable image URLs (headshots + optional turnaround). Fal recommends ${RECOMMENDED_TRAINING_IMAGES}+.`,
    );
  }

  const zip = new JSZip();
  let n = 0;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const bytes = await fetchUrlBytes(url);
    if (!bytes || bytes.length < 64) continue;
    const ext = extFromUrl(url);
    const name = `train_${String(n).padStart(2, "0")}.${ext}`;
    zip.file(name, bytes);
    n++;
  }

  if (n < MIN_TRAINING_IMAGES) {
    throw new Error(
      `Only ${n} images could be downloaded. Check that URLs are public and reachable from Fal servers.`,
    );
  }

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
  return out as Buffer;
}

type FalQueueStatusBody = { status?: string };

function isCompletedStatus(s: string | undefined): boolean {
  return s === "COMPLETED" || s?.toUpperCase() === "COMPLETED";
}

function isFailedStatus(s: string | undefined): boolean {
  return s === "FAILED" || s?.toUpperCase() === "FAILED";
}

type LoraTrainingOutput = {
  diffusers_lora_file?: { url?: string } | null;
};

/**
 * Upload zip to Fal storage and enqueue `fal-ai/flux-lora-general-training`.
 */
export async function enqueueActorDnaLoraTraining(
  actor: ActorRow,
  options?: { steps?: number; rank?: number; webhookUrl?: string | null },
): Promise<{ request_id: string; trigger_word: string }> {
  ensureFalConfigured();
  const urls = collectDnaLoraTrainingUrls(actor);
  if (urls.length < MIN_TRAINING_IMAGES) {
    throw new Error(
      `Not enough image URLs (${urls.length}). Add headshots and/or turnaround; Fal recommends ${RECOMMENDED_TRAINING_IMAGES}+ for best consistency.`,
    );
  }

  const zipBuffer = await buildActorTrainingZipBuffer(urls);
  const trigger_word = buildDnaLoraTrigger(actor);

  const file = new File([new Uint8Array(zipBuffer)], "training.zip", { type: "application/zip" });
  const images_data_url = await fal.storage.upload(file);

  const steps = options?.steps ?? 1000;
  const rank = options?.rank ?? 16;

  const wh = options?.webhookUrl?.trim();
  const submitted = await fal.queue.submit(FAL_DNA_LORA_MODEL, {
    input: {
      images_data_url,
      trigger_word,
      steps,
      rank,
    },
    ...(wh ? { webhookUrl: wh } : {}),
  });
  const request_id = submitted.request_id;

  if (!request_id) {
    throw new Error("Fal did not return a request id for the training job.");
  }

  return { request_id, trigger_word };
}

export type DnaLoraSyncResult =
  | { state: "completed"; loraUrl: string }
  | { state: "failed"; error: string }
  | { state: "processing" };

/**
 * Poll Fal once for a training job and return parsed state (does not loop).
 */
export async function syncActorDnaLoraTrainingOnce(requestId: string): Promise<DnaLoraSyncResult> {
  ensureFalConfigured();
  const statusBody = (await fal.queue.status(FAL_DNA_LORA_MODEL, {
    requestId,
    logs: false,
  })) as FalQueueStatusBody;

  const st = statusBody.status;

  if (isFailedStatus(st)) {
    return { state: "failed", error: "Fal reported FAILED for this training request." };
  }

  if (!isCompletedStatus(st)) {
    return { state: "processing" };
  }

  try {
    const result = await fal.queue.result(FAL_DNA_LORA_MODEL, { requestId });
    const data = result.data as LoraTrainingOutput;
    const url = data?.diffusers_lora_file?.url?.trim();
    if (!url) {
      return { state: "failed", error: "Fal completed but no diffusers_lora_file.url in response." };
    }
    return { state: "completed", loraUrl: url };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/IN_PROGRESS|not ready|422|404/i.test(msg)) {
      return { state: "processing" };
    }
    return { state: "failed", error: msg.slice(0, 500) };
  }
}

/** @deprecated Use {@link getPublicSiteUrl} from `@/lib/public-site-url`. */
export function getPublicAppBaseUrl(): string | null {
  return getPublicSiteUrl();
}

/**
 * Full webhook URL for Fal queue callbacks when `FAL_WEBHOOK_SECRET` is set.
 * Query `token` is verified in `POST /api/webhooks/fal`.
 */
export function buildFalDnaLoraWebhookUrl(): string | null {
  const base = getPublicSiteUrl();
  const secret = process.env.FAL_WEBHOOK_SECRET?.trim();
  if (!base || !secret) return null;
  return `${base}/api/webhooks/fal?token=${encodeURIComponent(secret)}`;
}

export function verifyFalWebhookQueryToken(queryToken: string | null): boolean {
  const secret = process.env.FAL_WEBHOOK_SECRET?.trim();
  if (!secret || queryToken == null) return false;
  try {
    const a = Buffer.from(secret, "utf8");
    const b = Buffer.from(queryToken, "utf8");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function readDiffusersLoraFileField(file: unknown): string | null {
  if (!file || typeof file !== "object") return null;
  const url = (file as { url?: string }).url;
  return typeof url === "string" && url.trim() ? url.trim() : null;
}

/** Parse Fal webhook / API `payload` for `diffusers_lora_file.url`. */
export function extractDiffusersLoraUrlFromPayload(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  const direct = readDiffusersLoraFileField(p.diffusers_lora_file);
  if (direct) return direct;
  for (const key of ["output", "result", "data"] as const) {
    const inner = p[key];
    if (inner && typeof inner === "object") {
      const u = readDiffusersLoraFileField(
        (inner as Record<string, unknown>).diffusers_lora_file,
      );
      if (u) return u;
    }
  }
  return null;
}

/**
 * Apply {@link DnaLoraSyncResult} to `actors` (service-role client).
 */
export async function persistActorDnaLoraSync(
  supabase: SupabaseClient,
  actorId: string,
  sync: DnaLoraSyncResult,
): Promise<{ error: { message: string } | null; completedAt?: string }> {
  if (sync.state === "processing") {
    const { error } = await supabase
      .from("actors")
      .update({ dna_lora_status: "processing", dna_lora_error: null })
      .eq("id", actorId);
    if (!error) {
      schedulePartnerPackWebhooks(actorId, "character.pack_updated");
    }
    return { error: error ? { message: error.message } : null };
  }
  if (sync.state === "failed") {
    const { error } = await supabase
      .from("actors")
      .update({
        dna_lora_status: "failed",
        dna_lora_error: sync.error.slice(0, 2000),
      })
      .eq("id", actorId);
    if (!error) {
      schedulePartnerPackWebhooks(actorId, "character.pack_updated");
    }
    return { error: error ? { message: error.message } : null };
  }
  const completedAt = new Date().toISOString();
  const { error } = await supabase
    .from("actors")
    .update({
      dna_lora_url: sync.loraUrl,
      dna_lora_status: "completed",
      dna_lora_error: null,
      dna_lora_completed_at: completedAt,
    })
    .eq("id", actorId);
  if (error) {
    return { error: { message: error.message } };
  }
  schedulePartnerPackWebhooks(actorId, "character.pack_updated");
  return { error: null, completedAt };
}
