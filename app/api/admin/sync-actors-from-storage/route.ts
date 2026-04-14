import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getIsAdmin } from "@/lib/auth/is-admin";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";
import {
  getActorImportSyncBucket,
  getActorImportSyncDefaultPack,
  getActorImportSyncPrefix,
} from "@/lib/actor-import-storage-sync-config";
import { syncActorsFromStorage } from "@/lib/sync-actors-from-storage";

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.ACTOR_IMPORT_SYNC_CRON_SECRET?.trim();
  if (!secret) return false;
  const authz = req.headers.get("authorization");
  return authz === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) {
    const { userId } = await auth();
    if (!userId || !(await getIsAdmin())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
  }

  if (!hasSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  const bucket = getActorImportSyncBucket();
  if (!bucket) {
    return NextResponse.json(
      {
        error:
          "Storage sync is not configured. Set ACTOR_IMPORT_SYNC_BUCKET (and optionally ACTOR_IMPORT_SYNC_PREFIX) in the server environment.",
      },
      { status: 501 },
    );
  }

  let dryRun = false;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const body = (await req.json()) as { dryRun?: boolean };
      dryRun = Boolean(body?.dryRun);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
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
    return NextResponse.json(report);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sync failed" },
      { status: 500 },
    );
  }
}
