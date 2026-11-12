# Business API verification

Implemented Node HTTP API factory `createApp({pool,auth,origin})`, loopback server port3002, Better Auth Cookie identity and refreshed verification/ban/role checks. No client identity header exists. PostgreSQL migrations001/002 run under a transaction plus advisory lock. Default-community foreign keys/checks cover membership, items/rides, conversations, reports and settings. Pair uniqueness uses deterministic C collation; message client IDs are unique per sender/conversation and mismatched retries return409.

Routes implement items/rides CRUD, SQL search/date-in-route-timezone/cursor filters, favorites, personal/profile data, merged conversations, messages/reference snapshots, monotonic reads/unread, authenticated targeted SSE, reports/contact/public settings and administrator resources/settings/account operations/community messages. Hidden reference snapshots are denied. Contact submission is stored independently of SMTP. Admin writes and before/after/request/reason audit records share a single transaction. Managed account/password changes use the version-pinned Better Auth internal adapter boundary in apps/auth/src/admin.ts on that same transaction connection, and revoke sessions when required. Notification jobs use row locks, savepoints, persistent error/attempt counters and bounded exponential retry; successful delivery is idempotent and emits conversation invalidation after commit.

Verified commands:

- `npx tsc --noEmit`: passed.
- `node --env-file=.env.test --import tsx --test tests/api*.test.ts`: 2 passed, 0 skipped.

Real PostgreSQL integration authenticates three accounts through actual signup, test-injected mail verification and cookie signin. It checks anonymous/owner/admin boundaries, cents and seat validation, timezone date filtering, fixed-community injection, invalid IDs, conversation pair merging/nonparticipant denial, message retry/conflict, unread/read, moderation state protection, favorites target type, audit before/after and rollback, controlled admin account creation/password changes, forced audit failure rolling back account provisioning, notification delivery/failure retry, 50+2 cursor pages, and actual SSE delivery.

Runtime boundaries: SSE transport is process-local, appropriate to the supplied single-process server; a multi-process deployment would need a shared event transport. SMTP remains intentionally unconfigured; public registration/reset requires mail configuration and never bypasses verification. No production deployment or external message delivery was performed.
