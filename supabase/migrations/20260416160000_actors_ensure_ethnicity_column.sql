-- Ensure public.actors.ethnicity exists (pack import 6.txt, casting UI).
-- If race already uses enum public.casting_race_ethnicity, add ethnicity with the same type.
-- Otherwise add text (legacy DBs before casting enum migration).

do $migration$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'actors'
      and column_name = 'ethnicity'
  ) then
    null;
  elsif
    exists (select 1 from pg_catalog.pg_type where typname = 'casting_race_ethnicity')
    and exists (
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
    )
  then
    alter table public.actors
      add column ethnicity public.casting_race_ethnicity not null default 'N/A'::public.casting_race_ethnicity;
  else
    alter table public.actors add column ethnicity text;
  end if;
end;
$migration$;

comment on column public.actors.ethnicity is
  'Ethnicity (import field 6). Same enum as race when casting_race_ethnicity is in use; otherwise free text until enums are applied.';
