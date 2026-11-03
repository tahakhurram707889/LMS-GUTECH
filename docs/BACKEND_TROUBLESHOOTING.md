# Backend diagnosis and fixes

## Findings

- The declared backend dependencies were installed and compatible: `npm ls -w backend --depth=0`, strict TypeScript, tests and compilation succeeded. No speculative version upgrades were applied.
- The `tsx` launcher failed before executing application code on this Windows environment: `uv_os_get_passwd returned ENOMEM` from its temporary-directory initialization. Both its CLI and import-loader mode failed. Backend commands now compile TypeScript and use native Node; development uses TypeScript watch plus Node watch. Unused local tsx dependencies were preserved in an ignored backup.
- Default dotenv loading depended on the shell directory. Configuration now finds this backend package's `.env` in source, production builds and compiled operator scripts. External environment variables retain precedence.
- Login converted Supabase connectivity failures, invalid server configuration, missing tables/functions and profile-service outages into `Invalid email or password`. Those now produce specific 503 setup/service responses. Genuine invalid credentials, inactive users and unprovisioned profiles retain a generic 401.
- Cleanup after a failed profile lookup previously revoked all user sessions. It now revokes only the newly created login session.
- Public and server keys are checked for accidental role swaps; JWT project references must match the configured hosted URL. Upstream requests have timeouts, and diagnostics never print credentials.

## Commands

From the repository root:

```powershell
npm.cmd run doctor -w backend
npm.cmd run dev -w backend
```

The doctor checks environment values, public Auth access, required session RPC, server Auth privileges and the existence of an active admin profile. It performs no account or schema mutations. A successful `/api/health` is liveness only, not proof of database readiness.

If migrations are missing, apply/verify the migrations before creating accounts. For an empty verified project, `npm.cmd run bootstrap:admin -w backend` prompts for an email and generates verified temporary credentials. It does not replace an existing administrator's password. Local demo credentials do not automatically exist in a hosted project.

## Executed verification

Strict compiler checks, backend build and 202 tests passed after the fixes. A real native Node launch from the repository root served `/api/health` with HTTP 200 and shut down cleanly. The backend dependency tree has no missing/invalid packages after removing the unused launcher.

The doctor now starts successfully and validates the configured project/environment, but its connection probe is blocked in this execution environment. No hosted login or migration success is claimed. The npm security audit endpoint was also unreachable; vulnerability status is unverified, not a clean audit.
