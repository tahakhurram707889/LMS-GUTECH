# Final LMS-GUTECH Audit Report

Audit date: 2026-11-03

## 1. Architecture overview

- Frontend: React 18 / TypeScript / Vite single-page application with role dashboards, protected routes, TanStack Query, and API-backed feature modules.
- Backend: TypeScript / Express API organized into routes, controllers, services, repositories, schemas, and middleware.
- Identity and data: Supabase Auth, Postgres, Storage, and Realtime. Login accepts a username; the server resolves it to an active profile and uses the mapped email for Supabase password authentication. The role is read from the database profile and checked by backend middleware and database policies.
- Database: 14 ordered migrations, local-only seed data, and pgTAP tests. Migration 0014 adds usernames, departments, and scoped dashboard summaries.
- Feature areas present in the codebase include accounts, users, courses, enrollments, resources, assignments, quizzes, announcements, marks, chat, complaints, notifications, and profiles.

## 2. Prioritized issues found

1. **High — installed dependency tree does not match declared versions.** `npm ls --depth=0` reports React 19, React Router 7, TypeScript 7, and other frontend packages as invalid against the manifest pins (React 18, Router 6, TypeScript 5, etc.).
2. **Medium — typecheck scripts were placeholders.** Both workspace scripts printed “typecheck skipped” instead of invoking TypeScript.
3. **Verification gap — database/browser/live service acceptance.** Local PostgreSQL is unavailable, Chromium is not installed, and hosted Supabase/SMTP behavior cannot be established from this workspace.

## 3. Fixes made

- Replaced the frontend `typecheck` placeholder with `tsc --noEmit -p tsconfig.json`.
- Replaced the backend `typecheck` placeholder with `tsc --noEmit -p tsconfig.test.json`, covering source, tests, and operator scripts.
- Audited username login, trusted role derivation, session handling, backend route guards, migration policies, frontend secret references, and project ignore rules.
- No database migration, seed, user record, production credential, or hosted service was changed.

## 4. Dependencies

- No dependency was added, removed, or version-upgraded in source manifests.
- `npm ls --depth=0`: **FAIL** — locally installed packages do not match manifest versions.
- `npm install`: **BLOCKED** — registry access did not complete, including the escalated attempt. The attempt was stopped without changing the lockfile; `npm install --offline` confirmed that required package metadata is not cached.
- No dependency advisory status is claimed; a registry-backed audit was not completed.

## 5. Frontend audit

- Three dashboard routes exist and route selection is based on the authenticated profile role. The dashboard retrieves metrics from the backend; unauthorized dashboard/admin pages render a 403 view.
- Login UI submits username/password. No role is submitted as authentication authority.
- Protected workspace loading, session restoration, logout cleanup, first-password gating, and feature routes are implemented.
- Frontend unit tests: **PASS** — 13 tests, including login startup and admin/student dashboard flows. Teacher-specific role login is covered in backend username tests; browser acceptance of all dashboards was not run.
- Production build: **PASS** with the installed package tree, with third-party `use client` directive warnings. Build output had a 227.08 kB realtime chunk.
- Responsive/mobile, keyboard/screen-reader, and visual browser checks: **NOT TESTED** (Chromium unavailable).
- No new broken links or runtime browser issues were established in this non-browser audit.

## 6. Backend audit

- Reviewed app middleware, API routes, auth routes, schemas, environment validation, and route authorization structure.
- API requests use the caller access token for database access. Admin Auth operations use server-only service credentials.
- Backend production build: **PASS**.
- Backend tests: **PASS** — 227 tests, including route auth/role boundaries, username mapping, provisioning, and upload validation.
- Backend lint: **PASS** with no reported errors.
- Live API-to-Supabase integration: **NOT TESTED**; local/hosted availability was not verified.

## 7. Supabase database audit

- Reviewed ordered migrations, RLS grants/policies, username/dashboard migration, local seed references, and SQL test files. Policies and helper functions are designed to scope data by active profile, role, course membership, ownership, and admin privileges.
- Static schema checks: **PASS** — 5 checks, including RLS enabled on the 18 public tables and no frontend service-role variable.
- pgTAP / migration runtime: **BLOCKED** — `npm run test:db` could not connect to local PostgreSQL at `127.0.0.1:54322`.
- Hosted migration, existing production accounts, actual RLS behavior, Auth, Storage, and Realtime: **NOT TESTED**. No hosted migration or seed was run.

