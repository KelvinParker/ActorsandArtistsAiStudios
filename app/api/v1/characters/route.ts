import { NextResponse } from "next/server";
import { buildPartnerCatalogExportV1 } from "@/lib/build-partner-catalog-export";
import { partnerExportPreflight } from "@/lib/partner-export-auth";
import { createSupabaseServiceRoleClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Partner catalog: paginated list of actors for integrations (same API key as detail export).
 *
 * Query: `limit` (default 50, max 100), `offset` (default 0), `pack_name` (optional, exact match).
 */
export async function GET(req: Request) {
  const denied = partnerExportPreflight(req);
  if (denied) return denied;

  const url = new URL(req.url);
  let limit = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
  if (!Number.isFinite(limit) || limit < 1) limit = DEFAULT_LIMIT;
  limit = Math.min(Math.floor(limit), MAX_LIMIT);

  let offset = Number.parseInt(url.searchParams.get("offset") ?? "", 10);
  if (!Number.isFinite(offset) || offset < 0) offset = 0;
  offset = Math.floor(offset);

  const packFilter = url.searchParams.get("pack_name")?.trim() || null;

  const supabase = createSupabaseServiceRoleClient();

  let q = supabase
    .from("actors")
    .select("id,name,stage_name,pack_name,headshot_url,headshot_urls,dna_lora_url,dna_lora_status")
    .order("name", { ascending: true });

  if (packFilter) {
    q = q.eq("pack_name", packFilter);
  }

  const { data, error } = await q.range(offset, offset + limit);

  if (error) {
    if (/column/i.test(error.message) && /does not exist/i.test(error.message)) {
      return NextResponse.json(
        {
          error:
            "Database is missing expected columns (e.g. dna_lora_*). Apply latest Supabase migrations.",
        },
        { status: 501 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = data ?? [];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const body = buildPartnerCatalogExportV1(page, {
    limit,
    offset,
    hasMore,
    packNameFilter: packFilter,
  });

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
