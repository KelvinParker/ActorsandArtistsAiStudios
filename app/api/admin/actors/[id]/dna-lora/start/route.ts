import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { fetchActorById } from "@/lib/actors-query";
import { buildFalDnaLoraWebhookUrl, enqueueActorDnaLoraTraining } from "@/lib/fal-dna-lora";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { schedulePartnerPackWebhooks } from "@/lib/partner-pack-webhook-dispatch";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";

/**
 * Admin: zip headshots + turnaround, upload to Fal storage, enqueue Flux LoRA training.
 * Training runs on Fal; completion via `POST /api/webhooks/fal` when configured, else poll …/dna-lora/sync.
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

  try {
    const webhookUrl = buildFalDnaLoraWebhookUrl();
    const { request_id, trigger_word } = await enqueueActorDnaLoraTraining(actor, {
      webhookUrl: webhookUrl ?? undefined,
    });

    const { error: upErr } = await supabase
      .from("actors")
      .update({
        dna_lora_fal_request_id: request_id,
        dna_lora_trigger: trigger_word,
        dna_lora_status: "queued",
        dna_lora_error: null,
      })
      .eq("id", actorId);

    if (upErr) {
      if (/column/i.test(upErr.message) && /does not exist/i.test(upErr.message)) {
        return NextResponse.json(
          {
            error:
              "Database missing DNA LoRA columns. Apply migration supabase/migrations/20260421130000_actors_dna_lora_fal.sql (e.g. npm run db:push).",
          },
          { status: 501 },
        );
      }
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    schedulePartnerPackWebhooks(actorId, "character.pack_updated");

    revalidatePath(`/actors/${actorId}`);
    revalidatePath("/");

    const webhookConfigured = Boolean(webhookUrl);
    return NextResponse.json({
      ok: true,
      request_id,
      trigger_word,
      webhook_configured: webhookConfigured,
      message: webhookConfigured
        ? "Training queued on Fal. This deploy will be notified via webhook when the job finishes."
        : "Training queued on Fal. Set NEXT_PUBLIC_APP_URL (or deploy to Vercel) and FAL_WEBHOOK_SECRET for auto-complete; otherwise use Check Fal status.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Training enqueue failed.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
