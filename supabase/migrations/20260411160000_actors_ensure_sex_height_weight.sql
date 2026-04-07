-- Casting breakdown columns on `actors` (idempotent — safe if already added by earlier migrations).

alter table public.actors add column if not exists sex text;
alter table public.actors add column if not exists height text;
alter table public.actors add column if not exists weight text;

comment on column public.actors.sex is
  'Casting-facing sex/gender presentation (free text or controlled labels).';
comment on column public.actors.height is
  'Approximate height (e.g. 6 ft 1 in or 185 cm).';
comment on column public.actors.weight is
  'Approximate weight (e.g. 195 lbs).';
