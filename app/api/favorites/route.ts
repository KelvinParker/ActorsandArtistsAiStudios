import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { data, error } = await supabase
    .from("user_favorites")
    .select("actor_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const actorIds = (data ?? [])
    .map((row) => row.actor_id)
    .filter((id): id is string => typeof id === "string");

  return NextResponse.json({ actorIds });
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const actorId =
    typeof body === "object" &&
    body !== null &&
    "actorId" in body &&
    typeof (body as { actorId: unknown }).actorId === "string"
      ? (body as { actorId: string }).actorId.trim()
      : "";

  if (!actorId) {
    return NextResponse.json({ error: "Missing actorId" }, { status: 400 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const { error } = await supabase
    .from("user_favorites")
    .upsert({ user_id: userId, actor_id: actorId }, { onConflict: "user_id,actor_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
