-- Paste into Supabase → SQL Editor → Run (not the file path).
-- Ensures headshot columns exist; sets headshot_urls[1] from headshot_url when array is empty.

alter table public.actors add column if not exists headshot_url text;
alter table public.actors add column if not exists headshot_urls text[] not null default '{}';
alter table public.actors add column if not exists headshot_2_url text;
alter table public.actors add column if not exists headshot_3_url text;
alter table public.actors add column if not exists headshot_4_url text;
alter table public.actors add column if not exists headshot_5_url text;

update public.actors
set headshot_urls = array[headshot_url]::text[]
where (headshot_urls is null or cardinality(headshot_urls) = 0)
  and headshot_url is not null
  and btrim(headshot_url) <> '';

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'actors'
  and column_name like 'headshot%'
order by column_name;
