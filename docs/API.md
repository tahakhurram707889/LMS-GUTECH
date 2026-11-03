# API inventory

All non-public routes require a verified Supabase JWT, an active profile, a live Auth session and a completed first-password change. Role guards are applied before feature controllers; SQL/RLS independently enforce ownership and membership. Full feature bodies are strict Zod schemas in `backend/src/schemas/lms.ts`. List queries use bounded pagination; chat uses a before cursor.

## Authentication

| Method | Path | Access |
| --- | --- | --- |
| POST | `/api/auth/login` | Public, 5 attempts per IP/username and 30 per IP per 15 minutes |
| POST | `/api/auth/refresh` | HttpOnly refresh cookie + trusted browser origin |
| POST | `/api/auth/forgot-password` | Public, neutral response, 3 requests/hour/email |
| POST | `/api/auth/reset-password` | Single-use recovery token hash |
| POST | `/api/auth/change-password` | Authenticated, verifies current password |
| POST | `/api/auth/logout` | Authenticated, revokes sessions |
| GET | `/api/auth/me` | Authenticated; available before first-password change |
| GET | `/api/health` | Public liveness only |

Login body: `{ "username": "assigned.username", "password": "your LMS password" }`. Email is reserved for recovery and internal Supabase verification. Roles in a login body are rejected.

There is no signup endpoint. Unknown auth paths return 404. The operator bootstrap is a CLI script, not an HTTP route.

## LMS routes

| Method | Path | Access | Body schema |
| --- | --- | --- | --- |
| GET | `/api/me/profile` | Authenticated; scoped by membership/ownership | ? |
| PATCH | `/api/me/profile` | Authenticated; scoped by membership/ownership | profileSchema |
| GET | `/api/me/dashboard` | Authenticated; role-derived statistics and scoped upcoming work | - |
| GET | `/api/admin/departments` | Admin | - |
| POST | `/api/admin/departments` | Admin | departmentSchema |
| PATCH | `/api/admin/departments/:id` | Admin | departmentSchema |
| GET | `/api/me/metrics` | Authenticated; scoped by membership/ownership | ? |
| GET | `/api/admin/users` | Admin | ? |
| POST | `/api/admin/users` | Admin | userSchema |
| PATCH | `/api/admin/users/:id` | Admin | userPatch |
| POST | `/api/admin/users/:id/reset-password` | Admin | empty |
| GET | `/api/me/courses` | Authenticated; scoped by membership/ownership | ? |
| GET | `/api/admin/courses` | Admin | ? |
| POST | `/api/admin/courses` | Admin | courseSchema |
| PATCH | `/api/admin/courses/:id` | Admin | courseSchema |
| GET | `/api/courses/:id/members` | Authenticated; scoped by membership/ownership | ? |
| GET | `/api/admin/courses/:id/teachers` | Admin | ? |
| GET | `/api/admin/courses/:id/enrollments` | Admin | ? |
| PUT | `/api/admin/courses/:id/teachers` | Admin | teachersSchema |
| POST | `/api/admin/courses/:id/enrollments` | Admin | enrollmentSchema |
| POST | `/api/admin/courses/:id/enrollments/csv` | Admin | csvSchema |
| DELETE | `/api/admin/courses/:id/enrollments/:studentId` | Admin | ? |
| GET | `/api/courses/:id/resources` | Authenticated; scoped by membership/ownership | ? |
| POST | `/api/courses/:id/resources` | Teacher/Admin | resourceSchema |
| GET | `/api/resources/:id/download` | Authenticated; scoped by membership/ownership | ? |
| DELETE | `/api/resources/:id` | Teacher/Admin | ? |
| GET | `/api/courses/:id/assignments` | Authenticated; scoped by membership/ownership | ? |
| POST | `/api/courses/:id/assignments` | Teacher/Admin | assignmentSchema |
| POST | `/api/courses/:id/assignment-attachments` | Teacher/Admin | empty |
| GET | `/api/assignments/:id/attachment` | Authenticated; scoped by membership/ownership | ? |
| GET | `/api/assignments/:id` | Authenticated; scoped by membership/ownership | ? |
| PATCH | `/api/assignments/:id` | Teacher/Admin | assignmentSchema |
| DELETE | `/api/assignments/:id` | Teacher/Admin | ? |
| POST | `/api/assignments/:id/upload` | Student | empty |
| PUT | `/api/assignments/:id/submission` | Student | submissionSchema |
| GET | `/api/assignments/:id/submissions` | Teacher/Admin | ? |
| GET | `/api/submissions/:id/download` | Authenticated; scoped by membership/ownership | ? |
| PATCH | `/api/submissions/:id/grade` | Teacher/Admin | gradeSchema |
| GET | `/api/courses/:id/quizzes` | Authenticated; scoped by membership/ownership | ? |
| POST | `/api/courses/:id/quizzes` | Teacher/Admin | quizSchema |
| GET | `/api/quizzes/:id` | Teacher/Admin | ? |
| PATCH | `/api/quizzes/:id` | Teacher/Admin | quizSchema |
| POST | `/api/quizzes/:id/attempt` | Student | empty |
| GET | `/api/quizzes/:id/attempt` | Student | ? |
| POST | `/api/quizzes/:id/attempt/submit` | Student | answersSchema |
| GET | `/api/quizzes/:id/results` | Teacher/Admin | ? |
| GET | `/api/announcements` | Authenticated; scoped by membership/ownership | ? |
| POST | `/api/announcements` | Teacher/Admin | announcementSchema |
| POST | `/api/announcements/read` | Authenticated; scoped by membership/ownership | readSchema |
| PATCH | `/api/announcements/:id` | Teacher/Admin | announcementSchema |
| DELETE | `/api/announcements/:id` | Teacher/Admin | ? |
| GET | `/api/me/marks` | Student | ? |
| GET | `/api/courses/:id/gradebook` | Teacher/Admin | ? |
| GET | `/api/courses/:id/gradebook.csv` | Teacher/Admin | ? |
| GET | `/api/courses/:id/messages` | Authenticated; scoped by membership/ownership | ? |
| POST | `/api/courses/:id/messages` | Teacher/Student | messageSchema |
| DELETE | `/api/messages/:id` | Authenticated; scoped by membership/ownership | ? |
| POST | `/api/complaints` | Teacher/Student | complaintSchema |
| GET | `/api/complaints/mine` | Teacher/Student | ? |
| GET | `/api/admin/complaints` | Admin | ? |
| PATCH | `/api/admin/complaints/:id` | Admin | reviewSchema |
| GET | `/api/complaints/:id/download` | Authenticated; scoped by membership/ownership | ? |
| GET | `/api/notifications` | Authenticated; scoped by membership/ownership | ? |
| POST | `/api/notifications/read` | Authenticated; scoped by membership/ownership | ? |
| GET | `/api/notifications/counts` | Authenticated; scoped by membership/ownership | ? |

## Conventions

Success: `{data, meta?}`; errors: `{error:{code,message,details}}`. Responses use camelCase and database rows use snake_case. Pagination defaults to 20 and caps at 100. Downloads return a 60-second signed URL; the gradebook CSV route returns a UTF-8 BOM CSV attachment and neutralizes spreadsheet formulas.

Resource/complaint uploads use multipart `file` plus schema fields. Submission files are uploaded through `/assignments/:id/upload`, then their returned `filePath` is included with the PUT submission. Assignment attachments follow the same staged upload pattern. CSV enrollment uses JSON `{csv, preview}` so preview and confirmation share a validated parser.
