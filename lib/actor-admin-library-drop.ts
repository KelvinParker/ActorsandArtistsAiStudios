import type { SupabaseClient } from "@supabase/supabase-js";
import { syncActorAssetsFromImportBuffers } from "@/lib/actor-assets-upload";
import fieldMap from "@/lib/actor-import-field-map.json";
import {
  extractNumFromImportFilename,
  fileNameOnly,
  isImportImageFilename,
} from "@/lib/actor-import-path-resolve";
import { normalizeLooseActorImageRelWithinActor } from "@/lib/actor-loose-image-path";
import { buildActorRowFromNumberedFiles } from "@/lib/build-actor-import-row";
import { classifyActorImportImages } from "@/lib/classify-actor-import-images";
import { buildProfileImageUrls } from "@/lib/actor-headshots";
import { numberedFieldMapFromRtfBuffer } from "@/lib/actor-rtf-sections";
import type { ParsedActorLibraryGroup } from "@/lib/parse-actor-library";
import type { ActorRow } from "@/lib/types/actor";
import { slugifyActorName } from "@/lib/actor-storage-path";

type FieldDef = { num: number; column: string };

function normalizeDropRelativePath(relativePath: string, actorName: string): string {
  const p = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = p.split("/").filter(Boolean);
  if (parts.length >= 2 && slugifyActorName(parts[0]!) === slugifyActorName(actorName)) {
    return parts.slice(1).join("/");
  }
  return p;
}

function rankDropPath(relativePath: string): number {
  const base = fileNameOnly(relativePath);
  const l = base.toLowerCase();
  if (l.endsWith(".rtf")) return 2;
  if (l.endsWith(".txt")) {
    return extractNumFromImportFilename(base) != null ? 0 : 1;
  }
  return 3;
}

async function accumulateDropGroup(
  drops: readonly { relativePath: string; file: File }[],
  actorName: string,
): Promise<ParsedActorLibraryGroup> {
  const sorted = [...drops].sort((a, b) => rankDropPath(a.relativePath) - rankDropPath(b.relativePath));
  const g: ParsedActorLibraryGroup = { inheritedPack: null, files: new Map(), rawImages: [] };

  for (const { relativePath, file } of sorted) {
    const inner = normalizeDropRelativePath(relativePath, actorName);
    const base = fileNameOnly(inner);
    const lower = base.toLowerCase();
    if (lower === "default_pack.txt") continue;

    if (lower.endsWith(".rtf")) {
      const buf = await file.arrayBuffer();
      const m = numberedFieldMapFromRtfBuffer(buf);
      for (const [num, text] of m) {
        g.files.set(num, text);
      }
      continue;
    }

    if (lower.endsWith(".txt")) {
      const num = extractNumFromImportFilename(base);
      if (num != null) {
        const text = await file.text();
        g.files.set(num, text.trim());
      }
      continue;
    }

    if (isImportImageFilename(base)) {
      const adjusted = normalizeLooseActorImageRelWithinActor(inner, file.name);
      g.rawImages.push({ relWithinActor: adjusted, file });
    }
  }

  return g;
}

function filterPayloadToTouchedFields(
  payload: Record<string, unknown>,
  touchedFieldNums: Set<number>,
): Record<string, unknown> {
  const defs = fieldMap.files as FieldDef[];
  const out: Record<string, unknown> = {};
  const numToCol = new Map(defs.map((d) => [d.num, d.column] as const));
  for (const n of touchedFieldNums) {
    const col = numToCol.get(n);
    if (!col || !(col in payload)) continue;
    out[col] = payload[col];
  }
  if (touchedFieldNums.has(4)) {
    if ("age_range_min" in payload) out.age_range_min = payload.age_range_min;
    if ("age_range_max" in payload) out.age_range_max = payload.age_range_max;
  }
  return out;
}

function actorRowToAssetSnapshot(actor: ActorRow): Record<string, unknown> {
  const urls = buildProfileImageUrls(actor);
  return {
    headshot_urls: urls.length ? urls : null,
    headshot_url: actor.headshot_url,
    turnaround_url: actor.turnaround_url,
  };
}

const UPDATE_ALLOW = new Set([
  ...(fieldMap.files as FieldDef[]).map((d) => d.column),
  "age_range_min",
  "age_range_max",
  "headshot_url",
]);

