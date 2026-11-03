# Implementation and acceptance status

The follow-up request confirmed all ten modules as the delivery scope. Code was added in the PDF's dependency order. The earlier Phase 0 gate could not be fully verified here; no phase is marked accepted merely because code exists. Live migration, isolation, SMTP and E2E checks remain mandatory before deployment.

| Phase | Code delivered | Acceptance |
| --- | --- | --- |
| 0 | Frontend/backend workspaces, configuration, schema, RLS, seed and CI | Typecheck/build/tests run; exact dependency install, lint and live DB gate pending |
| 1 | Login, reset/change password, refresh/logout, user administration, first-admin bootstrap and requested profile | HTTP contracts tested with mocked providers; real Auth/SMTP and account/session tests pending |
| 2 | Courses, archive, teachers, enrollments/CSV and private resources | Routes/UI and upload validation tested; live membership/storage workflows pending |
| 3 | Assignments/submissions/grading, quizzes/attempts and marks/gradebook/CSV | Routes/UI implemented; SQL deadline/grade/attempt tests authored, not executed |
| 4 | Announcements/read counts and Realtime classroom chat | Routes/UI implemented; two-user delivery latency/subscription isolation pending |
| 5 | Complaints/status notices, audit, polish and browser test suite | Routes/UI implemented; live transitions, notice delivery and Playwright flows pending |

## Acceptance work still required

- Regenerate/review the root lockfile using the pinned manifests and verify a clean `npm ci`.
- Run lint/format checks once those packages are available.
- Start local Supabase and apply all 13 migrations plus the local seed; run both pgTAP files (39 assertions).
- Verify real login, inactive-session rejection, first-password changes, refresh rotation and reset-link expiry/reuse/session revocation.
- Confirm private signed downloads, MIME rejection, membership changes, archive behavior, submissions/grade races and quiz timing in a live database.
- Verify global/course visibility and unread badges, two-user Realtime chat within 2 seconds, delete permissions and reconnect behavior.
- Run Playwright flows against local role accounts; inspect mobile/tablet/desktop layout, keyboard interactions and assistive-technology/contrast behavior.
- Verify hosted signup/password/SMTP/redirect settings separately; linking/config.toml do not automatically configure a remote project.
- Never apply the local public-password demo seed to the hosted project.

See VALIDATION.md for executed results and limitations. Authored tests and mocked HTTP success responses do not certify live database business rules.
