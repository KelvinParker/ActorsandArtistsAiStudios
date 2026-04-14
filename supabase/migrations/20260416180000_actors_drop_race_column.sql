-- Single heritage column: keep `ethnicity`, drop duplicate `race`.
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
    set ethnicity = case
      when a.ethnicity is not null
        and btrim(a.ethnicity::text) <> ''
        and btrim(lower(a.ethnicity::text)) not in ('n/a', 'na')
      then a.ethnicity
      else a.race
    end;

    alter table public.actors drop column race;
  end if;
end;
$migration$;

comment on column public.actors.ethnicity is
  'Heritage / casting label (admin + import 6.txt / 7.txt / RTF). Enum `casting_race_ethnicity` when casting migrations are applied.';
