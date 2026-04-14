-- Copy heritage from `race` into `ethnicity` when ethnicity is unset (UI is ethnicity-primary).
-- Safe to re-run: only updates rows where ethnicity is null, blank, or generic N/A.
-- Skips entirely if `race` was already dropped (remote DBs ahead of this migration).

do $migration$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'actors'
      and column_name = 'race'
  ) then
    update public.actors as a
    set ethnicity = a.race
    where a.race is not null
      and btrim(a.race::text) <> ''
      and btrim(lower(a.race::text)) not in ('n/a', 'na')
      and (
        a.ethnicity is null
        or btrim(a.ethnicity::text) = ''
        or btrim(lower(a.ethnicity::text)) in ('n/a', 'na')
      );
  end if;
end;
$migration$;
