-- Physical stats + search discovery. Run in Supabase → SQL.

alter table public.actors add column if not exists height text;

alter table public.actors add column if not exists weight text;

alter table public.actors
  add column if not exists search_keywords text[] not null default '{}';

comment on column public.actors.height is 'Approximate height (e.g. 6 ft 1 in or 185 cm).';
comment on column public.actors.weight is 'Approximate weight (e.g. ~210 lbs).';
comment on column public.actors.search_keywords is 'Terms that should surface this character in search (names, nicknames, roles).';

-- Optional sample for Marcus King
update public.actors
set
  height = coalesce(nullif(trim(height), ''), '6''1"'),
  weight = coalesce(nullif(trim(weight), ''), '195 lbs'),
  search_keywords = case
    when cardinality(search_keywords) = 0
    then array[
      'Marcus King',
      'Dirty South',
      'Memphis',
      'urban drama',
      'lead',
      '40s male'
    ]::text[]
    else search_keywords
  end
where name ilike 'marcus king';
