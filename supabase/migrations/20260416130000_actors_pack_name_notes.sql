-- Administrative metadata: library pack label and production notes.

alter table public.actors add column if not exists pack_name text;

alter table public.actors add column if not exists notes text;

comment on column public.actors.pack_name is
  'Demographic / library batch label (e.g. The Delta Blues, The Youth League). Complements taxonomy.';

comment on column public.actors.notes is
  'Production-specific notes (final free-text column for ops).';
