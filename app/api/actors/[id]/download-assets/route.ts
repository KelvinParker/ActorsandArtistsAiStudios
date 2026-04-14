import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import JSZip from "jszip";
import { buildProfileImageUrls } from "@/lib/actor-headshots";
import { actorAssetFolderPrefix } from "@/lib/actor-storage-path";
import { fetchActorById } from "@/lib/actors-query";
import { formatPlayingAgeRange } from "@/lib/playing-age";
import { createSupabaseServerClient } from "@/lib/supabase";

type Body = {
  indices?: number[];
  includeTurnaround?: boolean;
  fullPack?: boolean;
};

function safeFilenameSegment(name: string): string {
  return name
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 64) || "character";
}

function extFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const last = u.pathname.split("/").pop() ?? "";
    const dot = last.lastIndexOf(".");
    if (dot === -1) return "jpg";
    const ext = last.slice(dot + 1).toLowerCase();
    return /^[a-z0-9]{1,8}$/.test(ext) ? ext : "jpg";
  } catch {
    return "jpg";
  }
}

async function fetchUrlBytes(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Sign in to download assets." }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const indices = Array.isArray(body.indices)
    ? body.indices.filter((n) => Number.isInteger(n) && n >= 0)
    : [];
  const fullPack = Boolean(body.fullPack);
  const includeTurnaround = fullPack || Boolean(body.includeTurnaround);

  const { id } = await context.params;
  const supabase = createSupabaseServerClient();
  const { actor, error } = await fetchActorById(supabase, id);
  if (error || !actor) {
    return NextResponse.json({ error: "Actor not found" }, { status: 404 });
  }

  const turnaround = actor.turnaround_url?.trim() || null;

  if (!fullPack && indices.length === 0 && !(includeTurnaround && turnaround)) {
    return NextResponse.json(
      { error: "Select at least one headshot or include turnaround." },
      { status: 400 },
    );
  }

  const headshotUrls = buildProfileImageUrls(actor);
  const allowed = new Set(headshotUrls);
  const selectedHeadshots = fullPack
    ? headshotUrls
    : [...new Set(indices)]
        .filter((i) => i < headshotUrls.length)
        .map((i) => headshotUrls[i])
        .filter((u) => allowed.has(u));

  const zip = new JSZip();
  const packPrefix = fullPack
    ? actorAssetFolderPrefix(actor.id, actor.name)
    : "";
  const withPrefix = (name: string) =>
    packPrefix ? `${packPrefix}/${name}` : name;
  let added = 0;

  for (let i = 0; i < selectedHeadshots.length; i++) {
    const url = selectedHeadshots[i];
    const bytes = await fetchUrlBytes(url);
    if (!bytes) continue;
    const ext = extFromUrl(url);
    zip.file(
      withPrefix(`headshots/headshot-${String(i + 1).padStart(2, "0")}.${ext}`),
      bytes,
    );
    added += 1;
  }

  if (includeTurnaround && turnaround) {
    const bytes = await fetchUrlBytes(turnaround);
    if (bytes) {
      const ext = extFromUrl(turnaround);
      zip.file(withPrefix(`turnaround/turnaround.${ext}`), bytes);
      added += 1;
    }
  }

  if (fullPack) {
    const manifest = {
      actor_id: actor.id,
      name: actor.name,
      playing_age: formatPlayingAgeRange(actor),
      ethnicity: actor.ethnicity ?? null,
      sex: actor.sex ?? null,
      height: actor.height ?? null,
      weight: actor.weight ?? null,
      tags: actor.tags ?? [],
      traits: actor.traits ?? [],
      search_keywords: actor.search_keywords ?? [],
      speech: actor.speech ?? null,
      elevenlabs_voice_id: actor.levellabs_speech_id ?? null,
      headshot_count: headshotUrls.length,
      has_turnaround: Boolean(turnaround),
      usage_note:
        "Use only ElevenLabs voice previews/listening that are free for your plan and allowed under ElevenLabs terms; paid or commercial use is separate.",
    };
    zip.file(
      withPrefix("character.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    const textLines = [
      `Character: ${actor.name}`,
      `Actor ID: ${actor.id}`,
      `Playing age: ${formatPlayingAgeRange(actor) ?? "N/A"}`,
      `Ethnicity: ${actor.ethnicity?.trim() || "N/A"}`,
      `Sex: ${actor.sex?.trim() || "N/A"}`,
      `Height: ${actor.height?.trim() || "N/A"}`,
      `Weight: ${actor.weight?.trim() || "N/A"}`,
      `Tags: ${(actor.tags ?? []).join(", ") || "N/A"}`,
      `Traits: ${(actor.traits ?? []).join(", ") || "N/A"}`,
      `Search keywords: ${(actor.search_keywords ?? []).join(", ") || "N/A"}`,
      `Speech notes: ${actor.speech?.trim() || "N/A"}`,
      `ElevenLabs voice ID: ${actor.levellabs_speech_id?.trim() || "N/A"}`,
      "",
      "Use only ElevenLabs voice previews/listening that are free for your plan and allowed under ElevenLabs terms; paid or commercial use is separate.",
    ];
    zip.file(withPrefix("character.txt"), `${textLines.join("\n")}\n`);
  }

  if (added === 0) {
    return NextResponse.json(
      { error: "Could not fetch selected files. Check URLs or try again." },
      { status: 502 },
    );
  }

  const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
  const base = safeFilenameSegment(actor.name);
  const filename = fullPack ? `${base}-character-pack.zip` : `${base}-assets.zip`;

  return new NextResponse(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
