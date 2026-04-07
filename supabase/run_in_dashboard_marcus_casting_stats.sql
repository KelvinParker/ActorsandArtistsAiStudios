-- Paste in Supabase → SQL Editor → Run.
-- Profile stats use empty → "N/A". This sets Marcus King when sex/height/weight are missing or literal N/A.

update public.actors
set
  race = case
    when race is null or btrim(race) in ('', 'N/A') then 'African American'
    else race
  end,
  ethnicity = case
    when ethnicity is null or btrim(ethnicity) in ('', 'N/A') then 'African American'
    else ethnicity
  end,
  sex = case
    when sex is null or btrim(sex) in ('', 'N/A') then 'Male'
    else sex
  end,
  age = case
    when age is null or btrim(age) in ('', 'N/A') then '40'
    else age
  end,
  height = case
    when height is null or btrim(height) in ('', 'N/A') then '6''1"'
    else height
  end,
  weight = case
    when weight is null or btrim(weight) in ('', 'N/A') then '195 lbs'
    else weight
  end
where name ilike 'marcus king';

select name, race, ethnicity, sex, age, height, weight
from public.actors
where name ilike 'marcus king';
