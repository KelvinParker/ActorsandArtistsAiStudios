import { NextResponse } from "next/server";
import { buildCharacterPackExportV1 } from "@/lib/build-character-pack-export";
import { partnerExportPreflight } from "@/lib/partner-export-auth";
import { fetchActorById } from "@/lib/actors-query";
import { createSupabaseServiceRoleClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Partner / pipeline export: stable JSON for an actor (LoRA URL, trigger, images, voice id, style).
 *
 * Auth: set `CHARACTER_PACK_API_KEYS` (comma-separated) and send either
 * `Authorization: Bearer <key>` or `x-api-key: <key>`.
 */
export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const denied = partnerExportPreflight(req);
  if (denied) return denied;

  const { id } = await context.params;
  const actorId = id?.trim();
  if (!actorId) {
    return NextResponse.json({ error: "Missing actor id." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { actor, error } = await fetchActorById(supabase, actorId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!actor) {
    return NextResponse.json({ error: "Actor not found." }, { status: 404 });
  }

  const body = buildCharacterPackExportV1(actor);
  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
