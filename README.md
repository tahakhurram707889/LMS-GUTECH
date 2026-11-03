<<<<<<< HEAD
# GUTECH Internal LMS

An internal React/TypeScript learning workspace with an Express API and Supabase Auth, Postgres, Storage and Realtime. There is no public signup. Admins create accounts, assign teachers, enroll students and review complaints.

See [username authentication and role dashboard implementation](docs/USERNAME_AUTH.md) for the migration, permission matrix, account setup, changed files, and current test results. Apply migration 0014 before running the updated login.

## Delivered application code

| Module | Workflows |
| --- | --- |
| Login and accounts | Username/password login backed by Supabase Auth, role dashboards, protected routes, active-account checks, forced first-password change, refresh-cookie rotation and logout |
| Resources | Teacher uploads with drag/drop and progress; server magic-byte, extension and size validation; private 60-second downloads; uploader/admin deletion |
| Courses | Admin create/edit/archive, teacher replacement, idempotent student enrollment, CSV preview with duplicate/unknown reports, unenrollment |
| Assignments | Author/edit/delete, optional attachment, due dates, late policy, text/file submission and resubmission, inline grading and feedback |
| Quizzes | Single/multi-choice and true/false builder, question reordering, preview, publication windows, timed runner, navigation, one attempt, server grading and scores |
| Announcements | Global/admin and course/teacher posts, pinning, edit/delete, scoped feed, read tracking and live unread badges |
| Marks | Student own marks and graded totals; teacher/admin matrix and UTF-8 BOM CSV export |
| Classroom chat | Course membership, Realtime updates, older history, scroll preservation, optimistic sending/retry, soft deletion and rate limits |
| Complaints | Private filing with optional attachment, status tracking, admin review/response, enforced transitions and in-app notices |
| Reset password | Neutral forgot-password response, recovery-hash reset, password strength/matching, authenticated change and session revocation |
| Profile | Editable name, institution-managed account details, security controls and real user-specific metrics |

**Implementation is not live acceptance:** TypeScript, HTTP/schema/UI tests and builds can run with the available cached packages. SQL migrations, Auth/SMTP, real Realtime delivery, browser E2E and the exact clean dependency graph still require verification. No hosted migration or demo seed was applied. See [validation](docs/VALIDATION.md).

## Setup (8 steps)

1. Install Node.js 22 LTS and Docker Desktop. On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`.
2. Run `npm install` with registry access. The existing lockfile predates the final manifests; regenerate/review it before using `npm ci`. Run `npx playwright install chromium` when preparing browser tests.
3. Keep credentials in ignored `backend/.env` and `frontend/.env` files; use their `.env.example` files as references. The supplied hosted URL/publishable key are already configured locally. Only the backend receives a server secret/service-role key. The database password is not an application API key.
4. For local development run `npm run db:start`, then `npm run db:reset`, and obtain local URL/keys using `npx supabase status`. **Reset deletes the local database.** The local seed is for development only; never run it against the hosted project.
5. Configure Auth signup as disabled, a 10-character letter/number password policy, one-hour recovery expiry, the frontend reset redirect and SMTP. Local settings are in `supabase/config.toml`. For hosted Auth, copy `supabase/templates/recovery.html` into the recovery email template; it must link to `/reset-password?token_hash=...&type=recovery`. See [hosted setup](docs/HOSTED_SUPABASE.md).
6. Run `npm run typecheck`, `npm run test`, `npm run build`, `npm run lint` and `npm run test:db`. Fix all failures before deployment. SQL test suites contain 54 assertions over real role boundaries and workflows.
7. Local seed accounts already include an admin. For an empty, verified hosted schema, run `npm run bootstrap:admin -w backend` from your terminal. It prompts for your email, generates a temporary LMS password, and prints the username only after verifying login; passwords are never printed. Required `BOOTSTRAP_ADMIN_USERNAME`; optional `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME` and `BOOTSTRAP_ADMIN_PASSWORD` environment values support noninteractive setup. If an admin already exists, it reports the email without changing the account. No public bootstrap/signup endpoint is exposed.
8. Run `npm run dev`. Open `http://localhost:5173`; the API is on port 4000. Account login redirects to `/admin/dashboard`, `/teacher/dashboard` or `/student/dashboard`; temporary-password users must first change their password.

