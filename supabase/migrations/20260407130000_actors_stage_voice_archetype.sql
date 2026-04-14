-- Additional character identity columns for music-driven profiles.

alter table public.actors add column if not exists stage_name text;
alter table public.actors add column if not exists vocal_range text;
alter table public.actors add column if not exists personality_archetype text;

comment on column public.actors.stage_name is
  'Public-facing performance/stage identity (can differ from legal/casting name).';
comment on column public.actors.vocal_range is
  'Voice range descriptor for singing roles (e.g., Alto, Tenor).';
comment on column public.actors.personality_archetype is
  'Core motivation/archetype used for narrative consistency.';
