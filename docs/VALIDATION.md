# Validation record

## Username/dashboard update — 2026-10-29

`npm run typecheck`, `npm run lint`, `npm run build`, and `npm run build:scripts -w backend` pass. Lint has no warnings. `npm run test` passes all 13 frontend, 226 backend, and 5 static schema tests. Username login, role-specific routes/metrics, department management, provisioning compensation, and related tests are described in [the implementation guide](USERNAME_AUTH.md).

Migration 0014 and 15 additional pgTAP assertions are authored; no hosted migration was applied. `npm run test:db` failed to connect to the absent local PostgreSQL server at 127.0.0.1:54322. Chromium is not installed; `npm run test:e2e -- --list` discovers 13 workflows but does not execute them. Live RLS, legacy-account migration, SMTP, browser behavior and mobile layout still need acceptance testing. Exact dependency installation is still pending; cached packages differ from manifests. React runtime aliasing and Vitest prebundling resolve the reproduced invalid-hook-call failure. The dated records below describe earlier checks and are retained as history.

Date: 2026-10-26. No live acceptance or deployment sign-off is claimed.

| Check | Result | Evidence / limits |
| --- | --- | --- |
| TypeScript | PASS | `npm run typecheck`: frontend strict compiler; backend source, tests and bootstrap script |
| Application tests | PASS | `npm run test`: 7 frontend, 202 backend and 5 static schema tests |
| Production builds | PASS | `npm run build`: Vite frontend and TypeScript backend; vendor chunks split below 200 kB each |
| Frontend credential scan | PASS | Checked built JavaScript against the configured backend server credential: no match; no credential values printed |
| Project JSON/TOML | PASS | Parsed manifests/configuration with Python JSON/TOML parsers |
| Exact dependency install | PENDING | Registry access returns EACCES. Restored integrity-verified cached packages for validation. Frontend cache contains Router 7.18.4, TanStack Query 5.104.5 and Lucide 1.61.0; manifests pin Router 6.30.1, Query 5.90.5 and Lucide 0.468.0. Root React is 18.3.1 and TypeScript is 5.9.3. Regenerate/review lockfile and verify a clean install with the declared versions. |
| Lint / formatting | BLOCKED | `npm run lint` attempted; eslint executable unavailable. Prettier is also unavailable. Neither check is claimed green. |
| Database migrations / seed | NOT RUN | 13 migrations are authored. Supabase CLI, PostgreSQL and Docker are unavailable. No remote migration or seed applied. |
| pgTAP | NOT RUN | 23 isolation assertions and 16 workflow assertions authored. These must execute against local Supabase; static checks do not validate SQL syntax/runtime or actual RLS. |
| Playwright | NOT RUN | Serial role/feature flows authored under frontend/e2e. Playwright/browser installation and a live seeded test project are required. No E2E or visual/accessibility pass is claimed. |
| Hosted connectivity / SMTP / Realtime | NOT VERIFIED | Earlier direct probe failed under network restrictions. Account recovery delivery, single-use/expiry, session invalidation, two-user chat latency and subscription isolation require real integration checks. |
| CI | NOT RUN | Application and local database jobs are configured; no hosted CI execution in this workspace. |

## What the HTTP tests prove

Every registered LMS route has a validated authorized HTTP case and an unauthenticated case; explicit role routes also have wrong-role checks. These exercise real routing, auth/role/password gates, strict Zod request contracts, multipart handling and controller dispatch while mocking external service execution. Auth tests cover cookie handling, generic errors, rate limits, recovery contracts and inactive-account rejection using mocked providers. Upload tests call the real magic-byte/extension/size validator.

These tests do not prove live RPC business rules. SQL workflow tests separately target deadline rejection, grade bounds, resubmission clearing grades, course isolation, server scoring, duplicate attempts and complaint transitions. Browser flows are not substitutes for the direct SQL isolation suite, and vice versa.

## Remaining deployment gates

Run a clean dependency install and all code checks. Apply migrations and development seed to local Supabase, then run all 39 pgTAP assertions. Verify real Auth/password/refresh/session-revocation behavior; all file scopes and signatures; quiz timing/key isolation; announcements and chat with two users; complaint notices; and responsive keyboard/screen-reader behavior. Configure hosted Auth and SMTP separately, use the supplied recovery email template, and bootstrap a private admin only after migrations pass. Do not deploy the public-password demo seed.

## Known operational limits

- In-process API rate-limit stores need shared state for multiple replicas.
- File/metadata operations can leave owner-scoped orphan files after partial failure; no cleanup worker is shipped.
- Chat timestamp cursors can skip tied timestamps at page boundaries; a compound cursor is the follow-up for heavy simultaneous traffic.
- Picker options are capped at 100; CSV and list endpoints support bounded batches/pagination.
- Unsaved quiz answers are in memory and are lost on reload.
- Recovery delivery itself is not exercised by the Playwright neutral-confirmation test.
- Cross-site production API cookies require `COOKIE_SAME_SITE=none`, HTTPS and the exact allowed frontend origin. Local same-site development defaults to strict.

## Frontend startup crash fix

Reproduced mixed React 19 frontend and React 18 workspace packages: React elements/hooks failed and the ErrorBoundary displayed the reload screen. Added a shared React/ReactDOM resolution policy for Vite and Vitest, preserved conflicting nested runtime/type packages in an ignored local backup, and restored matching React 18 type declarations from verified local npm cache.

Added a startup regression test that mounts the actual AppProviders/AppRouter tree and verifies the login button remains visible with an absent/expired session. All 7 frontend tests and the frontend production build pass after the fix. A real-browser check was unavailable because Chromium is not installed. Restart the frontend with `npm run dev -w frontend -- --force` to discard any running server's old optimized dependencies, then hard-refresh the browser.

## Backend package/startup diagnosis

Backend dependency inspection is clean. The tsx launcher was reproduced failing in Windows user-info initialization and removed from backend commands/dependencies. Development now uses native Node watch plus the TypeScript compiler; operator scripts compile first and run on Node. Typecheck, production build, operator-script build, and all 202 backend tests pass. A native Node HTTP smoke check returned 200 from /api/health and closed cleanly.

Environment resolution is package-relative, validates public/server key roles and hosted JWT project references, and works from the repository root and compiled scripts. Authentication setup/connectivity errors now remain 503 instead of becoming invalid-credential 401s; failed-login cleanup revokes only the new session. Genuine inactive/missing profiles and bad credentials remain generic 401s.

`npm run doctor -w backend` starts successfully, validates the local environment/project configuration and then fails at the blocked Supabase connectivity probe. The npm security audit endpoint is also unreachable, so security advisory status is not verified. See BACKEND_TROUBLESHOOTING.md for commands and scope.
