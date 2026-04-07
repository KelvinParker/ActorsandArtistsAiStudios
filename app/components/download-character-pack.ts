"use client";

import { trackEvent } from "@/lib/analytics";

function filenameFromHeader(contentDisposition: string, fallback: string): string {
  const match = /filename="([^"]+)"/i.exec(contentDisposition);
  return match?.[1] || fallback;
}

export async function downloadCharacterPack(
  actorId: string,
  actorName: string,
): Promise<void> {
  const res = await fetch(`/api/actors/${actorId}/download-assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fullPack: true }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    trackEvent("download_character_pack_failed", {
      actorId,
      actorName,
      status: res.status,
    });
    throw new Error(payload?.error || "Could not generate character pack.");
  }

  const blob = await res.blob();
  const filename = filenameFromHeader(
    res.headers.get("content-disposition") ?? "",
    `${actorName}-character-pack.zip`,
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  trackEvent("download_character_pack", { actorId, actorName });
}
