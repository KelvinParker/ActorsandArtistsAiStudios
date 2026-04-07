-- Storage: public bucket for actor images (matches lib/supabase.ts ACTOR_ASSETS_BUCKET).
-- Run in Supabase → SQL → New query → Run.

insert into storage.buckets (id, name, public)
values ('actor-assets', 'actor-assets', true)
on conflict (id) do update set public = excluded.public;

-- Anyone can read objects in this bucket (required for public URLs in headshot_url, etc.).
drop policy if exists "actor-assets public read" on storage.objects;
create policy "actor-assets public read"
on storage.objects
for select
to public
using (bucket_id = 'actor-assets');

-- Upload via Supabase Dashboard → Storage (uses elevated access), or add a secure API route later.
