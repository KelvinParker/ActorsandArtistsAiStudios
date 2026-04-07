-- Seed: Marcus King (Dirty South). Run after 20260405140000_create_actors.sql.
-- Supabase MCP is not wired here; run in Dashboard → SQL.
-- Remote DBs with a hand-rolled or partial `actors` table: ensure columns this seed uses.
alter table public.actors add column if not exists age text;
alter table public.actors add column if not exists ethnicity text;
alter table public.actors add column if not exists sex text;
alter table public.actors add column if not exists height text;
alter table public.actors add column if not exists weight text;
alter table public.actors add column if not exists tags text[] not null default '{}'::text[];
alter table public.actors add column if not exists headshot_url text;
alter table public.actors add column if not exists turnaround_url text;

insert into public.actors (
  name,
  age,
  ethnicity,
  sex,
  height,
  weight,
  tags,
  headshot_url,
  turnaround_url
)
select
  'Marcus King',
  '40',
  'African American',
  'Male',
  '6''1"',
  '195 lbs',
  array['Memphis', 'Gritty Vibe']::text[],
  null,
  null
where not exists (
  select 1 from public.actors where name = 'Marcus King'
);
