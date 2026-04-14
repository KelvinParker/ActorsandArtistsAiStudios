-- Outbound partner notifications when character packs change (HTTP POST + HMAC).
-- Register URLs via admin API (Clerk admin); one row per CHARACTER_PACK_API_KEYS identity (hashed).

create table if not exists public.partner_pack_webhooks (
  id uuid primary key default gen_random_uuid(),
  api_key_sha256 text not null unique,
  label text,
  webhook_url text not null,
  signing_secret text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists partner_pack_webhooks_enabled_idx
  on public.partner_pack_webhooks (enabled)
  where enabled = true;

comment on table public.partner_pack_webhooks is
  'Partner outbound URLs for character pack change notifications; api_key_sha256 matches SHA-256 of a key from CHARACTER_PACK_API_KEYS.';
