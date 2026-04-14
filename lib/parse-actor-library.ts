import JSZip from "jszip";
import { normalizeLooseActorImageRelWithinActor } from "@/lib/actor-loose-image-path";
import { numberedFieldMapFromRtfBuffer } from "@/lib/actor-rtf-sections";
import {
  extractNumFromImportFilename,
  fileNameOnly,
  isImportImageFilename,
  resolveActorImportPath,
} from "@/lib/actor-import-path-resolve";

export type ParsedActorLibraryGroup = {
  inheritedPack: string | null;
  files: Map<number, string>;
  rawImages: { relWithinActor: string; file: File }[];
};

function mergeTxt(
  groups: Map<string, ParsedActorLibraryGroup>,
  actorKey: string,
  inheritedPack: string | null,
  num: number,
  text: string,
) {
  let g = groups.get(actorKey);
  if (!g) {
    g = { inheritedPack, files: new Map(), rawImages: [] };
    groups.set(actorKey, g);
  }
  if (g.inheritedPack == null && inheritedPack != null) g.inheritedPack = inheritedPack;
  g.files.set(num, text);
}

/** Numbered `.txt` wins over the same field from `.rtf` when both exist. */
function mergeTxtIfAbsent(
  groups: Map<string, ParsedActorLibraryGroup>,
  actorKey: string,
  inheritedPack: string | null,
  num: number,
  text: string,
) {
  let g = groups.get(actorKey);
  if (!g) {
    g = { inheritedPack, files: new Map(), rawImages: [] };
    groups.set(actorKey, g);
  }
  if (g.inheritedPack == null && inheritedPack != null) g.inheritedPack = inheritedPack;
  if (g.files.has(num)) return;
  g.files.set(num, text);
}

function mergeImg(
  groups: Map<string, ParsedActorLibraryGroup>,
  actorKey: string,
  inheritedPack: string | null,
  relWithinActor: string,
  file: File,
) {
  let g = groups.get(actorKey);
  if (!g) {
    g = { inheritedPack, files: new Map(), rawImages: [] };
    groups.set(actorKey, g);
  }
  if (g.inheritedPack == null && inheritedPack != null) g.inheritedPack = inheritedPack;
  const adjusted = normalizeLooseActorImageRelWithinActor(relWithinActor, file.name);
  g.rawImages.push({ relWithinActor: adjusted, file });
}

function mimeFromImportImageBaseName(base: string): string {
  const ext = base.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}

/** One row per object under a storage prefix (paths like zip internal layout after stripping the prefix). */
export type ActorLibraryFlatPathEntry =
  | { relPath: string; kind: "txt"; text: string }
  | { relPath: string; kind: "image"; buffer: ArrayBuffer; mime: string }
  | { relPath: string; kind: "rtf"; buffer: ArrayBuffer };

/**
 * Same grouping rules as {@link parseActorLibraryZip}, but entries are already
 * relative paths + decoded bodies (for Supabase Storage sync).
 * Processes `.rtf` after `.txt` so numbered text files win on conflicts.
 */
export async function buildActorLibraryGroupsFromFlatPaths(
  entries: readonly ActorLibraryFlatPathEntry[],
  defaultPack: string | null,
): Promise<Map<string, ParsedActorLibraryGroup>> {
  const groups = new Map<string, ParsedActorLibraryGroup>();
  const pack = defaultPack?.trim() || null;

  const ordered = [...entries].sort((a, b) => {
    const w = (e: ActorLibraryFlatPathEntry) => (e.kind === "rtf" ? 1 : 0);
    return w(a) - w(b);
  });

  for (const entry of ordered) {
    const resolved = resolveActorImportPath(entry.relPath, pack);
    if (!resolved) continue;
    const { actorKey, inheritedPack, relWithinActor } = resolved;
    const base = fileNameOnly(entry.relPath);
    if (base.toLowerCase() === "default_pack.txt") continue;

    if (entry.kind === "txt") {
      const num = extractNumFromImportFilename(base);
      if (num != null) {
        mergeTxt(groups, actorKey, inheritedPack, num, entry.text.trim());
      }
      continue;
    }

    if (entry.kind === "rtf") {
      const fieldMap = numberedFieldMapFromRtfBuffer(entry.buffer);
      for (const [num, text] of fieldMap) {
        mergeTxtIfAbsent(groups, actorKey, inheritedPack, num, text);
      }
      continue;
    }

    if (isImportImageFilename(base)) {
      const mime = entry.mime || mimeFromImportImageBaseName(base);
      const imageFile = new File([entry.buffer], base, { type: mime });
      mergeImg(groups, actorKey, inheritedPack, relWithinActor, imageFile);
    }
  }

  return groups;
}

