import Link from "next/link";

type Props = { searchParams: Promise<{ reason?: string }> };

/**
 * Shown when /admin/* blocks access (not signed in or not on allowlist).
 * Lives outside `app/admin/` so it is not wrapped by the admin layout.
 */
export default async function AdminAccessPage({ searchParams }: Props) {
  const { reason } = await searchParams;
  const signedOut = reason === "sign-in";

  return (
    <div className="min-h-full bg-cinematic-black px-6 py-16 text-foreground">
      <main className="mx-auto max-w-lg text-center">
        <h1 className="mb-4 text-2xl font-bold text-metallic-orange">
          Admin access
        </h1>
        {signedOut ? (
          <p className="mb-6 text-sm text-white/65">
            Sign in first (use the Sign in control on the site), then open the
            admin link again.
          </p>
        ) : (
          <p className="mb-6 text-sm text-white/65">
            You are signed in, but this account is not configured as an admin
            yet.
          </p>
        )}

        <div className="mb-8 rounded-sm border border-white/10 bg-black/40 p-4 text-left text-xs leading-relaxed text-white/55">
          <p className="mb-3 font-semibold text-white/75">
            Allow admin in <code className="text-metallic-orange/90">.env.local</code>
            (then restart <code className="text-white/70">npm run dev</code>):
          </p>
          <ul className="list-inside list-disc space-y-2">
            <li>
              <code className="text-white/70">ADMIN_EMAILS=you@example.com</code>{" "}
              — must match your Clerk <strong>primary</strong> email
            </li>
            <li>
              Or <code className="text-white/70">ADMIN_CLERK_USER_IDS=user_…</code>{" "}
              from Clerk Dashboard → Users
            </li>
            <li>
              Or in Clerk, set user metadata{" "}
              <code className="text-white/70">role</code> to{" "}
              <code className="text-white/70">&quot;admin&quot;</code>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-sm border border-metallic-orange/50 bg-metallic-orange/15 px-5 py-2.5 text-sm font-semibold text-metallic-orange transition hover:bg-metallic-orange/25"
          >
            ← Back to gallery
          </Link>
          <Link
            href="/admin/cast"
            className="rounded-sm border border-white/20 px-5 py-2.5 text-sm text-white/80 transition hover:border-white/40"
          >
            Try /admin/cast again
          </Link>
        </div>
      </main>
    </div>
  );
}
