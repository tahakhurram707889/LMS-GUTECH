# Hosted project connection

Project reference: `ckmpzdokhzydnbidcrnr`.

The supplied project URL and publishable key are configured in the ignored `frontend/.env` and `backend/.env` files. The existing `SUPABASE_ANON_KEY` / `VITE_SUPABASE_ANON_KEY` variable names follow the PDF; their values may be modern Supabase publishable keys. These keys do not grant admin access.

The database password was not saved in source or application environment files. It is distinct from an account personal access token and a server API secret.

## Link from a terminal with network access

After `npm install` succeeds, run these from the repository root:

```powershell
npx supabase login
npx supabase link --project-ref ckmpzdokhzydnbidcrnr
npx supabase migration list
```

`supabase/config.toml` and migrations already exist. Do not run `supabase init` over this project or overwrite the configuration. Login authenticates the Supabase account; link can prompt for the project's database password. Enter credentials interactively, without putting them in commands, source, or chat.

Add the server-only secret API key (or legacy service-role key) to `SUPABASE_SERVICE_ROLE_KEY` in `backend/.env`. Do not use the publishable key or database password for that setting. Do not copy a server key into frontend. Startup validation rejects placeholder server keys. Keep the configured value private and verify it locally; it is never printed or bundled into frontend.

Linking does not apply migrations. The 13 migrations and local seed have not passed the live database gate; run the local reset and pgTAP checks documented in README before deploying them. Do not run the local demo seed on the hosted project. Remote Auth settings, including disabling signup, must also be configured and verified separately.

## Current result

Local project settings were updated. The CLI is unavailable, installing it is blocked by npm registry EACCES, and the direct Supabase connection probe failed in this restricted environment. No successful link, login, migration application, or remote configuration change is claimed.

References: [Supabase CLI login](https://supabase.com/docs/reference/cli/supabase-login), [API key types](https://supabase.com/docs/guides/getting-started/api-keys).

## Hosted Auth requirements

Disable public signup, configure the password policy and one-hour recovery expiry, set SMTP, and allow-list the exact frontend reset URL. Copy `supabase/templates/recovery.html` to the recovery template so the link passes a single-use `token_hash` to the API-backed reset screen. For frontend/API deployed on different sites, use production HTTPS and `COOKIE_SAME_SITE=none`; keep `CLIENT_ORIGIN` exact. Link does not push these settings automatically.
