import {
  coerceCastingHeightEnum,
  coerceCastingRaceEthnicityEnum,
  coerceCastingSexEnum,
} from "@/lib/casting-picklists";
import { sanitizeRtfImportFieldText } from "@/lib/sanitize-rtf-import-field";
import fieldMap from "@/lib/actor-import-field-map.json";

type FieldDef = {
  num: number;
  column: string;
  required?: boolean;
  array?: boolean;
};

const MIN_AGE = 0;
const MAX_AGE = 100;

function parseList(raw: string): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function numericAgeSpanFromImportString(raw: string): { min: number; max: number } | null {
  const t = sanitizeRtfImportFieldText(raw);
  if (!t) return null;
  const dash = /^(\d{1,3})\s*[-–]\s*(\d{1,3})$/.exec(t);
  if (dash) {
    let a = Number.parseInt(dash[1], 10);
    let b = Number.parseInt(dash[2], 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (a > b) [a, b] = [b, a];
    if (a < MIN_AGE || b > MAX_AGE) return null;
    return { min: a, max: b };
  }
  const single = /^(\d{1,3})$/.exec(t);
  if (single) {
    const n = Number.parseInt(single[1], 10);
    if (!Number.isFinite(n) || n < MIN_AGE || n > MAX_AGE) return null;
    return { min: n, max: n };
  }
  return null;
}

/**
 * Build a Supabase `actors` insert/update payload from numbered field files.
 * @param files — map of field number → raw file text
 * @param inheritedPack — from parent folder or DEFAULT_PACK when flat layout
 */
export function buildActorRowFromNumberedFiles(
  files: Map<number, string>,
  inheritedPack: string | null | undefined,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  const defs = fieldMap.files as FieldDef[];

  for (const f of defs) {
    const raw = files.get(f.num);
    if (raw == null) continue;
    const cleaned = sanitizeRtfImportFieldText(String(raw));
    if (!cleaned) continue;
    if (f.array) {
      row[f.column] = parseList(cleaned);
    } else {
      row[f.column] = cleaned;
    }
  }

  if (row.stage_name != null && !String(row.stage_name).trim()) {
    delete row.stage_name;
  }

  const name = row.name != null ? String(row.name).trim() : "";
  if (!name) {
    throw new Error("Missing required field 1 (name).");
  }

  const filePack = row.pack_name != null && String(row.pack_name).trim() ? String(row.pack_name).trim() : "";
  if (filePack) {
    row.pack_name = filePack;
  } else if (inheritedPack?.trim()) {
    row.pack_name = sanitizeRtfImportFieldText(inheritedPack.trim());
  } else {
    delete row.pack_name;
  }

  const ar = row.age_range != null ? String(row.age_range).trim() : "";
  if (ar) {
    const span = numericAgeSpanFromImportString(ar);
    if (span) {
      row.age_range_min = span.min;
      row.age_range_max = span.max;
    }
  }

  row.tags = Array.isArray(row.tags) && row.tags.length ? row.tags : [];
  row.search_keywords = Array.isArray(row.search_keywords) ? row.search_keywords : [];
  row.traits = Array.isArray(row.traits) ? row.traits : [];

  const hs = row.headshot_urls;
  if (Array.isArray(hs) && hs.length) {
    const urls = hs.slice(0, 5).filter((u) => typeof u === "string" && u.trim());
    if (urls.length) {
      row.headshot_urls = urls;
      row.headshot_url = urls[0].trim();
    } else {
      delete row.headshot_urls;
    }
  } else {
    delete row.headshot_urls;
  }

  if (row.ethnicity != null && String(row.ethnicity).trim()) {
    row.ethnicity = coerceCastingRaceEthnicityEnum(String(row.ethnicity));
  }
  if (row.sex != null && String(row.sex).trim()) {
    row.sex = coerceCastingSexEnum(String(row.sex));
  }
  if (row.height != null && String(row.height).trim()) {
    row.height = coerceCastingHeightEnum(String(row.height));
  }

  return row;
}
