-- Paste into Supabase → SQL → New query (NOT the filename).
-- Fixes: "Could not find the 'ethnicity' column of 'actors' in the schema cache"
--
-- If `race` already uses enum public.casting_race_ethnicity (Table Editor shows it),
-- add `ethnicity` with that same type and copy data. Otherwise adds text (legacy DBs).

do $fix$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'actors'
      and column_name = 'ethnicity'
  ) then
    null;
  elsif exists (
    select 1
    from pg_catalog.pg_attribute a
    join pg_catalog.pg_class c on c.oid = a.attrelid
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    join pg_catalog.pg_type t on t.oid = a.atttypid
    where n.nspname = 'public'
      and c.relname = 'actors'
      and a.attname = 'race'
      and not a.attisdropped
      and t.typname = 'casting_race_ethnicity'
  ) then
    execute 'alter table public.actors add column ethnicity public.casting_race_ethnicity';
    execute $copy$
      update public.actors set ethnicity = race
      where ethnicity is null and race is not null
    $copy$;
    execute
      'alter table public.actors alter column ethnicity set default ''N/A''::public.casting_race_ethnicity';
  else
    execute 'alter table public.actors add column if not exists ethnicity text';
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'actors'
        and column_name = 'race'
    ) then
      execute $copy2$
        update public.actors as a
        set ethnicity = a.race::text
        where (a.ethnicity is null or btrim(a.ethnicity::text) = '')
          and a.race is not null
          and btrim(a.race::text) <> ''
      $copy2$;
    end if;
  end if;
end;
$fix$;

-- Wait ~1 minute for PostgREST schema cache, then retry pack drop.
