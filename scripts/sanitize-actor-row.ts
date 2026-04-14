/**
 * One-shot: clean RTF `txt` / backslash noise on string columns for one actor row (default Marcus King).
 *
 * Run from repo root:
 *   npm run actors:sanitize-row
 *   npm run actors:sanitize-row -- --id=<uuid>
 *   npm run actors:sanitize-row -- --name="Marcus King"
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import {
  coerceCastingHeightEnum,
  coerceCastingRaceEthnicityEnum,
  coerceCastingSexEnum,
} from "../lib/casting-picklists";
import { sanitizeRtfImportFieldText } from "../lib/sanitize-rtf-import-field";

const SKIP_KEYS = new Set([
  "id",
  "taxonomy",
  "created_at",
  "updated_at",
  "age_range_min",
  "age_range_max",
  "is_user_generated",
  "visibility",
]);

function argVal(flag: string): string | null {
  const raw = process.argv.find((a) => a.startsWith(`${flag}=`));
  if (!raw) return null;
  return raw.slice(flag.length + 1).trim() || null;
}

function cleanScalar(key: string, val: unknown): unknown {
  if (val == null) return val;
  if (typeof val !== "string") return val;
  let s = sanitizeRtfImportFieldText(val);
  if (!s) return null;
  if (key === "ethnicity") return coerceCastingRaceEthnicityEnum(s);
  if (key === "sex") return coerceCastingSexEnum(s);
  if (key === "height") return coerceCastingHeightEnum(s);
  return s;
}

function cleanValue(key: string, val: unknown): unknown {
  if (val == null) return val;
  if (Array.isArray(val)) {
    const out = val
      .map((x) => (typeof x === "string" ? sanitizeRtfImportFieldText(x) : x))
      .filter((x) => x !== "" && x != null);
    return out.length ? out : null;
  }
  return cleanScalar(key, val);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const id = argVal("--id");
  const nameQ = argVal("--name") ?? "Marcus King";

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let q = supabase.from("actors").select("*").limit(20);
  if (id) {
    q = q.eq("id", id);
  } else {
    q = q.ilike("name", `%${nameQ.replace(/%/g, "")}%`);
  }

  const { data: rows, error: qe } = await q;
  if (qe) {
    console.error(qe.message);
    process.exit(1);
  }
  if (!rows?.length) {
    console.error("No matching actor row.");
    process.exit(1);
  }
  if (rows.length > 1 && !id) {
    console.error(
      `Multiple matches (${rows.length}). Pass --id=<uuid>. IDs:\n${rows.map((r) => (r as { id: string }).id).join("\n")}`,
    );
    process.exit(1);
  }

  const row = rows[0] as Record<string, unknown>;
  const actorId = String(row.id);
  const patch: Record<string, unknown> = {};

  for (const [k, v] of Object.entries(row)) {
    if (SKIP_KEYS.has(k)) continue;
    const next = cleanValue(k, v);
    const same =
      typeof v === "object" && v !== null && typeof next === "object" && next !== null
        ? JSON.stringify(v) === JSON.stringify(next)
        : v === next;
    if (!same) patch[k] = next;
  }

  if (Object.keys(patch).length === 0) {
    console.log("Nothing to change (already clean).");
    process.exit(0);
  }

  console.log("Updating columns:", Object.keys(patch).join(", "));
  const { error: ue } = await supabase.from("actors").update(patch).eq("id", actorId);
  if (ue) {
    console.error(ue.message);
    process.exit(1);
  }
  console.log("OK — actor", actorId, "updated.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
