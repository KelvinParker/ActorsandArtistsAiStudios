-- Inclusive ages this character can play (casting discovery / gallery filter).

alter table public.actors add column if not exists age_range_min smallint;
alter table public.actors add column if not exists age_range_max smallint;

comment on column public.actors.age_range_min is
  'Inclusive low end of ages this character can play (casting).';
comment on column public.actors.age_range_max is
  'Inclusive high end of ages this character can play (casting).';

alter table public.actors drop constraint if exists actors_age_range_order;
alter table public.actors
  add constraint actors_age_range_order check (
    age_range_min is null
    or age_range_max is null
    or age_range_min <= age_range_max
  );

-- Marcus King: plays ~38–42; single `age` text no longer required for discovery.
update public.actors
set
  age_range_min = 38,
  age_range_max = 42,
  age = null
where name ilike 'marcus king';
