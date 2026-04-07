-- Run in Supabase → SQL Editor.
-- `ordinal_position` is PostgreSQL’s real column order (what a fresh Table Editor should follow).

select column_name, ordinal_position
from information_schema.columns
where table_schema = 'public'
  and table_name = 'actors'
order by ordinal_position;

-- Expected after migration `20260411170000_actors_column_order_casting_after_ethnicity.sql`:
-- ethnicity (4) → sex (5) → height (6) → weight (7) → tags (8) → …
