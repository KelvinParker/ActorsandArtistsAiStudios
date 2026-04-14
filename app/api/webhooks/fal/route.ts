import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  extractDiffusersLoraUrlFromPayload,
  persistActorDnaLoraSync,
  syncActorDnaLoraTrainingOnce,
  verifyFalWebhookQueryToken,
} from "@/lib/fal-dna-lora";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

type FalWebhookBody = {
  request_id?: string;
  gateway_request_id?: string;
  status?: string;
  error?: string;
  payload?: unknown;
};

/**
 * Fal queue callback when a long job (e.g. DNA LoRA training) finishes.
 * Configure by setting `NEXT_PUBLIC_APP_URL` (or rely on `VERCEL_URL`) + `FAL_WEBHOOK_SECRET`;
 * training is submitted with `webhookUrl` from {@link buildFalDnaLoraWebhookUrl}.
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!verifyFalWebhookQueryToken(token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasSupabaseServiceRoleKey()) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  let body: FalWebhookBody;
  try {
    body = (await req.json()) as FalWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const requestId = (body.request_id ?? body.gateway_request_id ?? "").trim();
  if (!requestId) {
    return NextResponse.json({ ok: true, ignored: "no_request_id" });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data: row, error: qErr } = await supabase
    .from("actors")
    .select("id")
    .eq("dna_lora_fal_request_id", requestId)
    .maybeSingle();

  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 500 });
  }
  const actorId = row && typeof (row as { id?: string }).id === "string" ? (row as { id: string }).id : null;
  if (!actorId) {
    return NextResponse.json({ ok: true, ignored: "unknown_request_id" });
  }

  const st = (body.status ?? "").toUpperCase();

  if (st === "ERROR") {
    const msg = (body.error ?? "Fal webhook ERROR").slice(0, 2000);
    const p = await persistActorDnaLoraSync(supabase, actorId, { state: "failed", error: msg });
    if (p.error) {
      return NextResponse.json({ error: p.error.message }, { status: 500 });
    }
    revalidatePath(`/actors/${actorId}`);
    revalidatePath("/");
    return NextResponse.json({ ok: true, actor_id: actorId, status: "failed" });
  }

  if (st === "OK") {
    let loraUrl = extractDiffusersLoraUrlFromPayload(body.payload);
    if (!loraUrl) {
      const sync = await syncActorDnaLoraTrainingOnce(requestId);
      if (sync.state === "completed") {
        loraUrl = sync.loraUrl;
      } else {
        const p = await persistActorDnaLoraSync(supabase, actorId, sync);
        if (p.error) {
          return NextResponse.json({ error: p.error.message }, { status: 500 });
        }
        revalidatePath(`/actors/${actorId}`);
        revalidatePath("/");
        return NextResponse.json({
          ok: true,
          actor_id: actorId,
          status: sync.state,
        });
      }
    }

    if (!loraUrl) {
      return NextResponse.json({ ok: true, ignored: "no_lora_url", actor_id: actorId });
    }

    const p = await persistActorDnaLoraSync(supabase, actorId, {
      state: "completed",
      loraUrl,
    });
    if (p.error) {
      return NextResponse.json({ error: p.error.message }, { status: 500 });
    }
    revalidatePath(`/actors/${actorId}`);
    revalidatePath("/");
    return NextResponse.json({ ok: true, actor_id: actorId, status: "completed" });
  }

  return NextResponse.json({ ok: true, ignored: "unknown_status", status: body.status });
}
