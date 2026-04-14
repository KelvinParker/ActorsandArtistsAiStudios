import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { hasSupabaseServiceRoleKey } from "@/lib/supabase";

function timingSafeStringEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

function parseCharacterPackApiKeys(): string[] {
  const raw = process.env.CHARACTER_PACK_API_KEYS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function characterPackApiKeysConfigured(): boolean {
  return parseCharacterPackApiKeys().length > 0;
}

/**
 * Validates `Authorization: Bearer <key>` or `x-api-key: <key>` against
 * {@link CHARACTER_PACK_API_KEYS} (comma-separated).
 */
/**
 * True when `key` matches one of the configured `CHARACTER_PACK_API_KEYS` entries
 * (for admin registration of outbound webhooks; never log the key).
 */
export function isPlaintextCharacterPackApiKey(key: string): boolean {
  const keys = parseCharacterPackApiKeys();
  if (keys.length === 0) return false;
  return keys.some((k) => timingSafeStringEqual(k, key));
}

export function validateCharacterPackApiKey(req: Request): boolean {
  const keys = parseCharacterPackApiKeys();
  if (keys.length === 0) return false;

  const auth = req.headers.get("authorization") ?? "";
  const bearer =
    auth.length > 7 && auth.slice(0, 7).toLowerCase() === "bearer "
      ? auth.slice(7).trim()
      : "";
  const xkey = req.headers.get("x-api-key")?.trim() ?? "";
  const presented = bearer || xkey;
  if (!presented) return false;

  return keys.some((k) => timingSafeStringEqual(k, presented));
}

/**
 * Shared gate for `GET /api/v1/characters` and `GET /api/v1/characters/[id]`.
 * Returns a JSON {@link NextResponse} if the request must stop, or `null` to continue.
 */
export function partnerExportPreflight(req: Request): NextResponse | null {
  if (!hasSupabaseServiceRoleKey()) {
    return NextResponse.json(
      { error: "Server missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 },
    );
  }

  if (!characterPackApiKeysConfigured()) {
    return NextResponse.json(
      {
        error:
          "Character pack API is not configured. Set CHARACTER_PACK_API_KEYS in the server environment.",
      },
      { status: 503 },
    );
  }

  if (!validateCharacterPackApiKey(req)) {
    const hasHeader =
      Boolean(req.headers.get("authorization")) || Boolean(req.headers.get("x-api-key"));
    return NextResponse.json(
      {
        error: hasHeader
          ? "Invalid API key."
          : "Missing credentials. Use Authorization: Bearer <key> or x-api-key: <key>.",
      },
      { status: hasHeader ? 403 : 401 },
    );
  }

  return null;
}