export async function parseActorLibraryFolder(
  files: FileList,
  defaultPackInput: string,
): Promise<Map<string, ParsedActorLibraryGroup>> {
  const groups = new Map<string, ParsedActorLibraryGroup>();
  const defaultPack = defaultPackInput.trim() || null;
  const list = Array.from(files).sort((a, b) => {
    const ar = a.name.toLowerCase().endsWith(".rtf") ? 1 : 0;
    const br = b.name.toLowerCase().endsWith(".rtf") ? 1 : 0;
    return ar - br;
  });
  for (const file of list) {
    const rel = file.webkitRelativePath;
    if (!rel) continue;
    const resolved = resolveActorImportPath(rel, defaultPack);
    if (!resolved) continue;
    const { actorKey, inheritedPack, relWithinActor } = resolved;
    const base = fileNameOnly(rel);
    if (base.toLowerCase() === "default_pack.txt") continue;

    if (base.toLowerCase().endsWith(".rtf")) {
      const buf = await file.arrayBuffer();
      const fieldMap = numberedFieldMapFromRtfBuffer(buf);
      for (const [num, text] of fieldMap) {
        mergeTxtIfAbsent(groups, actorKey, inheritedPack, num, text);
      }
      continue;
    }

    const num = extractNumFromImportFilename(base);
    if (num != null) {
      const text = await file.text();
      mergeTxt(groups, actorKey, inheritedPack, num, text);
      continue;
    }
    if (isImportImageFilename(base)) {
      mergeImg(groups, actorKey, inheritedPack, relWithinActor, file);
    }
  }
  return groups;
}

export async function parseActorLibraryZip(
  file: File,
  defaultPackInput: string,
): Promise<Map<string, ParsedActorLibraryGroup>> {
  const buf = await file.arrayBuffer();
  const zip = await JSZip.loadAsync(buf);
  const groups = new Map<string, ParsedActorLibraryGroup>();

  let zipDefaultPack: string | null = null;
  const rootPack = zip.file("DEFAULT_PACK.txt");
  if (rootPack) {
    const t = (await rootPack.async("string")).trim();
    if (t) zipDefaultPack = t;
  }
  const defaultPack = defaultPackInput.trim() || zipDefaultPack || null;

  const names = Object.keys(zip.files)
    .filter((k) => !zip.files[k].dir)
    .sort((a, b) => {
      const ar = fileNameOnly(a).toLowerCase().endsWith(".rtf") ? 1 : 0;
      const br = fileNameOnly(b).toLowerCase().endsWith(".rtf") ? 1 : 0;
      return ar - br;
    });
  for (const relPath of names) {
    const resolved = resolveActorImportPath(relPath, defaultPack);
    if (!resolved) continue;
    const { actorKey, inheritedPack, relWithinActor } = resolved;
    const base = fileNameOnly(relPath);
    if (base.toLowerCase() === "default_pack.txt") continue;

    if (base.toLowerCase().endsWith(".rtf")) {
      const entry = zip.file(relPath);
      if (!entry) continue;
      const ab = await entry.async("arraybuffer");
      const fieldMap = numberedFieldMapFromRtfBuffer(ab);
      for (const [num, text] of fieldMap) {
        mergeTxtIfAbsent(groups, actorKey, inheritedPack, num, text);
      }
      continue;
    }

    const num = extractNumFromImportFilename(base);
    if (num != null) {
      const entry = zip.file(relPath);
      if (!entry) continue;
      const text = (await entry.async("string")).trim();
      mergeTxt(groups, actorKey, inheritedPack, num, text);
      continue;
    }

    if (isImportImageFilename(base)) {
      const entry = zip.file(relPath);
      if (!entry) continue;
      const ab = await entry.async("arraybuffer");
      const ext = base.split(".").pop()?.toLowerCase() ?? "";
      const mime =
        ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : ext === "gif"
              ? "image/gif"
              : "image/jpeg";
      const imageFile = new File([ab], base, { type: mime });
      mergeImg(groups, actorKey, inheritedPack, relWithinActor, imageFile);
    }
  }
  return groups;
}
