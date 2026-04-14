/** Canonical public origin for links in API responses (matches Fal webhook base logic). */
export function getPublicSiteUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (u) return u.replace(/\/$/, "");
  const v = process.env.VERCEL_URL?.trim();
  if (v) return `https://${v.replace(/^https?:\/\//i, "")}`.replace(/\/$/, "");
  return null;
}
