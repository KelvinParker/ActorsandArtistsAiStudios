import { ACTOR_ASSETS_BUCKET } from "@/lib/supabase";

/**
 * Folder prefix for Supabase Storage `actor-assets`: `{actorId}/{nameSlug}/`.
 * IDs stay in the path for search; the slug keeps human-readable browsing.
 */
export function actorAssetFolderPrefix(actorId: string, actorName: string): string {
  const slug = slugifyActorName(actorName);
  return `${actorId}/${slug}`;
}

export function slugifyActorName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "actor";
}

/** Public object URL when the file lives under the recommended prefix. */
export function actorAssetPublicUrl(
  supabaseUrl: string,
  actorId: string,
  actorName: string,
  filename: string,
): string {
  const base = supabaseUrl.replace(/\/$/, "");
  const prefix = actorAssetFolderPrefix(actorId, actorName);
  return `${base}/storage/v1/object/public/${ACTOR_ASSETS_BUCKET}/${prefix}/${filename}`;
}
