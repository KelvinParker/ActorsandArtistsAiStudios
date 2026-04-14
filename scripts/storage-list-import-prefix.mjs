/**
 * Lists Storage object paths under ACTOR_IMPORT_SYNC_BUCKET + ACTOR_IMPORT_SYNC_PREFIX
 * (same walk as lib/sync-actors-from-storage). Run:
 *   npm run storage:list
 */

import { createClient } from "@supabase/supabase-js";

function normalizePrefix(p) {
  return p.replace(/^\/+/, "").replace(/\/+$/, "");
}

function joinStoragePath(prefix, name) {
  const n = normalizePrefix(prefix);
  if (!n) return name;
  return `${n}/${name}`;
}

function isListFileRow(metadata) {
  if (metadata == null || typeof metadata !== "object") return false;
  const size = metadata.size;
  return typeof size === "number" && size >= 0;
}

async function listStorageObjectPathsRecursive(supabase, bucket, prefix) {
  const root = normalizePrefix(prefix);
  const out = [];

  async function walk(dir) {
    const limit = 1000;
    let offset = 0;
    for (;;) {
      const { data, error } = await supabase.storage.from(bucket).list(dir, {
        limit,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw new Error(error.message);
      if (!data?.length) break;

      for (const item of data) {
        const path = dir ? joinStoragePath(dir, item.name) : item.name;
        if (isListFileRow(item.metadata)) {
          out.push(path);
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

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const bucket = process.env.ACTOR_IMPORT_SYNC_BUCKET?.trim();
const prefix = process.env.ACTOR_IMPORT_SYNC_PREFIX?.trim() ?? "";

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.");
  process.exit(1);
}
if (!bucket) {
  console.error("Missing ACTOR_IMPORT_SYNC_BUCKET in env.");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const paths = await listStorageObjectPathsRecursive(supabase, bucket, prefix);
  console.log(`Bucket:   ${bucket}`);
  console.log(`Prefix:   ${prefix ? `"${prefix}"` : "(empty = bucket root)"}`);
  console.log(`Objects:  ${paths.length}`);
  if (paths.length === 0) {
    console.log("\nNo files under this bucket+prefix. Fix prefix or upload files, then retry.");
    process.exit(2);
  }
  console.log("\nFirst paths:");
  paths.slice(0, 40).forEach((p) => console.log(`  ${p}`));
  if (paths.length > 40) console.log(`  … ${paths.length - 40} more`);
  process.exit(0);
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
