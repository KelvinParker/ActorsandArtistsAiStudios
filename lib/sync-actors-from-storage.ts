import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { syncActorAssetsFromImportBuffers } from "@/lib/actor-assets-upload";
import { profileFolderSegmentFromImportKey, upsertActorImportRow } from "@/lib/actor-import-upsert";
import { buildActorRowFromNumberedFiles } from "@/lib/build-actor-import-row";
import { classifyActorImportImages } from "@/lib/classify-actor-import-images";
import {
  buildActorLibraryGroupsFromFlatPaths,
  type ActorLibraryFlatPathEntry,
} from "@/lib/parse-actor-library";
import {
  extractNumFromImportFilename,
  fileNameOnly,
  isImportImageFilename,
  resolveActorImportPath,
} from "@/lib/actor-import-path-resolve";

export type SyncActorsFromStorageOptions = {
  bucket: string;
  /** Folder under the bucket (no leading/trailing slashes). Empty = bucket root. */
  prefix: string;
  /** Like zip UI default: wins over DEFAULT_PACK.txt when set. */
  defaultPackOverride: string | null;
  dryRun: boolean;
};

export type SyncActorsFromStorageReport = {
  ok: true;
  inserted: number;
  updated: number;
  /** Rows skipped due to validation / DB errors (not used in dry run). */
  skipped: number;
  /** Actor folders skipped: Storage listing unchanged since last successful sync. */
  unchanged: number;
  actorKeys: string[];
  /** Objects scanned under the prefix (excluding DEFAULT_PACK.txt). */
  fileCount: number;
  /** Actor groups with at least one numbered `.txt` and/or `.rtf` (eligible for DB sync). */
  actorCount: number;
  dryRun: boolean;
  errors: string[];
};

/** One file object under the sync prefix (metadata only; no body download). */
export type StorageObjectMeta = {
  path: string;
  size: number;
  /** Storage `updated_at` / `created_at` when present — improves fingerprint vs size-only. */
  updatedAt: string;
};

function normalizePrefix(p: string): string {
  return p.replace(/^\/+/, "").replace(/\/+$/, "");
}

function joinStoragePath(prefix: string, name: string): string {
  const n = normalizePrefix(prefix);
  if (!n) return name;
  return `${n}/${name}`;
}

function stripImportPrefix(objectPath: string, prefix: string): string {
  const n = normalizePrefix(prefix);
  const o = objectPath.replace(/^\/+/, "");
  if (!n) return o;
  if (o === n) return "";
  if (o.startsWith(`${n}/`)) return o.slice(n.length + 1);
  return o;
}

function isListFileRow(metadata: unknown): boolean {
  if (metadata == null || typeof metadata !== "object") return false;
  const size = (metadata as { size?: unknown }).size;
  return typeof size === "number" && size >= 0;
}

function storageItemUpdatedAt(item: { updated_at?: unknown; created_at?: unknown }): string {
  if (typeof item.updated_at === "string" && item.updated_at) return item.updated_at;
  if (typeof item.created_at === "string" && item.created_at) return item.created_at;
  return "";
}

/**
 * Recursively lists file objects under `prefix` with size + updated time (no downloads).
 */
export async function listStorageObjectsWithMetaRecursive(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<StorageObjectMeta[]> {
  const root = normalizePrefix(prefix);
  const out: StorageObjectMeta[] = [];

  async function walk(dir: string): Promise<void> {
    const limit = 1000;
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(dir, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) {
        throw new Error(error.message);
      }
      if (!data?.length) break;

      for (const item of data) {
        const path = dir ? joinStoragePath(dir, item.name) : item.name;
        if (isListFileRow(item.metadata)) {
          const md = item.metadata as { size?: number };
          const size = typeof md?.size === "number" ? md.size : 0;
          out.push({ path, size, updatedAt: storageItemUpdatedAt(item) });
        } else {
          await walk(path);
        }
      }

      if (data.length < limit) break;
      offset += limit;
    }
  }

  await walk(root);
  return out;
}

