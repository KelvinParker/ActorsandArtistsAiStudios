import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Public bucket for actor uploads (configure policies in Supabase Dashboard > Storage). */
export const ACTOR_ASSETS_BUCKET = "actor-assets" as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

function resolvePublicSupabaseKey(): string {
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = publishable || anon;
  if (!key) {
    throw new Error(
      "Missing Supabase key: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY (sb_publishable_…) or NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  return key;
}

/**
 * Browser-safe Supabase client. Prefers `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
 * (new sb_publishable_… keys), then legacy anon JWT.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    resolvePublicSupabaseKey(),
  );
}

/**
 * Server-only client for Route Handlers / Server Components.
 * Key order: service role (bypass RLS, never expose) → publishable (sb_publishable_…) → anon JWT.
 */
export function createSupabaseServerClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const key = serviceRole || publishable || anon;
  if (!key) {
    throw new Error(
      "Missing Supabase key: set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, or SUPABASE_SERVICE_ROLE_KEY (server only).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** True when the server has a non-empty `SUPABASE_SERVICE_ROLE_KEY` (admin / RLS bypass). */
export function hasSupabaseServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

/**
 * Server-only: creates taxonomy terms and actor links. Requires
 * `SUPABASE_SERVICE_ROLE_KEY` (never expose to the browser).
 */
export function createSupabaseServiceRoleClient(): SupabaseClient {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (required to create taxonomy tags from the app).",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
