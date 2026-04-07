-- Copy ALL of this file into Supabase SQL Editor and Run once.
-- Same as migration: supabase/migrations/20260412000000_actors_casting_enum_dropdowns.sql
-- After this, Table Editor shows dropdowns for sex, height, race, ethnicity.

-- Supabase Table Editor: dropdowns for sex, height, race, ethnicity (Postgres ENUMs).
-- Run once. Temporary cast helpers are dropped at the end of this script.

begin;

create type public.casting_sex as enum (
  'Male',
  'Female',
  'Non-binary',
  'Trans man',
  'Trans woman',
  'Genderqueer / gender non-conforming',
  'Agender',
  'Two-Spirit',
  'Prefer not to specify',
  'N/A'
);

create type public.casting_height as enum (
  'N/A',
  '4''10"',
  '4''11"',
  '5''0"',
  '5''1"',
  '5''2"',
  '5''3"',
  '5''4"',
  '5''5"',
  '5''6"',
  '5''7"',
  '5''8"',
  '5''9"',
  '5''10"',
  '5''11"',
  '6''0"',
  '6''1"',
  '6''2"',
  '6''3"',
  '6''4"',
  '6''5"',
  '6''6"',
  '6''7"',
  '6''8"',
  '6''9"',
  '6''10"',
  '6''11"',
  '7''0"'
);

create type public.casting_race_ethnicity as enum (
  'Afghan',
  'African (unspecified region)',
  'African American',
  'Afro-Caribbean',
  'Afro-Latino',
  'Arab',
  'Armenian',
  'Bangladeshi',
  'Biracial',
  'Black',
  'Black British',
  'Black Canadian',
  'Cambodian',
  'Central Asian heritage',
  'Chinese',
  'Cuban',
  'Dominican',
  'East African heritage',
  'Egyptian',
  'Ethiopian',
  'Filipino',
  'French Canadian',
  'German',
  'Ghanaian',
  'Greek',
  'Guatemalan',
  'Haitian',
  'Hmong',
  'Indian (South Asian)',
  'Indigenous (Central/South American)',
  'Indigenous Australian',
  'Inuit',
  'Iranian',
  'Irish',
  'Israeli',
  'Italian',
  'Jamaican',
  'Japanese',
  'Jewish (ethnic/cultural)',
  'Korean',
  'Latin American',
  'Latino',
  'Lebanese',
  'Marshallese',
  'Mexican',
  'Middle Eastern',
  'Multiracial',
  'Native American',
  'Native Hawaiian',
  'Nigerian',
  'North African heritage',
  'Pacific Islander',
  'Pakistani',
  'Palestinian',
  'Persian',
  'Polish',
  'Portuguese',
  'Puerto Rican',
  'Romani',
  'Russian',
  'Salvadoran',
  'Samoan',
  'Scottish',
  'Somali',
  'South Asian',
  'Southeast Asian',
  'Southern African heritage',
  'Spanish',
  'Sri Lankan',
  'Syrian',
  'Taiwanese',
  'Thai',
  'Tongan',
  'Turkish',
  'Ukrainian',
  'Vietnamese',
  'Welsh',
  'West African heritage',
  'White',
  'White British',
  'White European (general)',
  'Prefer not to specify',
  'N/A'
);

create or replace function public.try_cast_casting_sex(input text)
returns public.casting_sex
language plpgsql
immutable
as $fn$
begin
  if input is null or btrim(input) = '' then
    return null;
  end if;
  if lower(btrim(input)) in ('n/a', 'na') then
    return 'N/A'::public.casting_sex;
  end if;
  return btrim(input)::public.casting_sex;
exception
  when invalid_text_representation then
    return null;
end;
$fn$;

create or replace function public.try_cast_casting_height(input text)
returns public.casting_height
language plpgsql
immutable
as $fn$
begin
  if input is null or btrim(input) = '' then
    return null;
  end if;
  if lower(btrim(input)) in ('n/a', 'na') then
    return 'N/A'::public.casting_height;
  end if;
  return btrim(input)::public.casting_height;
exception
  when invalid_text_representation then
    return null;
end;
$fn$;

create or replace function public.try_cast_casting_race_ethnicity(input text)
returns public.casting_race_ethnicity
language plpgsql
immutable
as $fn$
begin
  if input is null or btrim(input) = '' then
    return null;
  end if;
  if lower(btrim(input)) in ('n/a', 'na') then
    return 'N/A'::public.casting_race_ethnicity;
  end if;
  return btrim(input)::public.casting_race_ethnicity;
exception
  when invalid_text_representation then
    return null;
end;
$fn$;

alter table public.actors
  alter column sex drop default,
  alter column sex type public.casting_sex using public.try_cast_casting_sex(sex::text),
  alter column sex set default 'N/A'::public.casting_sex;

alter table public.actors
  alter column height drop default,
  alter column height type public.casting_height using public.try_cast_casting_height(height::text),
  alter column height set default 'N/A'::public.casting_height;

alter table public.actors
  alter column race drop default,
  alter column race type public.casting_race_ethnicity using public.try_cast_casting_race_ethnicity(race::text);

alter table public.actors
  alter column ethnicity drop default,
  alter column ethnicity type public.casting_race_ethnicity using public.try_cast_casting_race_ethnicity(ethnicity::text),
  alter column ethnicity set default 'N/A'::public.casting_race_ethnicity;

comment on column public.actors.sex is 'Casting sex/gender; enum for Table Editor dropdown.';
comment on column public.actors.height is 'Casting height; enum for Table Editor dropdown.';
comment on column public.actors.race is 'Race / ethnicity text; enum aligned with taxonomy seed.';
comment on column public.actors.ethnicity is 'Ethnicity; same enum as race for editor consistency.';

drop function public.try_cast_casting_sex(text);
drop function public.try_cast_casting_height(text);
drop function public.try_cast_casting_race_ethnicity(text);

commit;
