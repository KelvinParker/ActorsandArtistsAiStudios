import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { isPlaintextCharacterPackApiKey } from "@/lib/partner-export-auth";
import {
  hashCharacterPackApiKey,
  newPartnerWebhookSigningSecret,
} from "@/lib/partner-pack-webhook-dispatch";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";

export const dynamic = "force-dynamic";

type WebhookRow = {
  id: string;
  api_key_sha256: string;
  label: string | null;
  webhook_url: string;
  signing_secret: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

function fingerprintFromHash(sha256: string): string {
  return sha256.slice(0, 12);
}

/**
 * Admin: list outbound partner webhook rows (includes signing secrets — treat as sensitive).
 */
export async function GET() {
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

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("partner_pack_webhooks")
    .select(
      "id, api_key_sha256, label, webhook_url, signing_secret, enabled, created_at, updated_at",
    )
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as WebhookRow[];
  return NextResponse.json({
    webhooks: rows.map((r) => ({
      id: r.id,
      label: r.label,
      webhook_url: r.webhook_url,
      signing_secret: r.signing_secret,
      enabled: r.enabled,
      api_key_fingerprint: fingerprintFromHash(r.api_key_sha256),
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  });
}

type PostBody = {
  api_key?: string;
  webhook_url?: string;
  label?: string | null;
  rotate_secret?: boolean;
  enabled?: boolean;
};

/**
 * Admin: register or update a webhook for one partner API key (must match CHARACTER_PACK_API_KEYS).
 */
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

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const apiKey = String(body.api_key ?? "").trim();
  const webhookUrl = String(body.webhook_url ?? "").trim();
  const rotateSecret = body.rotate_secret === true;
  const enabled = typeof body.enabled === "boolean" ? body.enabled : undefined;

  if (!apiKey || !webhookUrl) {
    return NextResponse.json(
      { error: "Provide api_key and webhook_url." },
      { status: 400 },
    );
  }

  if (!isPlaintextCharacterPackApiKey(apiKey)) {
    return NextResponse.json(
      { error: "api_key must match a value from CHARACTER_PACK_API_KEYS." },
      { status: 403 },
    );
  }

  try {
    const u = new URL(webhookUrl);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return NextResponse.json({ error: "webhook_url must be http(s)." }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid webhook_url." }, { status: 400 });
  }

  const api_key_sha256 = hashCharacterPackApiKey(apiKey);
  const supabase = createSupabaseServiceRoleClient();

  const { data: existing } = await supabase
    .from("partner_pack_webhooks")
    .select("id, signing_secret")
    .eq("api_key_sha256", api_key_sha256)
    .maybeSingle();

  const now = new Date().toISOString();
  const ex = existing as { id?: string; signing_secret?: string } | null;

  if (ex?.id) {
    const patch: Record<string, unknown> = {
      webhook_url: webhookUrl,
      updated_at: now,
    };
    if ("label" in body) {
      patch.label = body.label != null ? String(body.label).trim() || null : null;
    }
    if (typeof enabled === "boolean") {
      patch.enabled = enabled;
    }
    const prevSecret = String((ex as { signing_secret?: string }).signing_secret ?? "");
    let outSecret = prevSecret;
    if (rotateSecret || !prevSecret) {
      outSecret = newPartnerWebhookSigningSecret();
      patch.signing_secret = outSecret;
    }
    const { error: uErr } = await supabase
      .from("partner_pack_webhooks")
      .update(patch)
      .eq("id", ex.id);
    if (uErr) {
      return NextResponse.json({ error: uErr.message }, { status: 500 });
    }
    return NextResponse.json({
      ok: true,
      id: ex.id,
      api_key_fingerprint: fingerprintFromHash(api_key_sha256),
      signing_secret: outSecret,
      rotated: rotateSecret || !prevSecret,
    });
  }

  const signing_secret = newPartnerWebhookSigningSecret();
  const insertLabel =
    "label" in body ? (body.label != null ? String(body.label).trim() || null : null) : null;
  const { data: ins, error: iErr } = await supabase
    .from("partner_pack_webhooks")
    .insert({
      api_key_sha256,
      webhook_url: webhookUrl,
      label: insertLabel,
      signing_secret,
      enabled: enabled ?? true,
      updated_at: now,
    })
    .select("id")
    .single();

  if (iErr) {
    return NextResponse.json({ error: iErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: (ins as { id: string }).id,
    api_key_fingerprint: fingerprintFromHash(api_key_sha256),
    signing_secret,
  });
}

export async function DELETE(req: Request) {
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

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) {
    return NextResponse.json({ error: "Missing id query parameter." }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase.from("partner_pack_webhooks").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
