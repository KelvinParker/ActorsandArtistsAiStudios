/**
 * Verifies the same Supabase insert + storage marker path as "Add actor" (no Clerk).
 * Run: npm run smoke:add-actor
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const BUCKET = "actor-assets";

function loadEnvLocal() {
  const p = join(root, ".env.local");
  const txt = readFileSync(p, "utf8");
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[k] = v;
  }
}

function slugify(name) {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "actor";
}

function headshotPayloadEmpty() {
  return {
    headshot_url: null,
    headshot_urls: [],
    headshot_2_url: null,
    headshot_3_url: null,
    headshot_4_url: null,
    headshot_5_url: null,
  };
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error("Need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const testName = `Smoke Add-Actor ${Date.now()}`;
  const insertRow = {
    name: testName,
    age_range: "40-50",
    age_range_min: 40,
    age_range_max: 50,
    race: null,
    sex: null,
    height: null,
    weight: null,
    tags: [],
    turnaround_url: null,
    ...headshotPayloadEmpty(),
  };

  console.log("1) Insert actor row…");
  const { data: created, error: insErr } = await supabase
    .from("actors")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr || !created?.id) {
    console.error("Insert failed:", insErr?.message ?? "no id");
    process.exit(1);
  }

  const id = created.id;
  console.log("   OK id=", id);

  const prefix = `${id}/${slugify(testName)}`;
  const markerPath = `${prefix}/actor-root.txt`;
  const body = `actor_id=${id}\nname=${testName}\n`;

  console.log("2) Storage marker upload…");
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(markerPath, body, {
    contentType: "text/plain;charset=UTF-8",
    upsert: true,
  });

  if (upErr) {
    console.error("Storage marker failed:", upErr.message);
    await supabase.from("actors").delete().eq("id", id);
    process.exit(1);
  }
  console.log("   OK", markerPath);

  console.log("3) Post-insert URL update (empty headshots)…");
  const { error: updErr } = await supabase
    .from("actors")
    .update({
      ...headshotPayloadEmpty(),
      turnaround_url: null,
    })
    .eq("id", id);

  if (updErr) {
    console.error("Update failed:", updErr.message);
    await supabase.from("actors").delete().eq("id", id);
    process.exit(1);
  }
  console.log("   OK");

  console.log("4) Cleanup — delete test row…");
  await supabase.from("actors").delete().eq("id", id);
  await supabase.storage.from(BUCKET).remove([markerPath]);
  console.log("   Done. Add-actor DB + storage path looks good.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
