-- App stores up to 5 ordered URLs in headshot_urls; headshot_url mirrors [0].
-- actors_column_order migration (20260411170000) set array_length <= 4, which blocked a 5th slot.

alter table public.actors drop constraint if exists actors_headshot_urls_max5;

alter table public.actors
  add constraint actors_headshot_urls_max5 check (
    array_length(headshot_urls, 1) is null
    or array_length(headshot_urls, 1) <= 5
  );

comment on column public.actors.headshot_urls is
  'Ordered headshot URLs (up to 5); headshot_url mirrors the first for legacy queries.';
