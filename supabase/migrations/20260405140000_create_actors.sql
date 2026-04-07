-- Run in Supabase Dashboard → SQL → New query (or use Supabase CLI against this file).
-- Supabase MCP was not available in the dev environment; apply this migration manually.

create table if not exists public.actors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age text,
  ethnicity text,
  sex text,
  height text,
  weight text,
  tags text[] not null default '{}',
  headshot_url text,
  turnaround_url text
);

comment on table public.actors is 'Actor directory; add RLS policies when wiring Clerk + Supabase JWT or server-only access.';
comment on column public.actors.sex is
  'Casting-facing sex/gender presentation (free text or controlled labels).';
comment on column public.actors.height is
  'Approximate height (e.g. 6 ft 1 in or 185 cm).';
comment on column public.actors.weight is
  'Approximate weight (e.g. 195 lbs).';
