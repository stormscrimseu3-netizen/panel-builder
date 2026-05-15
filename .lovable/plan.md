## What's broken right now

The Codespaces forwarded port loads but shows:
`ERR_MODULE_NOT_FOUND: Cannot find module '/opt/nebula-panel/dist/server/server.js'`

This is because `start.sh` runs `npm run preview` (Vite preview), but this project is a TanStack Start app built for Cloudflare Workers — `vite preview` then asks the Tanstack plugin to load a Node `server.js` that this build does not produce. So nothing serves on port 3535.

## Plan

### 1. Fix the Codespaces / sandbox boot (root cause of "site doesn't open")
- Stop using `vite preview` in `install.sh`'s `start.sh`.
- In sandbox installs, run the app the same way Lovable's dev server runs it: `npx vite --host 0.0.0.0 --port 3535 --strictPort` (dev server, which works on this stack and binds to the forwarded port immediately).
- Keep VPS behavior (Nginx + systemd) but use the same `vite` command behind it so both VPS and Codespaces serve the real UI.
- Health-check loop already polls `:3535` — keep, but print the last 60 log lines on failure (already there).

### 2. Settings: registration toggle + admin-created users
- Add a new `app_settings` table (singleton row) with `allow_public_signup boolean`.
- Add a `user_roles` table + `app_role` enum (`admin`, `user`) and a `has_role()` SECURITY DEFINER function — first signup auto-becomes `admin`.
- Update `/signup` route: if `allow_public_signup = false`, hide the form and show "Registration is disabled. Ask an admin for an account."
- New page `/settings/users` (admin only):
  - Toggle "Allow public registration".
  - Form: username + email + password → creates a user via a `createServerFn` that uses the admin Supabase client (`supabaseAdmin.auth.admin.createUser`).
  - List existing users with delete.

### 3. Server creation: owner by username + token from file (not typed)
- On `/servers/new`, replace the per-egg "secret variable" inputs with a single **"Bot token / config file"** textarea that gets written to `server_files` as `.env` (or `token.txt` per egg) when the server is created. Startup commands read from the file at runtime.
- Add an "Owner username" input (admin only — regular users own their own server). On submit, server fn looks up `profiles.username` → resolves `user_id` → stores it. Error if username not found.

### 4. Clearer runtime errors (wings / start)
In `wings/src/index.js` (the runner):
- Before starting a server, validate:
  - Node is online (heartbeat < 60s) → otherwise return `Node 'X' is offline — start the wings daemon first.`
  - Required token file exists and is non-empty → otherwise `Missing bot token file (token.txt) for server 'NAME'. Open Files → upload it.`
  - Main file exists → otherwise `Main file 'index.js' not found for server 'NAME'.`
- Surface those messages back to the panel via `console_logs` so the user sees them in the UI.

### 5. Egg refactor: token lives in a file, not a startup variable
- Update `eggs/generic/*.json` and `eggs/games/*.json`: remove `secret: true` env vars like `BOT_TOKEN`; instead declare `files: [{ path: "token.txt", required: true, secret: true }]`.
- Update `src/lib/egg-catalog.ts` types + `src/routes/_authenticated/servers/new.tsx` to render a file editor for each declared file rather than an `<input type=password>`.
- Existing servers keep working (fallback to `egg_variables` when no file is set).

## Technical notes

- Migration adds: `app_settings`, `user_roles`, `app_role` enum, `has_role()`, updated `handle_new_user()` to grant `admin` to the very first user.
- Server functions live in `src/lib/admin.functions.ts` (uses `requireSupabaseAuth` + `has_role` check) and `src/lib/users.functions.ts` (uses `supabaseAdmin` for create/delete).
- Public signup route reads `app_settings.allow_public_signup` via a public server fn (no auth).
- `start.sh` change is one block; no Nginx/systemd unit changes required.

## Order of execution

1. DB migration (settings, roles, first-admin).
2. `install.sh` start command fix → site loads in Codespaces.
3. Admin users page + signup gating.
4. Egg file-based tokens + owner-by-username on server creation.
5. Wings runtime validation + error surfacing.

## Out of scope for this turn

- TLS/Nginx changes (already working on VPS path).
- Migrating existing servers' secret vars into files (manual via admin).