/**
 * Recursively lists object paths (not “folder” rows) under `prefix`.
 * Prefer {@link listStorageObjectsWithMetaRecursive} when building fingerprints.
 */
export async function listStorageObjectPathsRecursive(
  supabase: SupabaseClient,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const rows = await listStorageObjectsWithMetaRecursive(supabase, bucket, prefix);
  return rows.map((r) => r.path);
}

function isImportableStorageRel(rel: string): boolean {
  const base = fileNameOnly(rel);
  const lower = base.toLowerCase();
  if (lower === "default_pack.txt") return false;
  if (lower.endsWith(".txt") || lower.endsWith(".rtf")) return true;
  return isImportImageFilename(base);
}

function actorFolderHasTextualField(records: { rel: string }[]): boolean {
  return records.some((r) => {
    const base = fileNameOnly(r.rel);
    const lower = base.toLowerCase();
    if (lower.endsWith(".rtf")) return true;
    return extractNumFromImportFilename(base) != null;
  });
}

/** Stable fingerprint for all importable objects under one `actorKey`. */
export function fingerprintActorImportFiles(
  records: { rel: string; size: number; updatedAt: string }[],
): string {
  const lines = [...records]
    .sort((a, b) => a.rel.localeCompare(b.rel, undefined, { sensitivity: "base" }))
    .map((r) => `${r.rel}\t${r.size}\t${r.updatedAt}`);
  return createHash("sha256").update(lines.join("\n"), "utf8").digest("hex");
}

function isMissingStateTableError(message: string): boolean {
  return (
    /\bactor_import_storage_sync_state\b/i.test(message) &&
    /\b(does not exist|Could not find)\b/i.test(message)
  );
}

async function downloadText(supabase: SupabaseClient, bucket: string, path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) {
    throw new Error(error.message);
  }
  return await data.text();
}

async function downloadArrayBuffer(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<ArrayBuffer> {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) {
    throw new Error(error.message);
  }
  return await data.arrayBuffer();
}

