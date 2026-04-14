"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { moveGalleryActorAction } from "./actions";

export type GalleryOrderRow = {
  id: string;
  name: string;
  pack_name: string | null;
  gallery_sort_order: number | null;
};

export function GalleryOrderClient({ initialRows }: { initialRows: GalleryOrderRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  const move = (actorId: string, direction: "up" | "down") => {
    setErr(null);
    startTransition(async () => {
      const r = await moveGalleryActorAction(actorId, direction);
      if (!r.ok) {
        setErr(r.error);
        return;
      }
      router.refresh();
    });
  };

  if (initialRows.length === 0) {
    return (
      <p className="rounded-sm border border-white/15 bg-black/35 px-4 py-3 text-sm text-white/60">
        No actors in the database yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {err ? (
        <p className="rounded-sm border border-metallic-orange/35 bg-metallic-orange/10 px-3 py-2 text-sm text-metallic-orange">
          {err}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-sm border border-white/10">
        <table className="w-full min-w-[520px] text-left text-sm">
          <thead>
            <tr className="border-b border-white/10 text-[11px] font-semibold uppercase tracking-wider text-white/45">
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Pack</th>
              <th className="px-3 py-2 text-right tabular-nums" title="Stored on the row in Postgres">
                DB sort
              </th>
              <th className="px-3 py-2 text-right">Reorder</th>
            </tr>
          </thead>
          <tbody>
            {initialRows.map((row, idx) => (
              <tr key={row.id} className="border-b border-white/5 text-white/85">
                <td className="px-3 py-2.5 font-mono text-xs text-white/50">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <Link
                    href={`/actors/${row.id}`}
                    className="font-medium text-metallic-orange underline-offset-2 hover:underline"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-white/50">{row.pack_name?.trim() || "—"}</td>
                <td className="px-3 py-2.5 text-right font-mono text-xs text-white/55 tabular-nums">
                  {typeof row.gallery_sort_order === "number" ? row.gallery_sort_order : "—"}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      disabled={pending || idx === 0}
                      onClick={() => move(row.id, "up")}
                      className="rounded border border-white/15 bg-black/40 px-2.5 py-1 text-xs font-medium text-white/85 transition hover:border-metallic-orange/45 hover:text-metallic-orange disabled:pointer-events-none disabled:opacity-35"
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      disabled={pending || idx === initialRows.length - 1}
                      onClick={() => move(row.id, "down")}
                      className="rounded border border-white/15 bg-black/40 px-2.5 py-1 text-xs font-medium text-white/85 transition hover:border-metallic-orange/45 hover:text-metallic-orange disabled:pointer-events-none disabled:opacity-35"
                    >
                      Down
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-white/40">
        Order matches the public gallery on the home page. Lower numbers appear first. New imports
        default to the end until you move them.
      </p>
    </div>
  );
}
