# Username authentication and role dashboards

Implementation date: 2026-10-29. No hosted schema changes, account creation, or deployment were performed.

## Architecture and authentication flow

The existing Express routes/controllers/services/repositories, Supabase Auth, caller-JWT database clients, RLS, refresh-cookie rotation, first-password gate, and role enum remain in use. No separate role authentication system or public registration was added.

1. Login submits `{username,password}` to `POST /api/auth/login`. A caller-supplied role or email login identifier is rejected by the strict schema.
2. The backend trims/lowercases the username and privately resolves an active profile's ID/email with a server-only Supabase client. This narrow lookup is required before a user JWT exists. It is never exposed as an anonymous username-directory RPC or endpoint.
3. Supabase Auth verifies the password using that internal email. The returned profile ID must match the resolved account. Invalid credentials, unknown usernames, and inactive accounts receive the same generic 401 message. A 500ms minimum response duration reduces obvious lookup timing differences; it does not guarantee constant network timing.
4. The API returns an in-memory access token and trusted profile; the refresh token remains in an HttpOnly cookie. Refresh restores the session after reload. First-login users must change their password before opening academic pages.
5. Existing API middleware checks the Auth identity, live session, active profile, role, and password-change flag. Existing SQL policies and transactional RPCs enforce course membership and ownership independently.
6. Logout revokes sessions and clears the cookie. Password change verifies the current password; recovery uses the existing single-use email token-hash flow. Recovery still asks for the registered email, not the username, and always gives a neutral public response.

Login limits are five attempts per IP/normalized username and thirty attempts per IP per fifteen minutes, plus the existing global limiter. Stores remain in memory: use shared storage for multiple API replicas. HTTPS production cookies must use the appropriate SameSite setting and exact frontend origin.

## Database migration and existing accounts

Review `supabase/migrations/0014_usernames_dashboards.sql`. It adds:

- `profiles.username`, NOT NULL, lowercase/format/length constraints, and a unique index on `lower(username)`.
- A deterministic legacy-account backfill: sanitized email local-part (up to 24 characters), a hyphen, and the full UUID without hyphens. The UUID suffix prevents collisions even when email local-parts match. Existing IDs, passwords, roles, foreign keys, and academic records are preserved.
- Departments with RLS and admin write policies, plus nullable `courses.department_id`. Existing courses remain unassigned.
- `dashboard_summary()`, a gated server-side RPC returning only statistics/upcoming work appropriate to the caller's database role. Admins additionally receive recent audit activity. Teachers count distinct students only in their assigned active courses. Students receive only their own academic totals.

Existing authenticated grants allow only `full_name` profile updates. Users cannot update their own username, role, status, or first-password flag. Administrators change usernames through the authorized backend endpoint. The database rejects noncanonical uppercase values; the API normalizes case first.

Apply all migrations to a fresh **local** Supabase instance first, then run pgTAP. For an existing database, apply only unapplied migrations through your reviewed migration process; do not reset it. Verify the mapping with an operator-only query:

```sql
select id, username, email, role from public.profiles order by role, username;
```

Distribute usernames privately. An existing administrator can then assign shorter usernames through User management. Deploy the updated application after the migration is applied. Take a backup and validate on staging before production rollout. No destructive production command was executed.

## Routes and permission matrix

| Capability | Admin | Teacher | Student |
| --- | --- | --- | --- |
| Dashboard | `/admin/dashboard` | `/teacher/dashboard` | `/student/dashboard` |
| Manage users/status/roles/usernames | Yes | No | No |
| Manage departments/courses/memberships | Yes | No | No |
| Materials and coursework | All authorized administration | Assigned courses | Enrolled courses, read/submit |
| Grade and inspect submissions | Authorized courses | Assigned courses | Own results only |
| Gradebook/report export | Yes | Assigned courses | Own marks page |
| Announcements | Global/course administration | Assigned courses | Authorized feed |
| Profile and password | Own | Own | Own |
| Complaints | Review queue | Own filings | Own filings |

Legacy `/admin`, `/teacher`, and `/student` URLs redirect to the corresponding dashboard. Unauthenticated workspace access redirects to `/login`; wrong-role dashboard/admin pages show an accessible 403 screen. Backend role violations return HTTP 403. Shared feature URLs remain intact. Teacher classroom membership is available at `/students`, using the existing scoped course-members endpoint and pagination.

Dashboard cards, deadlines, student progress, announcements, and activity use backend records. Empty states appear for absent records. Existing dark-purple styling, collapsible mobile navigation, tables, filters, pagination, resource uploads, assignments, quizzes, chat, complaints, profile, and recovery flows are reused. Dashboard loading skeletons honor reduced-motion preferences. Attendance is not modeled in this project and has not been invented.

## Environment and operator setup

No new application secrets are required.

| Location | Variables |
| --- | --- |
| Backend | `NODE_ENV`, `PORT`, `CLIENT_ORIGIN`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PASSWORD_RESET_REDIRECT`, `LOG_LEVEL`, optional `COOKIE_SAME_SITE` |
| Frontend | `VITE_API_URL`, optional `VITE_PORT`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` |
| Bootstrap only | Required `BOOTSTRAP_ADMIN_USERNAME`; `BOOTSTRAP_ADMIN_EMAIL` or interactive email prompt; optional `BOOTSTRAP_ADMIN_NAME`, `BOOTSTRAP_ADMIN_PASSWORD` |

Use ignored local env files or your secret manager. Never use a `VITE_` variable for the service-role key. Backend `.env.example` documents bootstrap settings.

