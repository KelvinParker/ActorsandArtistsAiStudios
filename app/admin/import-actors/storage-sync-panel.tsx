"use client";

import { useCallback, useState, useTransition } from "react";
import {
  syncActorsFromStorageAdminAction,
  type StorageSyncAdminResult,
} from "./actions";

const btn =
  "rounded-sm border border-metallic-orange/45 bg-metallic-orange/15 px-4 py-2 text-sm font-semibold text-metallic-orange transition hover:bg-metallic-orange/25 disabled:cursor-not-allowed disabled:opacity-45";

type Props = {
  configured: boolean;
  bucketLabel: string;
  prefix: string;
  defaultPack: string;
};

export function StorageSyncPanel({ configured, bucketLabel, prefix, defaultPack }: Props) {
  const [pending, startTransition] = useTransition();
  const [last, setLast] = useState<StorageSyncAdminResult | null>(null);

  const run = useCallback((dryRun: boolean) => {
    setLast(null);
    startTransition(async () => {
      const res = await syncActorsFromStorageAdminAction(dryRun);
      setLast(res);
    });
  }, []);

  return (
    <section className="rounded-sm border border-white/10 bg-black/30 p-6">
      <h2 className="text-lg font-semibold tracking-tight text-metallic-orange">
        Sync from Supabase Storage
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/60">
        Reads the same layout as zip/folder import under your sync prefix: one folder per actor with
        numbered <code className="text-white/55">1.txt</code>–<code className="text-white/55">33.txt</code>{" "}
        and/or a single <code className="text-white/55">.rtf</code> (section titles → fields), plus
        images under <code className="text-white/55">headshots/</code>,{" "}
        <code className="text-white/55">turnaround/</code>, etc. After the prefix, each object path
        should look like <code className="text-white/55">ActorName/…</code> (not a single segment at
        root). Each actor folder is only re-downloaded when its files change (path + size + updated
        time); apply migration <code className="text-white/55">20260420120000</code> for that behavior.
      </p>
      <p className="mt-3 max-w-2xl rounded-sm border border-white/10 bg-black/40 px-3 py-2 text-xs leading-relaxed text-white/55">
        <strong className="text-metallic-orange/95">Profiles layout:</strong> Put each actor folder
        inside <code className="text-white/60">Profiles/</code>. Set{" "}
        <code className="text-white/60">ACTOR_IMPORT_SYNC_PREFIX</code> to everything{" "}
        <em className="text-white/70">through</em> <code className="text-white/60">Profiles</code> so
        the scanner sees <code className="text-white/60">Camille/Camille.rtf</code>, not{" "}
        <code className="text-white/60">Profiles/Camille/…</code> (that would wrongly use ‘Profiles’ as{" "}
        <code className="text-white/60">pack_name</code>). Example: bucket path{" "}
        <code className="text-white/60">actor-assets/Profiles/Camille/…</code> → prefix{" "}
        <code className="text-white/60">actor-assets/Profiles</code>. Then set{" "}
        <code className="text-white/60">ACTOR_IMPORT_SYNC_DEFAULT_PACK</code> or add{" "}
        <code className="text-white/60">DEFAULT_PACK.txt</code> (one line) inside{" "}
        <code className="text-white/60">Profiles/</code> for the real show/pack name.
      </p>

      {configured ? (
        <ul className="mt-3 space-y-1 font-mono text-[11px] text-white/45">
          <li>
            <span className="text-white/55">Bucket:</span> {bucketLabel}
          </li>
          <li>
            <span className="text-white/55">Prefix:</span> {prefix || "(bucket root)"}
          </li>
          {defaultPack ? (
            <li>
              <span className="text-white/55">Default pack (env):</span> {defaultPack}
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-amber-200/90">
          Set <code className="text-white/70">ACTOR_IMPORT_SYNC_BUCKET</code> in{" "}
          <code className="text-white/70">.env.local</code> (and optionally{" "}
          <code className="text-white/70">ACTOR_IMPORT_SYNC_PREFIX</code>,{" "}
          <code className="text-white/70">ACTOR_IMPORT_SYNC_DEFAULT_PACK</code>), restart Next.js, then
          return here.
        </p>
      )}

      {!configured ? (
        <div
          className="mt-4 rounded-sm border border-amber-500/50 bg-amber-950/50 px-4 py-3 text-sm leading-relaxed text-amber-50/95"
          role="status"
        >
          <strong className="text-amber-200">Why the buttons are disabled:</strong> the server does not
          see <code className="text-white/85">ACTOR_IMPORT_SYNC_BUCKET</code>. Add it to{" "}
          <code className="text-white/85">.env.local</code> for local dev (then restart{" "}
          <code className="text-white/85">npm run dev</code>), or to your host’s environment variables
          for production (then redeploy). Use the <strong>exact</strong> Supabase Storage bucket name
          (e.g. <code className="text-white/85">actor-assets</code>).
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className={btn}
          disabled={!configured || pending}
          title={
            !configured
              ? "Set ACTOR_IMPORT_SYNC_BUCKET in server env and restart or redeploy"
              : pending
                ? "Working…"
                : "List actors that would sync (no database writes)"
          }
          onClick={() => run(true)}
        >
          Dry run (list only)
        </button>
        <button
          type="button"
          className={btn}
          disabled={!configured || pending}
          title={
            !configured
              ? "Set ACTOR_IMPORT_SYNC_BUCKET in server env and restart or redeploy"
              : pending
                ? "Working…"
                : "Write to actors table and upload images from Storage"
          }
          onClick={() => run(false)}
        >
          Sync now
        </button>
      </div>

      {last ? (
        <div className="mt-4 space-y-2 text-sm">
          {last.ok ? (
            <>
              <p className="text-metallic-orange/90">
                {last.report.dryRun ? "Dry run — no writes." : "Sync finished."} Actors seen:{" "}
                {last.report.actorCount} (files: {last.report.fileCount}).{" "}
                Unchanged (skipped): {last.report.unchanged}.{" "}
                {!last.report.dryRun ? (
                  <>
                    Inserted {last.report.inserted}, updated {last.report.updated}, skipped{" "}
                    {last.report.skipped}.
                  </>
                ) : null}
              </p>
              {last.report.actorKeys.length > 0 ? (
                <p className="text-white/55">
                  <span className="text-white/70">Actor keys:</span>{" "}
                  {last.report.actorKeys.join(", ")}
                </p>
              ) : null}
              {last.report.errors.length > 0 ? (
                <ul className="list-inside list-disc rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100/90">
                  {last.report.errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-red-200">
              {last.error}
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
