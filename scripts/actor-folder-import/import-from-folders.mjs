#!/usr/bin/env node
/**
 * Import actors from a local folder tree into Supabase public.actors.
 *
 * Supabase cannot read your disk; this script runs on your computer and uses
 * SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL from .env.local.
 *
 * Usage:
 *   npm run import:actors -- --root "/absolute/path/to/MyActorLibrary" [--dry-run]
 *
 * @see README.md in this folder for folder layout.
 */

import { createClient } from "@supabase/supabase-js";
import {
  readdirSync,
  readFileSync,
  statSync,
  existsSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIELD_MAP_PATH = path.join(__dirname, "../../lib/actor-import-field-map.json");

const MIN_AGE = 0;
const MAX_AGE = 100;

function numericAgeSpanFromString(raw) {
  const t = raw.trim();
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

function readTxtFile(dir, num) {
  const a = path.join(dir, `${num}.txt`);
  const b = path.join(dir, String(num).padStart(2, "0") + ".txt");
  for (const p of [a, b]) {
    if (existsSync(p)) {
      const s = readFileSync(p, "utf8").trim();
      return s === "" ? null : s;
    }
  }
  return null;
}

function parseList(raw) {
  if (!raw || !raw.trim()) return [];
  return raw
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function loadFieldMap() {
  const j = JSON.parse(readFileSync(FIELD_MAP_PATH, "utf8"));
  return j.files;
}

function parseArgs(argv) {
  let root = null;
  let dryRun = false;
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--root" && argv[i + 1]) {
      root = argv[++i];
    } else if (argv[i] === "--dry-run") {
      dryRun = true;
    }
  }
  return { root, dryRun };
}

function isActorDir(dir) {
  return existsSync(path.join(dir, "1.txt")) || existsSync(path.join(dir, "01.txt"));
}

/**
 * Discover (packName | null, actorDir) jobs.
 * - Two levels: root/PackOrGroup/actorName/ with 1.txt → pack from parent folder name.
 * - One level: root/actorName/ with 1.txt → optional DEFAULT_PACK.txt at root (one line).
 */
function discoverJobs(root) {
  const jobs = [];
  const defaultPackFile = path.join(root, "DEFAULT_PACK.txt");
  const defaultPack = existsSync(defaultPackFile)
    ? readFileSync(defaultPackFile, "utf8").trim() || null
    : process.env.IMPORT_DEFAULT_PACK_NAME?.trim() || null;

  const entries = readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory());

  for (const ent of entries) {
    const full = path.join(root, ent.name);
    if (isActorDir(full)) {
      jobs.push({
        packName: defaultPack,
        actorDir: full,
        folderLabel: ent.name,
      });
      continue;
    }
    const packName = ent.name;
    let nested = 0;
    for (const sub of readdirSync(full, { withFileTypes: true })) {
      if (!sub.isDirectory()) continue;
      const actorPath = path.join(full, sub.name);
      if (!isActorDir(actorPath)) continue;
      nested++;
      jobs.push({
        packName,
        actorDir: actorPath,
        folderLabel: `${packName}/${sub.name}`,
      });
    }
    if (nested === 0 && !isActorDir(full)) {
      console.warn(`[skip] No actor folders (missing 1.txt) under: ${full}`);
    }
  }
  return jobs;
}

function buildRow(files, actorDir, inheritedPack) {
  const row = {};
  for (const f of files) {
    const raw = readTxtFile(actorDir, f.num);
    if (raw == null) continue;
    if (f.array) {
      row[f.column] = parseList(raw);
    } else {
      row[f.column] = raw;
    }
  }
  if (!row.name?.trim()) {
    throw new Error(`Missing required file 1.txt (name) in ${actorDir}`);
  }
  const filePack = row.pack_name?.trim() || null;
  if (filePack) {
    row.pack_name = filePack;
  } else if (inheritedPack) {
    row.pack_name = inheritedPack;
  } else {
    delete row.pack_name;
  }

  const ar = row.age_range?.trim();
  if (ar) {
    const span = numericAgeSpanFromString(ar);
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

  return row;
}

async function main() {
  const { root, dryRun } = parseArgs(process.argv);
  if (!root || !existsSync(root)) {
    console.error("Usage: npm run import:actors -- --root \"/absolute/path/to/library\" [--dry-run]");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    process.exit(1);
  }

  const files = loadFieldMap();
  const supabase = createClient(url, key);
  const jobs = discoverJobs(root);

  if (jobs.length === 0) {
    console.error("No actor folders found. Use pack/actor/ with 1.txt in each actor folder, or flat actor/ with 1.txt plus optional DEFAULT_PACK.txt at root.");
    process.exit(1);
  }

  console.log(`Found ${jobs.length} actor folder(s) under ${root}`);
  let ok = 0;
  let fail = 0;

  for (const job of jobs) {
    try {
      const payload = buildRow(files, job.actorDir, job.packName);
      const name = payload.name.trim();
      console.log(`\n→ ${job.folderLabel} → name: "${name}"`);

      if (dryRun) {
        console.log(JSON.stringify(payload, null, 2));
        ok++;
        continue;
      }

      const pack = payload.pack_name ?? null;
      let existingId = null;
      let lookup = supabase.from("actors").select("id").eq("name", name);
      if (pack != null) lookup = lookup.eq("pack_name", pack);
      else lookup = lookup.is("pack_name", null);
      const { data: rows, error: qErr } = await lookup.limit(1);
      if (qErr) throw qErr;
      if (rows?.length) existingId = rows[0].id;

      if (existingId) {
        const { error: uErr } = await supabase
          .from("actors")
          .update(payload)
          .eq("id", existingId);
        if (uErr) throw uErr;
        console.log(`  Updated existing row ${existingId}`);
      } else {
        const { data: ins, error: iErr } = await supabase
          .from("actors")
          .insert(payload)
          .select("id")
          .single();
        if (iErr) throw iErr;
        console.log(`  Inserted ${ins?.id}`);
      }
      ok++;
    } catch (e) {
      fail++;
      console.error(`  ERROR: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nDone. ${ok} ok, ${fail} failed.`);
  if (dryRun) console.log("(dry-run: no database writes)");
  process.exit(fail > 0 ? 1 : 0);
}

main();
