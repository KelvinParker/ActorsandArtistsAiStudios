-- Run in Supabase SQL Editor if migration was not applied via CLI.

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
