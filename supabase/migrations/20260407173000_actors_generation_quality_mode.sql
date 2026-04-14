-- Records whether a character was generated in fast or studio mode.

alter table public.actors add column if not exists generation_quality_mode text;

comment on column public.actors.generation_quality_mode is
  'Generation preset used at creation time: fast or studio.';
