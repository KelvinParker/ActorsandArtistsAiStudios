import { auth, clerkClient } from "@clerk/nextjs/server";

function idAllowlist(): Set<string> {
  const raw = process.env.ADMIN_CLERK_USER_IDS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function emailAllowlist(): Set<string> {
  const raw = process.env.ADMIN_EMAILS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .toLowerCase()
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

function metadataIsAdmin(publicMeta: unknown, privateMeta: unknown): boolean {
  const pub = publicMeta as { role?: string } | null;
  const priv = privateMeta as { role?: string } | null;
  return pub?.role === "admin" || priv?.role === "admin";
}

/**
 * Admin access if any of:
 * - User id is listed in `ADMIN_CLERK_USER_IDS`
 * - Primary email is listed in `ADMIN_EMAILS` (case-insensitive)
 * - Clerk `publicMetadata.role` or `privateMetadata.role` is `"admin"`
 */
export async function getIsAdmin(): Promise<boolean> {
  const { userId } = await auth();
  if (!userId) return false;

  if (idAllowlist().has(userId)) {
    return true;
  }

  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);

    if (metadataIsAdmin(user.publicMetadata, user.privateMetadata)) {
      return true;
    }

    const primaryId = user.primaryEmailAddressId;
    const primaryEmail = user.emailAddresses
      .find((e) => e.id === primaryId)
      ?.emailAddress?.toLowerCase();
    if (primaryEmail && emailAllowlist().has(primaryEmail)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
