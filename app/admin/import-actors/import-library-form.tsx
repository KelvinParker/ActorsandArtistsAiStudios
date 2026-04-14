"use client";

import Link from "next/link";
import { useCallback, useState, useTransition } from "react";
import { classifyActorImportImages } from "@/lib/classify-actor-import-images";
import {
  parseActorLibraryFolder,
  parseActorLibraryZip,
  type ParsedActorLibraryGroup,
} from "@/lib/parse-actor-library";
import { postActorLibraryImport } from "@/lib/post-actor-library-import";

const inputClass =
  "mt-1 w-full rounded-sm border border-white/15 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-white/35 focus:border-metallic-orange/50 focus:outline-none focus:ring-1 focus:ring-metallic-orange/30";
const labelClass = "block text-xs font-medium uppercase tracking-wider text-metallic-orange/90";

export function ImportLibraryForm() {
  const [defaultPack, setDefaultPack] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runImport = useCallback(async (entries: [string, ParsedActorLibraryGroup][]) => {
    const ordered = entries.filter(([, g]) => g.files.size > 0);
    if (ordered.length === 0) {
      setError(
        "No importable fields found (need 1.txt … 33.txt and/or one .rtf with section titles per actor folder).",
      );
      return;
    }

    const jobs = ordered.map(([actorKey, g]) => {
      const classified = classifyActorImportImages(g.rawImages);
      const rec: Record<string, string> = {};
      for (const [n, t] of g.files) {
        rec[String(n)] = t;
      }
      const parts = actorKey.split("/").filter(Boolean);
      const profileFolderKey = parts.length ? (parts[parts.length - 1] ?? null) : null;
      return { inheritedPack: g.inheritedPack, files: rec, classified, profileFolderKey };
    });

    setError(null);
    setStatus(`Importing ${jobs.length} actor(s)…`);
    startTransition(async () => {
      const res = await postActorLibraryImport(jobs);
      if (!res.ok) {
        setError(res.error);
        setStatus(null);
        return;
      }
      setStatus(`Done: ${res.inserted} inserted, ${res.updated} updated.`);
    });
  }, []);

  const onFolderChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files?.length) return;
      setError(null);
      setStatus("Reading folder…");
      try {
        const map = await parseActorLibraryFolder(files, defaultPack);
        await runImport(Array.from(map.entries()));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Folder read failed");
        setStatus(null);
      }
      e.target.value = "";
    },
    [defaultPack, runImport],
  );

  const onZipChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setError(null);
      setStatus("Reading zip…");
      try {
        const map = await parseActorLibraryZip(file, defaultPack);
        await runImport(Array.from(map.entries()));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Zip read failed");
        setStatus(null);
      }
      e.target.value = "";
    },
    [defaultPack, runImport],
  );

  const onDropZip = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const file = Array.from(e.dataTransfer.files).find((f) => /\.zip$/i.test(f.name));
      if (!file) {
        setError(
          "Drop a .zip file (folder drop is not supported in all browsers—use the folder picker).",
        );
        return;
      }
      setError(null);
      setStatus("Reading zip…");
      try {
        const map = await parseActorLibraryZip(file, defaultPack);
        await runImport(Array.from(map.entries()));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Zip read failed");
        setStatus(null);
      }
    },
    [defaultPack, runImport],
  );

  return (
    <div className="space-y-8">
      <p className="text-sm text-white/50">
        Need AI instructions + click-to-assign images first?{" "}
        <Link href="/admin/actor-pipeline" className="text-metallic-orange underline-offset-2 hover:underline">
          Actor pipeline
        </Link>
        .
      </p>
      <p className="text-sm leading-relaxed text-white/60">
        <strong className="text-white/85">Recommended:</strong> one actor = one folder under a pack
        (e.g. <code className="text-white/70">MyPack/marcus-cook/</code>) so you can find them in admin,
        edit one character, or zip a single subtree without mixing files. Put numbered{" "}
        <code className="text-white/70">1.txt</code>–<code className="text-white/70">33.txt</code> plus
        optional images in that same folder (or <code className="text-white/70">headshots/</code> /{" "}
        <code className="text-white/70">turnaround/</code> inside it). Images upload to Storage and fill{" "}
        <code className="text-white/70">headshot_urls</code> / <code className="text-white/70">turnaround_url</code>
        . See <code className="text-white/70">lib/actor-import-field-map.json</code> and{" "}
        <code className="text-white/70">scripts/actor-folder-import/README.md</code>.
      </p>

      <div>
        <label htmlFor="default-pack" className={labelClass}>
          Default pack name (flat layout only)
        </label>
        <input
          id="default-pack"
          type="text"
          value={defaultPack}
          onChange={(e) => setDefaultPack(e.target.value)}
          className={inputClass}
          placeholder='e.g. Riverside Drive-Thru — Night Shift (when paths are "ActorName/1.txt")'
        />
        <p className="mt-1 text-[11px] text-white/40">
          With <code className="text-white/55">PackName/ActorName/1.txt</code>, the first path segment is{" "}
          <code className="text-white/55">pack_name</code> and the second is the actor folder—still one
          folder per actor. Use this field only when paths look like{" "}
          <code className="text-white/55">ActorName/1.txt</code> (no pack parent); each{" "}
          <code className="text-white/55">ActorName</code> remains its own folder.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDropZip}
        className="rounded-sm border border-dashed border-metallic-orange/35 bg-metallic-orange/5 p-8 text-center"
      >
        <p className="text-sm font-semibold text-metallic-orange">Drop a .zip here</p>
        <p className="mt-2 text-xs text-white/45">
          One zip can be a whole pack: <code className="text-white/55">Pack/ActorFolder/1.txt</code> per
          character, or a single-actor zip: <code className="text-white/55">Pack/ActorFolder/…</code> only.
        </p>
      </div>

      <div>
        <label htmlFor="zip-import" className={labelClass}>
          Or choose .zip file
        </label>
        <input
          id="zip-import"
          type="file"
          accept=".zip,application/zip"
          disabled={pending}
          onChange={onZipChange}
          className="mt-2 block w-full text-sm text-white/70 file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-white/20 file:bg-black/50 file:px-3 file:py-2 file:text-white/90 hover:file:border-metallic-orange/40"
        />
      </div>

      <div>
        <label htmlFor="folder-import" className={labelClass}>
          Or choose folder (Chrome / Edge)
        </label>
        <input
          id="folder-import"
          type="file"
          disabled={pending}
          {...{ webkitdirectory: "" }}
          multiple
          onChange={onFolderChange}
          className="mt-2 block w-full text-sm text-white/70 file:mr-3 file:cursor-pointer file:rounded-sm file:border file:border-white/20 file:bg-black/50 file:px-3 file:py-2 file:text-white/90 hover:file:border-metallic-orange/40"
        />
      </div>

      {status ? (
        <p className="text-sm text-metallic-orange/90" role="status">
          {status}
        </p>
      ) : null}
      {error ? (
        <p
          className="rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