After migration verification, run `npm run bootstrap:admin -w backend` for an empty hosted schema. It preserves an existing admin, reports their username, and never changes their password. For a new admin, it verifies username/password login before reporting success. It never prints passwords or tokens. If you supply a temporary password locally, retain it securely; otherwise it generates one internally and requests an email recovery link. The latter requires working SMTP. The operator still needs to verify recovery delivery.

An admin creates teacher/student accounts under User management with full name, username, recovery email, role, and a temporary password. Password policy is 10–128 characters with a letter and number. The repository checks username availability, creates the Auth identity, and inserts the linked profile with `must_change_password=true`. The database unique index resolves concurrent claims. Failed profile insertion deletes the newly created identity; failed compensation reports `ACCOUNT_CLEANUP_REQUIRED` for operator reconciliation. Passwords are sent only to Supabase Auth and are excluded from profiles, responses, and request logging. Share initial credentials through an institution-approved private channel. No public admin signup exists.

## Local verification

```text
npm install
npm run typecheck
npm run test
npm run lint
npm run build
npm run build:scripts -w backend
npm run db:start
npm run test:db
npm run dev
```

A fresh local database needs migrations and the development seed. `npm run db:reset` initializes them but deletes the local database: use it only for disposable local development. Never apply the demo seed to production. Local fixture usernames are admin, amina, samir, noor, sara, omar, hana, and zain; the README documents their local-only password and mandatory first-password change.

Install Chromium with `npx playwright install chromium`. Set `E2E_ADMIN_USERNAME/PASSWORD`, `E2E_TEACHER_USERNAME/PASSWORD`, `E2E_STUDENT_USERNAME/PASSWORD`, and `E2E_COURSE_ID` for a shared **local test** course, then run `npm run test:e2e`. Optional `E2E_START_SERVERS=true` starts both apps. These workflows write coursework and change temporary passwords. Use a disposable test database.

New unit/HTTP tests cover username normalization, role injection, all three trusted roles, unknown/disabled usernames, identity mismatch cleanup, unique-name provisioning races, partial-failure compensation, redirects, first-password gating, password visibility, wrong-role pages, and unauthenticated access. Existing tests cover session refresh/recovery/logout and feature role boundaries. Fifteen new pgTAP assertions cover username constraints, self-promotion denial, department writes, and dashboard scope; combined with existing suites there are 54 assertions.

## Verification limits

This workspace initially contained React 19 frontend packages alongside React 18 at the root, causing invalid hook calls. A reversible backup of the incompatible nested packages is in ignored `frontend/.dependency-conflicts/username-auth-review/`. The shared Vite aliases and Vitest dependency optimization now consistently resolve the root React 18 runtime, including when cached nested packages are present. A clean dependency installation remains necessary: cached Router/Query/Lucide versions differ from declared versions, as documented in the existing validation record. No manifest version was silently changed.

Current application verification: TypeScript passes; lint passes without warnings; all 13 frontend tests, 226 backend tests, and 5 static schema tests pass (244 total). Frontend/backend production builds and operator-script compilation pass. Vite reports nonfatal ignored `use client` directives from cached third-party packages.

Live SQL tests could not connect to local PostgreSQL at 127.0.0.1:54322; Docker/Postgres were unavailable. Chromium is not installed. Browser E2E, visual/mobile layout, SMTP delivery, actual hosted username migration, and live Supabase RLS/session behavior remain unverified. Playwright test discovery succeeds. Existing quiz draft persistence, timestamp-only chat cursors, and orphan-file cleanup limitations remain outside this authentication change.

## Modified and added source files

Backend:

- `backend/.env.example`
- `backend/scripts/bootstrap-admin.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/repositories/admin.repository.ts`
- `backend/src/repositories/login.repository.ts` (new)
- `backend/src/routes/auth.routes.ts`
- `backend/src/routes/lms.routes.ts`
- `backend/src/schemas/auth.ts`
- `backend/src/schemas/lms.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/services/lms.service.ts`
- `backend/src/utils/auth-errors.ts`
- `backend/tests/auth.test.ts`
- `backend/tests/auth-diagnostics.test.ts`
- `backend/tests/endpoints.test.ts`
- `backend/tests/username.test.ts` (new)
- `backend/tests/provisioning.test.ts` (new)

Frontend:

- `frontend/src/app/router.tsx`
- `frontend/src/app/workspace.tsx`
- `frontend/src/app/styles.css`
- `frontend/src/components/ui/async-state.tsx`
- `frontend/src/components/ui/modal.tsx`
- `frontend/src/features/auth/pages.tsx`
- `frontend/src/features/auth/session.tsx`
- `frontend/src/features/admin/pages.tsx`
- `frontend/src/features/admin/departments.tsx` (new)
- `frontend/src/features/courses/pages.tsx`
- `frontend/src/features/courses/students.tsx` (new)
- `frontend/src/features/dashboard/page.tsx` (new)
- `frontend/src/features/profile/page.tsx`
- `frontend/src/lib/contracts.ts`
- `frontend/tests/roles.test.tsx` (new)
- `frontend/e2e/workflows.spec.ts`
- `frontend/vitest.config.ts`

Database, tooling, and documentation:

- `supabase/migrations/0014_usernames_dashboards.sql` (new)
- `supabase/tests/usernames.test.sql` (new)
- `supabase/seed.sql`
- `tools/schema.test.mjs`
- `README.md`
- `docs/API.md`
- `docs/USERNAME_AUTH.md` (new)
- `docs/VALIDATION.md`

Build commands also regenerate ignored frontend/backend `dist/` and backend `.scripts-build/` artifacts. Ignored test logs and dependency backups are local artifacts, not source deliverables.
