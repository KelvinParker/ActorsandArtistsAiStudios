-- Casting field defaults (N/A) + Marcus King physical stats.
-- Safe if sex/height/weight already exist from earlier migrations.

alter table public.actors add column if not exists sex text;
alter table public.actors add column if not exists height text;
alter table public.actors add column if not exists weight text;

alter table public.actors alter column sex set default 'N/A';
alter table public.actors alter column height set default 'N/A';
alter table public.actors alter column weight set default 'N/A';

alter table public.actors alter column ethnicity set default 'N/A';

comment on column public.actors.sex is
  'Casting-facing sex/gender; default N/A until set.';
comment on column public.actors.height is
  'Approximate height; default N/A until set.';
comment on column public.actors.weight is
  'Approximate weight; default N/A until set.';

-- Marcus King — explicit breakdown stats
update public.actors
set
  race = 'African American',
  sex = 'Male',
  height = '6''1"',
  weight = '195 lbs'
where name = 'Marcus King';
