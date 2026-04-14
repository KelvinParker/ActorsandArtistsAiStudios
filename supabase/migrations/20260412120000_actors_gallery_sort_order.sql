-- Manual home-gallery ordering (lower = earlier). New actors default to end until reordered.

alter table public.actors
  add column if not exists gallery_sort_order integer not null default 100000;

comment on column public.actors.gallery_sort_order is
  'Home gallery order: ascending. Backfilled from name; use admin Gallery order to change.';

create index if not exists actors_gallery_sort_order_idx
  on public.actors (gallery_sort_order asc, name asc);

with ranked as (
  select id, (row_number() over (order by name asc)) - 1 as ord
  from public.actors
)
update public.actors a
set gallery_sort_order = r.ord
from ranked r
where a.id = r.id;
