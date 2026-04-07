-- Marcus King — ensure casting sex is Male (case-insensitive name match; idempotent).

update public.actors
set sex = 'Male'
where name ilike 'marcus king';