async function mapPool<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    for (;;) {
      const idx = i++;
      if (idx >= items.length) return;
      results[idx] = await fn(items[idx]!);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function loadFingerprintMap(
  supabase: SupabaseClient,
  bucket: string,
  prefixNorm: string,
  errors: string[],
): Promise<Map<string, string> | null> {
  const { data, error } = await supabase
    .from("actor_import_storage_sync_state")
    .select("actor_key,fingerprint")
    .eq("bucket", bucket)
    .eq("prefix", prefixNorm);

  if (error) {
    if (isMissingStateTableError(error.message)) {
      errors.push(
        "Incremental sync table is missing. Apply migration 20260420120000_actor_import_storage_sync_state.sql (e.g. npm run db:push). Until then, every folder is fully re-synced.",
      );
      return new Map();
    }
    errors.push(`Sync state read failed: ${error.message}`);
    return null;
  }

  const m = new Map<string, string>();
  for (const row of data ?? []) {
    const r = row as { actor_key?: unknown; fingerprint?: unknown };
    if (typeof r.actor_key === "string" && typeof r.fingerprint === "string") {
      m.set(r.actor_key, r.fingerprint);
    }
  }
  return m;
}

async function saveFingerprint(
  supabase: SupabaseClient,
  bucket: string,
  prefixNorm: string,
  actorKey: string,
  fingerprint: string,
  errors: string[],
): Promise<boolean> {
  const { error } = await supabase.from("actor_import_storage_sync_state").upsert(
    {
      bucket,
      prefix: prefixNorm,
      actor_key: actorKey,
      fingerprint,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bucket,prefix,actor_key" },
  );
  if (error) {
    if (isMissingStateTableError(error.message)) {
      errors.push(
        "Could not save sync fingerprint (table missing). Apply migration 20260420120000_actor_import_storage_sync_state.sql.",
      );
      return false;
    }
    errors.push(`${actorKey}: sync state save failed: ${error.message}`);
    return false;
  }
  return true;
}

export async function syncActorsFromStorage(
  supabase: SupabaseClient,
  opts: SyncActorsFromStorageOptions,
): Promise<SyncActorsFromStorageReport> {
  const prefix = normalizePrefix(opts.prefix);
  const errors: string[] = [];
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  let fileDefaultPack: string | null = null;
  const defaultPackPath = joinStoragePath(prefix, "DEFAULT_PACK.txt");

  const allMeta = await listStorageObjectsWithMetaRecursive(supabase, opts.bucket, prefix);
  const allPaths = allMeta.map((m) => m.path);
  const hasDefaultPackFile = allPaths.includes(defaultPackPath);
  if (hasDefaultPackFile) {
    try {
      const t = (await downloadText(supabase, opts.bucket, defaultPackPath)).trim();
      if (t) fileDefaultPack = t;
    } catch (e) {
      errors.push(
        `DEFAULT_PACK.txt: ${e instanceof Error ? e.message : "read failed"}`,
      );
    }
  }

  const effectiveDefaultPack =
    opts.defaultPackOverride?.trim() || fileDefaultPack || null;

  const importObjects = allMeta.filter((o) => o.path !== defaultPackPath);
  const importPathSet = new Set(importObjects.map((o) => o.path));

  /** actorKey → importable rel paths (strip prefix) with size + updatedAt */
  const byActor = new Map<string, { rel: string; size: number; updatedAt: string }[]>();

  for (const obj of importObjects) {
    const rel = stripImportPrefix(obj.path, prefix);
    if (!rel || !isImportableStorageRel(rel)) continue;
    const resolved = resolveActorImportPath(rel, effectiveDefaultPack);
    if (!resolved) continue;
    const { actorKey } = resolved;
    const list = byActor.get(actorKey) ?? [];
    list.push({ rel, size: obj.size, updatedAt: obj.updatedAt });
    byActor.set(actorKey, list);
  }

  const keysToDrop: string[] = [];
  for (const [actorKey, recs] of byActor) {
    if (!actorFolderHasTextualField(recs)) keysToDrop.push(actorKey);
  }
  for (const k of keysToDrop) byActor.delete(k);

  const orderedActorKeys = Array.from(byActor.keys()).sort((a, b) => a.localeCompare(b));
  const actorKeys = orderedActorKeys;

  const fingerprintMap = await loadFingerprintMap(supabase, opts.bucket, prefix, errors);

  if (fingerprintMap === null) {
    return {
      ok: true,
      inserted: 0,
      updated: 0,
      skipped: 0,
      unchanged: 0,
      actorKeys,
      fileCount: importObjects.length,
      actorCount: orderedActorKeys.length,
      dryRun: opts.dryRun,
      errors,
    };
  }

  if (importObjects.length === 0) {
    errors.push(
      "No objects found under this bucket/prefix. In Supabase → Storage, open the bucket and confirm paths. Common mistake: put only the bucket id in ACTOR_IMPORT_SYNC_BUCKET; folder paths (e.g. Profiles or actor-assets/Profiles) go in ACTOR_IMPORT_SYNC_PREFIX. If the bucket name is actor-assets, files at Profiles/Camille/… use PREFIX=Profiles, not actor-assets/Profiles.",
    );
  } else if (byActor.size === 0) {
    errors.push(
      "Objects exist under the prefix but none map to an actor folder with numbered .txt or .rtf. Sync only picks up .txt, .rtf, and image files (.jpg, .jpeg, .png, .webp, .gif).",
    );
  }

  if (opts.dryRun) {
    for (const actorKey of orderedActorKeys) {
      const recs = byActor.get(actorKey)!;
      const fp = fingerprintActorImportFiles(recs);
      const prev = fingerprintMap.get(actorKey);
      if (prev === fp) unchanged++;
    }
    return {
      ok: true,
      inserted: 0,
      updated: 0,
      skipped: 0,
      unchanged,
      actorKeys,
      fileCount: importObjects.length,
      actorCount: orderedActorKeys.length,
      dryRun: true,
      errors,
    };
  }

  for (const actorKey of orderedActorKeys) {
    const recs = byActor.get(actorKey)!;
    const fp = fingerprintActorImportFiles(recs);
    const prev = fingerprintMap.get(actorKey);
    if (prev === fp) {
      unchanged++;
      continue;
    }

    const objectPathsForActor = recs
      .map((r) => joinStoragePath(prefix, r.rel))
      .filter((p) => importPathSet.has(p));

    const entries: ActorLibraryFlatPathEntry[] = (
      await mapPool(objectPathsForActor, 8, async (objectPath) => {
        const rel = stripImportPrefix(objectPath, prefix);
        if (!rel) return null;
        const base = fileNameOnly(rel);
        const lower = base.toLowerCase();

        try {
          if (lower.endsWith(".txt")) {
            const text = await downloadText(supabase, opts.bucket, objectPath);
            return { relPath: rel, kind: "txt" as const, text };
          }
          if (lower.endsWith(".rtf")) {
            const buffer = await downloadArrayBuffer(supabase, opts.bucket, objectPath);
            return { relPath: rel, kind: "rtf" as const, buffer };
          }
          if (isImportImageFilename(base)) {
            const buffer = await downloadArrayBuffer(supabase, opts.bucket, objectPath);
            const ext = base.split(".").pop()?.toLowerCase() ?? "";
            const mime =
              ext === "png"
                ? "image/png"
                : ext === "webp"
                  ? "image/webp"
                  : ext === "gif"
                    ? "image/gif"
                    : "image/jpeg";
            return { relPath: rel, kind: "image" as const, buffer, mime };
          }
        } catch (e) {
          errors.push(`${objectPath}: ${e instanceof Error ? e.message : "download failed"}`);
        }
        return null;
      })
    ).filter((x): x is ActorLibraryFlatPathEntry => x != null);

    const groups = await buildActorLibraryGroupsFromFlatPaths(entries, effectiveDefaultPack);
    const g = groups.get(actorKey);
    if (!g || g.files.size === 0) {
      errors.push(`${actorKey}: no numbered fields after download (unexpected).`);
      skipped++;
      continue;
    }

    let payload: Record<string, unknown>;
    try {
      payload = buildActorRowFromNumberedFiles(g.files, g.inheritedPack ?? null);
    } catch (e) {
      errors.push(`${actorKey}: ${e instanceof Error ? e.message : "invalid row"}`);
      skipped++;
      continue;
    }

    const up = await upsertActorImportRow(supabase, payload, {
      importProfileFolderKey: profileFolderSegmentFromImportKey(actorKey),
    });
    if (!up.ok) {
      errors.push(up.error);
      skipped++;
      continue;
    }
    if (up.wasInsert) inserted++;
    else updated++;

    const classified = classifyActorImportImages(g.rawImages);
    const headshots: { buffer: ArrayBuffer; contentType: string }[] = [];
    for (let j = 0; j < classified.headshots.length && j < 5; j++) {
      const f = classified.headshots[j]!;
      if (f.size <= 0) continue;
      headshots.push({
        buffer: await f.arrayBuffer(),
        contentType: f.type || "image/jpeg",
      });
    }

    let turnaroundBuf: { buffer: ArrayBuffer; contentType: string } | null = null;
    if (classified.turnaround && classified.turnaround.size > 0) {
      turnaroundBuf = {
        buffer: await classified.turnaround.arrayBuffer(),
        contentType: classified.turnaround.type || "image/png",
      };
    }

    const assetErr = await syncActorAssetsFromImportBuffers(supabase, up.actorId, up.name, payload, {
      turnaround: turnaroundBuf,
      headshots,
    });
    if (assetErr.error) {
      errors.push(`${up.name}: ${assetErr.error}`);
      continue;
    }

    await saveFingerprint(supabase, opts.bucket, prefix, actorKey, fp, errors);
    fingerprintMap.set(actorKey, fp);
  }

  return {
    ok: true,
    inserted,
    updated,
    skipped,
    unchanged,
    actorKeys,
    fileCount: importObjects.length,
    actorCount: orderedActorKeys.length,
    dryRun: false,
    errors,
  };
}