## 8. Authentication and authorization

- Username-to-email mapping occurs server-side; password verification is delegated to Supabase Auth.
- Profile role and active status are read from the database and placed into the trusted request context. Strict input schemas reject an attempted role field.
- Frontend route guards improve navigation UX; backend role guards and database RLS enforce access independently.
- Session persistence uses a refresh cookie; the access token is held in application memory. Logout clears the browser cookie and session state.
- Automated auth/role tests: **PASS** as part of the 227 backend and 13 frontend tests.
- Real Supabase login, session expiry/revocation, SMTP recovery delivery, and all live role boundaries: **NOT TESTED**.

## 9. Security findings

- Static scan found service-role references only in backend runtime code and the frontend example-file warning; no frontend runtime service-role use was found.
- Backend environment validation distinguishes server and public Supabase key roles and checks project references when JWT-form keys are used.
- Reviewed CORS allowlisting, origin checks for refresh-cookie writes, Helmet, request logging serializers, rate limits, schema validation, upload limits, and private-storage design.
- Hardcoded credential values were not printed or included in this report. Local `.env` files are ignored; their values were not inspected.
- No production credential or user data was changed. A full dynamic penetration/security test was **NOT TESTED**.

## 10. Build and test results

| Check | Result | Evidence / limitation |
| --- | --- | --- |
| Frontend build | PASS | Vite production build completed; nonfatal dependency directive warnings noted. |
| Backend build | PASS | TypeScript production compilation completed. |
| Frontend typecheck | PASS | `tsc --noEmit -p frontend/tsconfig.json` completed without errors. |
| Backend typecheck | PASS | `tsc --noEmit -p backend/tsconfig.test.json` completed without errors. |
| Lint | PASS | `npm run lint` completed without output/errors. |
| Frontend tests | PASS | 13 tests. |
| Backend tests | PASS | 227 tests. |
| Static schema tests | PASS | 5 tests. |
| Database tests | BLOCKED | Local PostgreSQL is not running/available on port 54322. |
| Dependency tree | FAIL | `npm ls --depth=0` reports installed frontend versions outside manifest pins. |
| Browser E2E | NOT TESTED | Chromium and live test services/credentials were unavailable. |
| Hosted Auth / SMTP / Realtime | NOT TESTED | External integration acceptance was not performed. |

The successful checks above ran against the dependency tree currently present in `node_modules`, which is not the exact manifest dependency set.

## 11. Remaining issues

- Resolve the declared-versus-installed dependency mismatch with a registry-backed install, then rerun `npm ls`, typecheck, lint, tests, and builds.
- Start a disposable local Supabase stack and run migrations plus pgTAP without resetting any database containing user data.
- Run Playwright on a disposable seeded local project, then verify responsive and accessibility behavior.
- Verify hosted Auth recovery delivery/session revocation, live RLS boundaries, Storage, and Realtime in an approved staging environment.
- Existing documented operational limits include in-process rate-limit storage for multi-replica deployments, possible owner-scoped orphan uploads after partial failures, timestamp-only chat cursors, and quiz answers held in memory until submission.

## 12. Manual actions required

1. Complete the pending registry-backed `npm install` and confirm the lockfile is consistent with all three manifests.
2. Use a disposable local Supabase database; review migrations before applying. Do not run `db reset` against data that must be retained.
3. Execute `npm run test:db` and the Playwright role workflows with local-only credentials.
4. Complete hosted Auth/SMTP/RLS/Storage/Realtime checks in staging before any production rollout.

## 13. Readiness status

**NOT READY for final submission sign-off yet.** Source-level builds, lint, typechecks, and automated frontend/backend/static tests pass. The dependency tree is inconsistent with package manifests, and database runtime, clean-install, browser, and live Supabase acceptance remain outstanding. No feature or external integration is represented as live-tested without evidence.
