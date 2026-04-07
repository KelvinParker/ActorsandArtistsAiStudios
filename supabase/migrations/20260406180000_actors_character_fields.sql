-- Character detail fields. Run in Supabase → SQL.

alter table public.actors add column if not exists race text;

alter table public.actors
  add column if not exists traits text[] not null default '{}';

alter table public.actors add column if not exists speech text;

comment on column public.actors.race is 'Race / heritage (optional if ethnicity covers it).';
comment on column public.actors.traits is 'Personality / character traits (e.g. gritty, loyal).';
comment on column public.actors.speech is 'Voice: dialect, cadence, verbal tics.';

-- Optional sample data for Marcus King (remove this block if you prefer to edit in Table Editor)
update public.actors
set
  race = coalesce(nullif(trim(race), ''), nullif(trim(ethnicity), ''), 'African American'),
  traits = case
    when cardinality(traits) = 0
    then array['Gritty', 'Street-smart', 'Protective of family']::text[]
    else traits
  end,
  speech = coalesce(
    nullif(trim(speech), ''),
    'Memphis drawl, measured pace; drops into sharper diction when cornered.'
  )
where name ilike 'marcus king';
