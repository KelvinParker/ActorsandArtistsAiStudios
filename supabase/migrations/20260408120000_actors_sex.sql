alter table public.actors add column if not exists sex text;

comment on column public.actors.sex is
  'Casting-facing sex/gender presentation (free text or controlled labels).';
