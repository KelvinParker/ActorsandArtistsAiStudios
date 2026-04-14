"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { getIsAdmin } from "@/lib/auth/is-admin";
import { schedulePartnerPackWebhooks } from "@/lib/partner-pack-webhook-dispatch";
import {
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleKey,
} from "@/lib/supabase";

function isMissingColumnError(message: string): boolean {
  return /\bcolumn\s+[\w.]+\s+does\s+not\s+exist\b/i.test(message);
}

export type GalleryOrderActionResult = { ok: true } | { ok: false; error: string };

type SortRow = { id: string; name: string | null; gallery_sort_order: number | null };

function sortOrderValue(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number.parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return 100000;
}

function sortRows(rows: SortRow[]): SortRow[] {
  return [...rows].sort((a, b) => {
    const ao = sortOrderValue(a.gallery_sort_order);
    const bo = sortOrderValue(b.gallery_sort_order);
    if (ao !== bo) return ao - bo;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""), undefined, {
      sensitivity: "base",
    });
  });
}

export async function moveGalleryActorAction(
  actorId: string,
  direction: "up" | "down",
): Promise<GalleryOrderActionResult> {
  const { userId } = await auth();
  if (!userId || !(await getIsAdmin())) {
    return { ok: false, error: "Unauthorized" };
  }
  if (!hasSupabaseServiceRoleKey()) {
    return { ok: false, error: "Server missing SUPABASE_SERVICE_ROLE_KEY." };
  }
  const id = actorId.trim();
  if (!id) {
    return { ok: false, error: "Missing actor id." };
  }

  const supabase = createSupabaseServiceRoleClient();

  const { data: raw, error: qErr } = await supabase
    .from("actors")
    .select("id, gallery_sort_order, name")
    .order("gallery_sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (qErr) {
    if (isMissingColumnError(qErr.message)) {
      return {
        ok: false,
        error:
          "The database is missing column gallery_sort_order. Apply migration 20260412120000_actors_gallery_sort_order.sql (for example npm run db:push), then reload.",
      };
    }
    return { ok: false, error: qErr.message };
  }

  const rows: SortRow[] = (raw ?? []).map((r) => {
    const rec = r as { id: unknown; name: unknown; gallery_sort_order: unknown };
    return {
      id: String(rec.id),
      name: typeof rec.name === "string" ? rec.name : null,
      gallery_sort_order:
        typeof rec.gallery_sort_order === "number" ? rec.gallery_sort_order : null,
    };
  });

  const sorted = sortRows(rows);
  const i = sorted.findIndex((r) => r.id === id);
  if (i < 0) {
    return { ok: false, error: "Actor not found." };
  }

  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= sorted.length) {
    revalidatePath("/", "page");
    revalidatePath("/", "layout");
    revalidatePath("/admin/gallery-order", "page");
    return { ok: true };
  }

  const a = sorted[i];
  const b = sorted[j];
  const orderA = sortOrderValue(a.gallery_sort_order);
  const orderB = sortOrderValue(b.gallery_sort_order);

  const { error: e1 } = await supabase
    .from("actors")
    .update({ gallery_sort_order: orderB })
    .eq("id", a.id);
  if (e1) return { ok: false, error: e1.message };

  const { error: e2 } = await supabase
    .from("actors")
    .update({ gallery_sort_order: orderA })
    .eq("id", b.id);
  if (e2) return { ok: false, error: e2.message };

  schedulePartnerPackWebhooks(a.id, "character.pack_updated");
  schedulePartnerPackWebhooks(b.id, "character.pack_updated");

  revalidatePath("/", "page");
  revalidatePath("/", "layout");
  revalidatePath("/admin/gallery-order", "page");
  return { ok: true };
}
