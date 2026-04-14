/**
 * Maps files under an actor folder to turnaround + ordered headshot slots.
 * Matches exports from full-pack download: `headshots/headshot-01.*`, `turnaround/turnaround.*`.
 */

export type ClassifiedImportImages = {
  turnaround: File | null;
  /** Up to five files in display order (slot 0 = primary cover). */
  headshots: File[];
};

const IMG = /\.(jpe?g|png|webp|gif)$/i;

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

function lowerPath(p: string): string {
  return p.replace(/\\/g, "/").toLowerCase();
}

/**
 * Single-sheet turnaround (not numbered spread tiles).
 */
function isTurnaroundPath(relWithinActor: string): boolean {
  const base = basename(relWithinActor);
  if (!IMG.test(base)) return false;
  const low = lowerPath(relWithinActor);
  if (/^turnaround\/turnaround\./.test(low)) return true;
  if (/^turnaround_sheet\//.test(low) && /^turnaround/i.test(base)) return true;
  if (/^spread\/spread\./.test(low)) return true;
  if (/^turnaround\./.test(low)) return true;
  if (/^spread\./.test(low)) return true;
  return false;
}

function headshotSlotFromName(relWithinActor: string): number | null {
  const base = basename(relWithinActor);
  if (!IMG.test(base)) return null;
  const low = lowerPath(relWithinActor);

  if (/^headshots\/headshot-0?(\d+)\./.test(low)) {
    const m = /^headshots\/headshot-0?(\d+)\./i.exec(relWithinActor);
    const n = m ? Number.parseInt(m[1], 10) : NaN;
    if (n >= 1 && n <= 5) return n - 1;
  }

  let m = /^headshot-0?(\d+)\./i.exec(base);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (n >= 1 && n <= 5) return n - 1;
  }
  m = /^headshot_0?(\d+)\./i.exec(base);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (n >= 1 && n <= 5) return n - 1;
  }
  m = /^headshot(\d)\./i.exec(base);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (n >= 1 && n <= 5) return n - 1;
  }
  m = /^hs-0?(\d+)\./i.exec(base);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (n >= 1 && n <= 5) return n - 1;
  }

  if (/^headshot\./i.test(base)) return 0;
  if (/^cover\./i.test(base)) return 0;

  m = /^spread-0?(\d+)\./i.exec(base);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (n >= 1 && n <= 5) return n - 1;
  }
  m = /^spread_0?(\d+)\./i.exec(base);
  if (m) {
    const n = Number.parseInt(m[1], 10);
    if (n >= 1 && n <= 5) return n - 1;
  }

  return null;
}

function pickTurnaroundFile(candidates: { relWithinActor: string; file: File }[]): File | null {
  const turnaroundPaths = candidates.filter((c) => isTurnaroundPath(c.relWithinActor));
  if (turnaroundPaths.length === 0) return null;
  turnaroundPaths.sort((a, b) => a.relWithinActor.localeCompare(b.relWithinActor));
  return turnaroundPaths[0].file;
}

/**
 * @param entries — `relWithinActor` is the path under the actor root (e.g. from {@link resolveActorImportPath}).
 */
export function classifyActorImportImages(
  entries: { relWithinActor: string; file: File }[],
): ClassifiedImportImages {
  const imageEntries = entries.filter((e) => IMG.test(basename(e.relWithinActor)));
  if (imageEntries.length === 0) {
    return { turnaround: null, headshots: [] };
  }

  const turnaround = pickTurnaroundFile(imageEntries);

  const slotToFile = new Map<number, File>();
  const spreadFallback: File[] = [];

  for (const { relWithinActor, file } of imageEntries) {
    if (isTurnaroundPath(relWithinActor) && file === turnaround) continue;

    const slot = headshotSlotFromName(relWithinActor);
    if (slot != null) {
      if (!slotToFile.has(slot)) slotToFile.set(slot, file);
      continue;
    }

    const base = basename(relWithinActor);
    if (/^spread-0?(\d+)\./i.test(base) || /^spread_0?(\d+)\./i.test(base)) {
      spreadFallback.push(file);
    }
  }

  const headshots: (File | null)[] = [null, null, null, null, null];
  for (const [slot, file] of slotToFile) {
    if (slot >= 0 && slot < 5) headshots[slot] = file;
  }

  const anyNamedHeadshot = headshots.some(Boolean);
  if (!anyNamedHeadshot && spreadFallback.length > 0) {
    spreadFallback.sort((a, b) => a.name.localeCompare(b.name));
    for (let i = 0; i < Math.min(5, spreadFallback.length); i++) {
      headshots[i] = spreadFallback[i];
    }
  }

  const compact = headshots.filter((f): f is File => f != null);
  return { turnaround, headshots: compact.slice(0, 5) };
}
