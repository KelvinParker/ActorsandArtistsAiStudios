"use client";

import type { InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { collectFilesFromDataTransfer } from "@/lib/collect-data-transfer-files";
import { applyActorLibraryDropAction } from "./actions";

const labelClass =
  "block text-xs font-medium uppercase tracking-wider text-metallic-orange/90";

type Props = {
  actorId: string;
  actorName: string;
};

export function ActorLibraryDropPanel({ actorId, actorName }: Props) {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runUpload = useCallback(
    (entries: { file: File; relativePath: string }[]) => {
      if (entries.length === 0) {
        setErr(
          'No files received. Use “Choose folder” to pick your pack, or drop individual files. Some browsers do not expose a whole folder when you drag it onto the page.',
        );
        return;
      }
      setErr(null);
      setMsg(null);
      const manifest = entries.map((e) => e.relativePath.replace(/\\/g, "/"));
      const fd = new FormData();
      fd.append("actor_id", actorId);
      fd.append("manifest", JSON.stringify(manifest));
      for (const e of entries) {
        fd.append("files", e.file);
      }
      startTransition(async () => {
        const res = await applyActorLibraryDropAction(fd);
        if (!res.ok) {
          setErr(res.error);
          return;
        }
        const parts: string[] = [];
        if (res.textFieldsUpdated > 0) {
          parts.push(`${res.textFieldsUpdated} text field(s) updated`);
        }
        if (res.imagesUpdated) {
          parts.push("images uploaded to storage and URLs saved");
        }
        setMsg(parts.length ? parts.join("; ") + "." : "Done.");
        router.refresh();
      });
    },
    [actorId, router],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setErr(null);
      setMsg(null);
      try {
        const entries = await collectFilesFromDataTransfer(e.dataTransfer);
        runUpload(entries);
      } catch (err) {
        setErr(err instanceof Error ? err.message : "Could not read dropped files.");
      }
    },
    [runUpload],
  );

  const onFolderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      e.target.value = "";
      runUpload(
        files.map((file) => ({
          file,
          relativePath:
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
        })),
      );
    },
    [runUpload],
  );

  const onFilesChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files ? Array.from(e.target.files) : [];
      e.target.value = "";
      runUpload(files.map((file) => ({ file, relativePath: file.name })));
    },
    [runUpload],
  );

  return (
    <fieldset className="space-y-3 rounded-sm border border-metallic-orange/25 bg-metallic-orange/5 p-4">
      <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-metallic-orange/90">
        Replace from pack drop
      </legend>
      <p className="text-[11px] leading-relaxed text-white/50">
        <strong className="text-white/70">Overwrites this actor only.</strong> Drop files here, or use{" "}
        <strong className="text-white/65">Choose folder</strong> for the most reliable path layout. Supported:{" "}
        <code className="text-white/55">.rtf</code> (section titles like import docs), numbered{" "}
        <code className="text-white/55">1.txt</code>–<code className="text-white/55">33.txt</code>, and/or images
        (e.g. <code className="text-white/55">headshots/headshot-01.jpg</code>,{" "}
        <code className="text-white/55">Marcus King Headshot.jpg</code>,{" "}
        <code className="text-white/55">turnaround.png</code>). Only fields present in the drop are updated; images
        replace matching slots.
      </p>
      <p className="text-[11px] text-white/40">
        Editing: <span className="text-white/65">{actorName}</span>
      </p>

      <input
        ref={folderInputRef}
        type="file"
        className="hidden"
        multiple
        {...({ webkitdirectory: "" } as InputHTMLAttributes<HTMLInputElement>)}
        onChange={onFolderChange}
      />
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        multiple
        accept=".rtf,.txt,image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
        onChange={onFilesChange}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={onDrop}
        className={`rounded-sm border-2 border-dashed px-4 py-8 text-center text-sm transition ${
          pending ? "border-white/15 bg-black/30 text-white/35" : "border-metallic-orange/40 bg-black/30 text-white/60"
        }`}
      >
        {pending ? "Applying…" : "Drop files or a folder here"}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => folderInputRef.current?.click()}
          className="rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-xs font-medium text-white/85 hover:border-metallic-orange/45 disabled:opacity-40"
        >
          Choose folder
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-sm border border-white/20 bg-black/40 px-3 py-2 text-xs font-medium text-white/85 hover:border-metallic-orange/45 disabled:opacity-40"
        >
          Choose files
        </button>
      </div>

      {err ? (
        <p className="rounded-sm border border-red-500/35 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-100/95">
          {msg}
        </p>
      ) : null}

      <p className={`${labelClass} !mt-4 text-[10px] font-normal normal-case text-white/35`}>
        This is separate from &quot;Save changes&quot; below — it applies immediately when you drop or pick files.
      </p>
    </fieldset>
  );
}
