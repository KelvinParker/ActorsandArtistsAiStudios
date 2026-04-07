# Actors and Artists AI Studios - Runbook

## Purpose
Daily operator checklist for casting admin, shortlist handling, and asset delivery.

## Preflight
- Confirm env vars are present in `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)
- Start app: `npm run dev`
- Verify login works for:
  - one admin account
  - one non-admin account

## Admin: Add or Edit Character
1. Open `"/admin/cast"` for full casting form or `"/admin/add-actor"` for quick add.
2. Fill required fields (`Name`, age range) plus optional tags/traits/speech/keywords.
3. Add headshots (URL and/or upload). Upload wins if both are provided.
4. Save and verify the actor appears in gallery/profile.

## User: Favorites and Downloads
1. Open `"/"` gallery.
2. Heart icons add/remove favorites.
3. Use `Favs` view to filter shortlist.
4. Download options:
   - `Download all favs`
   - `Download selected`
   - single actor `Download pack` (when shown)

## Profile: Asset Pack Download
- On an actor profile, choose headshots and optional turnaround.
- Click `Download selected`.
- Verify zip contains expected files.

## Analytics Events (client-side)
The app emits lightweight events to any available tracker (`plausible`, `gtag`, `posthog`) and logs them in dev console.

Core events:
- `fav_toggle`
- `download_selected_assets`
- `download_character_pack`
- `download_all_favs_click`
- `download_selected_click`
- `add_actor_submit`

## Smoke Test Checklist
- Sign in / sign out works on login and gallery/studio pages.
- Non-admin cannot access admin actions.
- Favorite persists across navigation and refresh.
- Favs filter shows expected cards.
- `Download all favs` and `Download selected` both work.
- Add actor and edit actor both save and appear in gallery.

## Troubleshooting
- **Upload fails / body too large**
  - Verify `next.config.ts` has server action body size configured.
- **Admin save fails with service role error**
  - Confirm `SUPABASE_SERVICE_ROLE_KEY` exists and is non-empty.
- **Favorites do not sync for signed-in user**
  - Check `/api/favorites` responses in browser network panel.
  - Local fallback remains active in browser storage.
- **Schema mismatch**
  - Run migrations: `npm run db:push`
  - If needed, relink project: `npm run db:link`

## Recovery Notes
- Keep actor record edits in app first; avoid manual table edits unless necessary.
- If storage/object links drift, re-save actor from admin form to rewrite canonical URLs.