function sanitizeUpdate(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    if (UPDATE_ALLOW.has(k)) out[k] = v;
  }
  return out;
}

export type ActorLibraryDropResult =
  | { ok: true; textFieldsUpdated: number; imagesUpdated: boolean }
  | { ok: false; error: string };

/**
 * Applies RTF / numbered `.txt` / images from an admin drag-drop to one actor.
 * Only columns backed by touched field numbers are updated (no silent clears).
 */
export async function applyLibraryDropToActor(
  supabase: SupabaseClient,
  actorId: string,
  drops: readonly { relativePath: string; file: File }[],
  actorRow: ActorRow,
): Promise<ActorLibraryDropResult> {
  if (!drops.length) {
    return { ok: false, error: "No files in drop." };
  }

  const g = await accumulateDropGroup(drops, actorRow.name);
  /** Field numbers that came from the user drop (not injected for validation). */
  const userFieldNums = new Set(g.files.keys());

  const imagesOnly = userFieldNums.size === 0 && g.rawImages.length > 0;
  const workFiles = new Map(g.files);
  if (!imagesOnly && !workFiles.has(1) && actorRow.name?.trim()) {
    workFiles.set(1, actorRow.name.trim());
  }

  let importPayload: Record<string, unknown> = {};
  if (!imagesOnly) {
    if (userFieldNums.size === 0 && g.rawImages.length === 0) {
      return {
        ok: false,
        error:
          "Nothing to apply. Use numbered 1.txt–33.txt, a .rtf with section titles, and/or image files (jpeg/png/webp/gif).",
      };
    }
    try {
      importPayload = buildActorRowFromNumberedFiles(workFiles, null);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Invalid import data" };
    }
  }

  if (!userFieldNums.has(3)) {
    delete importPayload.pack_name;
  }

  const filtered = imagesOnly
    ? {}
    : sanitizeUpdate(filterPayloadToTouchedFields(importPayload, userFieldNums));
  const textKeys = Object.keys(filtered);
  const hasTextUpdate = textKeys.length > 0;

  type PreparedAssets = {
    headshots: { buffer: ArrayBuffer; contentType: string }[];
    turnaround: { buffer: ArrayBuffer; contentType: string } | null;
  };
  let preparedAssets: PreparedAssets | null = null;
  if (g.rawImages.length > 0) {
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
    const hasAssetPayload = headshots.length > 0 || turnaroundBuf != null;
    if (!hasAssetPayload) {
      return {
        ok: false,
        error:
          "Could not map dropped images to headshot or turnaround slots. Use headshots/headshot-01.jpg, turnaround/turnaround.png, or names like “Actor Headshot.jpg”.",
      };
    }
    preparedAssets = { headshots, turnaround: turnaroundBuf };
  }

  if (hasTextUpdate) {
    const { error } = await supabase.from("actors").update(filtered).eq("id", actorId);
    if (error) {
      return { ok: false, error: error.message };
    }
  }

  const finalName =
    typeof filtered.name === "string" && filtered.name.trim()
      ? filtered.name.trim()
      : actorRow.name;

  let imagesUpdated = false;
  if (preparedAssets) {
    const snapshot = {
      ...actorRowToAssetSnapshot(actorRow),
      ...(typeof filtered.headshot_urls !== "undefined" ? { headshot_urls: filtered.headshot_urls } : {}),
      ...(typeof filtered.headshot_url !== "undefined" ? { headshot_url: filtered.headshot_url } : {}),
      ...(typeof filtered.turnaround_url !== "undefined" ? { turnaround_url: filtered.turnaround_url } : {}),
    };

    const assetErr = await syncActorAssetsFromImportBuffers(supabase, actorId, finalName, snapshot, {
      turnaround: preparedAssets.turnaround,
      headshots: preparedAssets.headshots,
    });
    if (assetErr.error) {
      return { ok: false, error: assetErr.error };
    }
    imagesUpdated = true;
  }

  if (!hasTextUpdate && !imagesUpdated) {
    return {
      ok: false,
      error:
        "Nothing to apply. Use numbered 1.txt–33.txt, a .rtf with section titles, and/or image files (jpeg/png/webp/gif).",
    };
  }

  return { ok: true, textFieldsUpdated: textKeys.length, imagesUpdated };
}
