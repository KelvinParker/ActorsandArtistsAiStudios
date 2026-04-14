import Link from "next/link";
import { fetchActorsForGallery } from "@/lib/actors-query";
import { createSupabaseServerClient } from "@/lib/supabase";
import { GalleryOrderClient, type GalleryOrderRow } from "./gallery-order-client";

export const metadata = {
  title: "Gallery order — Admin",
};

export default async function GalleryOrderPage() {
  const supabase = createSupabaseServerClient();
  const { actors, error } = await fetchActorsForGallery(supabase);

  const rows: GalleryOrderRow[] = actors.map((a) => ({
    id: a.id,
    name: a.name,
    pack_name: a.pack_name ?? null,
    gallery_sort_order:
      typeof a.gallery_sort_order === "number" ? a.gallery_sort_order : null,
  }));

  return (
    <div>
      <h1
        className="mb-2 text-2xl font-bold tracking-tight text-metallic-orange md:text-3xl"
        style={{
          fontFamily: "var(--font-display), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        Gallery order
      </h1>
      <p className="mb-6 max-w-2xl text-sm text-white/55">
        Use <strong className="text-white/80">Up</strong> and <strong className="text-white/80">Down</strong>{" "}
        to change how actors appear on the home gallery (for example put Marcus King first). Each move
        writes <code className="text-white/65">gallery_sort_order</code> on{" "}
        <code className="text-white/65">public.actors</code> — the same column you see in the Supabase
        Table Editor (refresh the table there if values look stale). Editing that column in Supabase
        changes the public gallery on the next page load.
      </p>
      {error ? (
        <p className="mb-6 rounded-sm border border-metallic-orange/35 bg-metallic-orange/10 px-3 py-2 text-sm text-metallic-orange">
          Could not load actors ({error.message}).
        </p>
      ) : null}
      <p className="mb-8 text-xs text-white/40">
        <Link href="/" className="text-metallic-orange underline-offset-2 hover:underline">
          ← Home gallery
        </Link>
      </p>
      <GalleryOrderClient initialRows={rows} />
    </div>
  );
}