## Structure

```text
frontend/src/
  app/                  router, providers, protected layout, design system
  features/             auth, admin, courses, resources, assignments, quizzes,
                        announcements, marks, chat, complaints, profile
  components/ui/        forms, buttons, dialogs, file upload and async/list states
  hooks/                reusable query hooks
  lib/                  API/session transport, Realtime, upload and typed contracts
backend/
  src/routes/           role guards, schemas, multipart limits and endpoint registration
  src/controllers/      HTTP input/output
  src/services/         authentication, learning/community dispatch and file validation
  src/repositories/     caller-JWT database access, admin-only Auth access, naming mapper
  src/config/           validated environment and redacted logging
  src/middleware/       authentication, role/password gates, validation and error handling
  src/schemas/          strict Zod contracts and bounded pagination
  tests/                HTTP/permission, authentication, upload and foundation tests
  scripts/              operator-only first-admin bootstrap
supabase/
  migrations/           14 ordered migrations, 18 tables, RLS, RPCs, storage, reporting
  tests/                pgTAP isolation and transactional workflow checks
  templates/            recovery email with single-use token hash
  seed.sql              local fixtures only
frontend/e2e/           serial browser flows for all three roles
```

The [exact file tree](docs/FOLDER_TREE.md), [implementation status](docs/PHASES.md), [decisions](docs/ASSUMPTIONS.md), and original extracted [build specification](docs/BUILD_SPEC.txt) are included. The original prototype is preserved under `docs/initial-prototype/`.

## Local test accounts

Local-only seed password: `LocalDemo2026!`. Seeded usernames: `admin`, `amina`, `samir`, `noor`, `sara`, `omar`, `hana`, `zain`. Seeded emails: `admin`, `amina`, `samir`, `noor`, `sara`, `omar`, `hana`, `zain` at `@demo.gutech.test`. Every account must change its password on first login. Noor's fixture marks are 16/20 + 5/5 = 84%. Never deploy these demo identities to production.

## Browser verification

Set `E2E_ADMIN_USERNAME/PASSWORD`, `E2E_TEACHER_USERNAME/PASSWORD` and `E2E_STUDENT_USERNAME/PASSWORD` in your terminal for a **local test database**. Set `E2E_COURSE_ID` to a course shared by that teacher and student. Set `E2E_START_SERVERS=true` to let Playwright launch both applications, then run `npm run test:e2e`. Tests change temporary passwords and create coursework/messages/complaints. They are not run against production. The reset UI test checks neutral email confirmation; real recovery delivery/link reuse still requires SMTP verification.

## Security and limits

For backend package, startup, configuration and login diagnostics, see [backend troubleshooting](docs/BACKEND_TROUBLESHOOTING.md). Run `npm run doctor -w backend` for a read-only project check.

Every public table enables RLS. Workflow writes are scoped transactional SQL RPCs rather than broad student table updates. Students cannot change grade/score columns or read answer keys or peers' submissions/marks/complaints. API requests use the caller JWT; service credentials are isolated to authorized account administration and the operator script. Session revocation is checked by the API and RLS helpers. Profile emails are not shared with classmates; narrow course-member label RPCs return names/roles only.

Uploads use private buckets, verified content types, 25 MiB limits (10 MiB complaints), safe UUID paths and 60-second download links. API validation protects API uploads; direct Storage calls remain bounded by bucket type/size/path policies. File/metadata cleanup cannot be a single Postgres/Storage transaction; failed authoring may leave owner-scoped orphan uploads for future cleanup. Existing signed URLs remain usable until expiry.

Lists are paginated (maximum 100 rows); chat uses a timestamp cursor. Identical-timestamp page boundaries are a known edge case. Rate limiters use in-process storage for local/single-instance operation; production replicas need shared storage and explicit trusted-proxy configuration. Large enrollment batches are limited to 100 rows per CSV. Do not claim deployment readiness until live RLS/SMTP/browser checks pass.
=======
# LMS-GUTECH
>>>>>>> cd206a7e2633b5bbc1d4a86e157a682453dc02d0
