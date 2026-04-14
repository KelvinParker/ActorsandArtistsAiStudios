/**
 * Maps zip / folder paths to an actor key and path within that actor folder.
 * Collapses known asset subfolders (`headshots/`, `turnaround/`, …) so images
 * line up with `Pack/Actor/1.txt` instead of creating a fake nested actor.
 */

const ASSET_SUBFOLDERS = new Set(
  ["headshots", "turnaround", "turnaround_sheet", "images", "assets"].map((s) => s.toLowerCase()),
);

function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\/+/, "");
}

function fileNameOnly(relPath: string): string {
  const parts = normalizePath(relPath).split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function dirSegments(relPath: string): string[] {
  const norm = normalizePath(relPath);
  const parts = norm.split("/").filter(Boolean);
  if (parts.length < 2) return [];
  return parts.slice(0, -1);
}

function isAssetSubfolder(name: string): boolean {
  return ASSET_SUBFOLDERS.has(name.trim().toLowerCase());
}

export type ResolvedImportPath = {
  inheritedPack: string | null;
  actorKey: string;
  /** Path under the actor root (e.g. `headshots/headshot-01.jpg`, `1.txt`). */
  relWithinActor: string;
};

/**
 * @param defaultPack — from UI or zip `DEFAULT_PACK.txt`; used when treating
 *   `Actor/headshots/…` as belonging to actor `Actor` with this pack.
 */
export function resolveActorImportPath(
  relPath: string,
  defaultPack: string | null,
): ResolvedImportPath | null {
  const norm = normalizePath(relPath);
  const parts = norm.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const fname = parts[parts.length - 1] ?? "";
  const dirs = parts.slice(0, -1);
  const packDefault = defaultPack?.trim() || null;

  if (dirs.length === 0) return null;

  if (dirs.length >= 3 && isAssetSubfolder(dirs[2])) {
    return {
      inheritedPack: dirs[0],
      actorKey: `${dirs[0]}/${dirs[1]}`,
      relWithinActor: [...dirs.slice(2), fname].join("/"),
    };
  }

  if (dirs.length === 2 && isAssetSubfolder(dirs[1])) {
    return {
      inheritedPack: packDefault,
      actorKey: dirs[0],
      relWithinActor: `${dirs[1]}/${fname}`,
    };
  }

  if (dirs.length >= 2) {
    return {
      inheritedPack: dirs[0],
      actorKey: dirs.join("/"),
      relWithinActor: fname,
    };
  }

  return {
    inheritedPack: packDefault,
    actorKey: dirs[0],
    relWithinActor: fname,
  };
}

export function extractNumFromImportFilename(name: string): number | null {
  const m = /^(\d{1,2})\.txt$/i.exec(name.trim());
  if (!m) return null;
  return Number.parseInt(m[1], 10);
}

export function isImportImageFilename(name: string): boolean {
  return /\.(jpe?g|png|webp|gif)$/i.test(name.trim());
}

export { fileNameOnly, dirSegments, normalizePath };
