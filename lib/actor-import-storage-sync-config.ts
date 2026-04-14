/** Env for {@link syncActorsFromStorage} and admin / API triggers. */

export function getActorImportSyncBucket(): string | null {
  const v = process.env.ACTOR_IMPORT_SYNC_BUCKET?.trim();
  return v || null;
}

export function getActorImportSyncPrefix(): string {
  return process.env.ACTOR_IMPORT_SYNC_PREFIX?.trim() ?? "";
}

export function getActorImportSyncDefaultPack(): string | null {
  const v = process.env.ACTOR_IMPORT_SYNC_DEFAULT_PACK?.trim();
  return v || null;
}
