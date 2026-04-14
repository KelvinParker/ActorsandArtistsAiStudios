import { createHmac, randomBytes, createHash } from "node:crypto";
import { createSupabaseServiceRoleClient, hasSupabaseServiceRoleKey } from "@/lib/supabase";
import { getPublicSiteUrl } from "@/lib/public-site-url";

const PAYLOAD_VERSION = 1 as const;

export type PartnerPackWebhookEvent =
  | "character.created"
  | "character.pack_updated"
  | "character.deleted";

export type PartnerPackWebhookPayloadV1 = {
  schema_version: typeof PAYLOAD_VERSION;
  event: PartnerPackWebhookEvent;
  actor_id: string;
  occurred_at: string;
  integration: {
    detail_get: string | null;
    catalog_get: string | null;
  };
};

export function hashCharacterPackApiKey(apiKey: string): string {
  return createHash("sha256").update(apiKey, "utf8").digest("hex");
}

function hmacSha256Hex(signingSecretHex: string, body: string): string {
  const key = Buffer.from(signingSecretHex, "hex");
  return createHmac("sha256", key).update(body, "utf8").digest("hex");
}

export function newPartnerWebhookSigningSecret(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Fire-and-forget: POST each enabled partner URL with JSON body and HMAC signature.
 */
export function schedulePartnerPackWebhooks(
  actorId: string,
  event: PartnerPackWebhookEvent,
): void {
  const id = actorId.trim();
  if (!id) return;
  void deliverPartnerPackWebhooks(id, event).catch((e) => {
    console.error("[partner-pack-webhooks] dispatch failed", e);
  });
}

async function deliverPartnerPackWebhooks(
  actorId: string,
  event: PartnerPackWebhookEvent,
): Promise<void> {
  if (!hasSupabaseServiceRoleKey()) return;

  const supabase = createSupabaseServiceRoleClient();
  const { data: rows, error } = await supabase
    .from("partner_pack_webhooks")
    .select("id, webhook_url, signing_secret")
    .eq("enabled", true);

  if (error) {
    if (/partner_pack_webhooks|does not exist|schema cache/i.test(error.message)) {
      return;
    }
    throw error;
  }

  const list = (rows ?? []) as {
    id: string;
    webhook_url: string;
    signing_secret: string;
  }[];
  if (list.length === 0) return;

  const origin = getPublicSiteUrl();
  const occurred_at = new Date().toISOString();
  const payload: PartnerPackWebhookPayloadV1 = {
    schema_version: PAYLOAD_VERSION,
    event,
    actor_id: actorId,
    occurred_at,
    integration: {
      detail_get: origin ? `${origin}/api/v1/characters/${actorId}` : null,
      catalog_get: origin ? `${origin}/api/v1/characters` : null,
    },
  };

  const body = JSON.stringify(payload);

  await Promise.allSettled(
    list.map(async (row) => {
      const url = row.webhook_url?.trim();
      const secret = row.signing_secret?.trim();
      if (!url || !secret || !/^[\da-f]{64}$/i.test(secret)) return;

      const signature = hmacSha256Hex(secret, body);
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), 15_000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Actors-Pack-Event": event,
            "X-Actors-Pack-Signature": `sha256=${signature}`,
          },
          body,
          signal: ac.signal,
        });
        if (!res.ok) {
          console.warn(
            `[partner-pack-webhooks] ${row.id} HTTP ${res.status} ${res.statusText}`,
          );
        }
      } catch (e) {
        console.warn(`[partner-pack-webhooks] ${row.id} request error`, e);
      } finally {
        clearTimeout(t);
      }
    }),
  );
}
