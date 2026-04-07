-- Marcus King — height 6'1", weight 195 lbs (canonical physical stats).

update public.actors
set
  height = '6''1"',
  weight = '195 lbs'
where name ilike 'marcus king';
