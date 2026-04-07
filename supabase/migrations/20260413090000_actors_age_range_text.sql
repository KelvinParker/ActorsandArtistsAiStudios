-- Typable on-screen age band (e.g. 45-55). App also syncs age_range_min/max when parseable.

alter table public.actors add column if not exists age_range text;

comment on column public.actors.age_range is
  'Free-text age range for display and Table Editor (e.g. 45-55).';

-- Backfill from existing numeric band.
update public.actors
set
  age_range = age_range_min::text || '-' || age_range_max::text
where
  age_range is null
  and age_range_min is not null
  and age_range_max is not null;

-- Legacy single `age` when no band yet.
update public.actors
set
  age_range = btrim(age)
where
  age_range is null
  and age is not null
  and btrim(age) <> '';
