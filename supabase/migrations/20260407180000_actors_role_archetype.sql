-- Story archetype field used by create/admin pipelines.

alter table public.actors add column if not exists role_archetype text;

comment on column public.actors.role_archetype is
  'Narrative role/archetype shorthand (e.g., reluctant star, mentor, rival).';
