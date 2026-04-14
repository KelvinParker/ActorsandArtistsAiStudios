import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { syncActorAssetsFromImportBuffers } from "@/lib/actor-assets-upload";
import { upsertActorImportRow } from "@/lib/actor-import-upsert";
import { buildActorRowFromNumberedFiles } from "@/lib/build-actor-import-row";
import { getIsAdmin } from "@/lib/auth/is-admin";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";

type Manifest = {
  jobs: {
    inheritedPack: string | null;
    files: Record<string, string>;
    /** Last folder segment under pack — dedupe when RTF `name` differs from folder slug. */
    profileFolderKey?: string | null;
  }[];
};

function isFile(v: unknown): v is File {
  return (
    typeof v === "object" &&
    v !== null &&
    "arrayBuffer" in v &&
    typeof (v as File).arrayBuffer === "function" &&
    "size" in v &&
    typeof (v as File).size === "number"
  );
}

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

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }
  if (!hasSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const manifestRaw = form.get("manifest");
  if (typeof manifestRaw !== "string") {
    return NextResponse.json({ error: "Missing manifest" }, { status: 400 });
  }

  let manifest: Manifest;
  try {
    manifest = JSON.parse(manifestRaw) as Manifest;
  } catch {
    return NextResponse.json({ error: "Invalid manifest JSON" }, { status: 400 });
  }

  if (!Array.isArray(manifest.jobs) || manifest.jobs.length === 0) {
    return NextResponse.json({ error: "No actor jobs to import." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  let inserted = 0;
  let updated = 0;

  for (let i = 0; i < manifest.jobs.length; i++) {
    const job = manifest.jobs[i];
    const map = filesRecordToMap(job.files ?? {});
    let payload: Record<string, unknown>;
    try {
      payload = buildActorRowFromNumberedFiles(map, job.inheritedPack ?? null);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid import row" },
        { status: 400 },
      );
    }

    const up = await upsertActorImportRow(supabase, payload, {
      importProfileFolderKey: job.profileFolderKey?.trim() || null,
    });
    if (!up.ok) {
      return NextResponse.json({ error: up.error }, { status: 400 });
    }
    if (up.wasInsert) inserted++;
    else updated++;

    const headshots: { buffer: ArrayBuffer; contentType: string }[] = [];
    for (let j = 0; j < 5; j++) {
      const f = form.get(`h_${i}_${j}`);
      if (!isFile(f) || f.size <= 0) continue;
      const buffer = await f.arrayBuffer();
      headshots.push({
        buffer,
        contentType: f.type || "image/jpeg",
      });
    }

    const turnaround = form.get(`t_${i}`);
    let turnaroundBuf: { buffer: ArrayBuffer; contentType: string } | null = null;
    if (isFile(turnaround) && turnaround.size > 0) {
      turnaroundBuf = {
        buffer: await turnaround.arrayBuffer(),
        contentType: turnaround.type || "image/png",
      };
    }

    const assetErr = await syncActorAssetsFromImportBuffers(
      supabase,
      up.actorId,
      up.name,
      payload,
      { turnaround: turnaroundBuf, headshots },
    );
    if (assetErr.error) {
      return NextResponse.json({ error: assetErr.error }, { status: 502 });
    }
  }

  revalidatePath("/");
  return NextResponse.json({ ok: true, inserted, updated });
}
