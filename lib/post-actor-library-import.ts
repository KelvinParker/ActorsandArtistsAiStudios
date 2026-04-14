export type ActorLibraryImportJob = {
  inheritedPack: string | null;
  files: Record<string, string>;
  /** Optional — last segment of actor folder in zip/tree (dedupe vs RTF name). */
  profileFolderKey?: string | null;
  classified: {
    turnaround: File | null;
    headshots: File[];
  };
};

export type ActorLibraryImportResponse =
  | { ok: true; inserted: number; updated: number }
  | { ok: false; error: string };

export async function postActorLibraryImport(
  jobs: ActorLibraryImportJob[],
): Promise<ActorLibraryImportResponse> {
  if (jobs.length === 0) {
    return { ok: false, error: "No actor jobs to import." };
  }

  const fd = new FormData();
  fd.append(
    "manifest",
    JSON.stringify({
      jobs: jobs.map((j) => ({
        inheritedPack: j.inheritedPack,
        files: j.files,
        profileFolderKey: j.profileFolderKey ?? null,
      })),
    }),
  );
  jobs.forEach((j, i) => {
    if (j.classified.turnaround) {
      fd.append(`t_${i}`, j.classified.turnaround);
    }
    j.classified.headshots.forEach((f, si) => {
      fd.append(`h_${i}_${si}`, f);
    });
  });

  const res = await fetch("/api/admin/actor-library-import", {
    method: "POST",
    body: fd,
  });

  let json: { ok?: boolean; inserted?: number; updated?: number; error?: string };
  try {
    json = (await res.json()) as typeof json;
  } catch {
    return { ok: false, error: "Import failed (invalid response)." };
  }

  if (!res.ok || !json.ok) {
    return { ok: false, error: json.error ?? `Import failed (${res.status}).` };
  }

  return { ok: true, inserted: json.inserted ?? 0, updated: json.updated ?? 0 };
}
