"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getIsAdmin } from "@/lib/auth/is-admin";
import {
  getActorImportSyncBucket,
  getActorImportSyncDefaultPack,
  getActorImportSyncPrefix,
} from "@/lib/actor-import-storage-sync-config";
import { upsertActorImportRow } from "@/lib/actor-import-upsert";
import { buildActorRowFromNumberedFiles } from "@/lib/build-actor-import-row";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";
import type { SyncActorsFromStorageReport } from "@/lib/sync-actors-from-storage";
import { syncActorsFromStorage } from "@/lib/sync-actors-from-storage";

export type ImportJobWire = {
  inheritedPack: string | null;
  files: Record<string, string>;
  profileFolderKey?: string | null;
};

export type BulkImportResult =
  | { ok: true; inserted: number; updated: number }
  | { ok: false; error: string };

function filesRecordToMap(files: Record<string, string>): Map<number, string> {
  const m = new Map<number, string>();
  for (const [k, v] of Object.entries(files)) {
    const n = Number.parseInt(k, 10);
    if (Number.isFinite(n) && typeof v === "string") {
      m.set(n, v);
    }
  }
  return m;
}

export async function importActorsBulkAction(
  jobs: ImportJobWire[],
): Promise<BulkImportResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!hasSupabaseServiceRoleKey()) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }
  if (!Array.isArray(jobs) || jobs.length === 0) {
    return { ok: false, error: "No actor jobs to import." };
  }

  const supabase = createSupabaseServiceRoleClient();
  let inserted = 0;
  let updated = 0;

  for (const job of jobs) {
    const map = filesRecordToMap(job.files ?? {});
    let payload: Record<string, unknown>;
    try {
      payload = buildActorRowFromNumberedFiles(map, job.inheritedPack ?? null);
    } catch (e) {
      return {
        ok: false,
        error: e instanceof Error ? e.message : "Invalid import row",
      };
    }

    const up = await upsertActorImportRow(supabase, payload, {
      importProfileFolderKey: job.profileFolderKey?.trim() || null,
    });
    if (!up.ok) {
      return { ok: false, error: up.error };
    }
    if (up.wasInsert) inserted++;
    else updated++;
  }

  revalidatePath("/");
  return { ok: true, inserted, updated };
}

export type StorageSyncAdminResult =
  | { ok: true; report: SyncActorsFromStorageReport }
  | { ok: false; error: string };

/**
 * Pull actors from Supabase Storage (same layout as zip/folder import) into `actors`.
 * Requires `ACTOR_IMPORT_SYNC_BUCKET` and optional prefix / default pack env vars.
 */
export async function syncActorsFromStorageAdminAction(
  dryRun: boolean,
): Promise<StorageSyncAdminResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!hasSupabaseServiceRoleKey()) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }

  const bucket = getActorImportSyncBucket();
  if (!bucket) {
    return {
      ok: false,
      error:
        "Storage sync is not configured. Set ACTOR_IMPORT_SYNC_BUCKET in .env.local (and optionally ACTOR_IMPORT_SYNC_PREFIX, ACTOR_IMPORT_SYNC_DEFAULT_PACK), then restart the dev server.",
    };
  }

  const supabase = createSupabaseServiceRoleClient();
  try {
    const report = await syncActorsFromStorage(supabase, {
      bucket,
      prefix: getActorImportSyncPrefix(),
      defaultPackOverride: getActorImportSyncDefaultPack(),
      dryRun,
    });
    if (!dryRun) {
      revalidatePath("/");
    }
    return { ok: true, report };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Storage sync failed",
    };
  }
}
