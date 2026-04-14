import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fetchActorById } from "@/lib/actors-query";
import { persistActorDnaLoraSync, syncActorDnaLoraTrainingOnce } from "@/lib/fal-dna-lora";
import { getIsAdmin } from "@/lib/auth/is-admin";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";

/**
 * Admin: one-shot poll of Fal queue for this actor's last `dna_lora_fal_request_id`.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> },
) {
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

  const { id } = await context.params;
  const actorId = id?.trim();
  if (!actorId) {
    return NextResponse.json({ error: "Missing actor id." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { actor, error } = await fetchActorById(supabase, actorId);
  if (error || !actor) {
    return NextResponse.json({ error: "Actor not found." }, { status: 404 });
  }

  const requestId = actor.dna_lora_fal_request_id?.trim();
  if (!requestId) {
    return NextResponse.json(
      { error: "No Fal request id on this actor. Start training first." },
      { status: 400 },
    );
  }

  try {
    const sync = await syncActorDnaLoraTrainingOnce(requestId);

    const persist = await persistActorDnaLoraSync(supabase, actorId, sync);
    if (persist.error) {
      return NextResponse.json({ error: persist.error.message }, { status: 500 });
    }

    revalidatePath(`/actors/${actorId}`);
    revalidatePath("/");

    if (sync.state === "processing") {
      return NextResponse.json({
        ok: true,
        status: "processing",
        request_id: requestId,
      });
    }

    if (sync.state === "failed") {
      return NextResponse.json({
        ok: false,
        status: "failed",
        error: sync.error,
        request_id: requestId,
      });
    }

    return NextResponse.json({
      ok: true,
      status: "completed",
      dna_lora_url: sync.loraUrl,
      dna_lora_completed_at: persist.completedAt ?? null,
      request_id: requestId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
