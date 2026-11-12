> 基础阶段历史记录；当前完整验收与范围限制见 `docs/acceptance.md`。

# Foundation review

Reviewed current foundation fixes at `0cf1ca3`, including auth, member authorization, mail request policy, tests, and implementation report. No OCI access or code changes performed.

Both preliminary important findings are resolved within the foundation scope:

- `apps/auth/src/member.ts` now loads current verification and ban state from PostgreSQL on every business authorization through `requireMember`. An existing session supplies identity only; a newly banned account fails authorization. The session-create hook also rejects banned/unverified accounts. Future business APIs must consistently use this entry point, as documented.
- `apps/auth/src/server.ts` and `apps/auth/src/auth.ts` uniformly reject password-reset requests with unavailable SMTP before account lookup. Known versus unknown addresses therefore cannot produce the previous blank-SMTP status discrepancy.

No new important defect found in these fixes. Origin validation remains strict, mail errors redact sensitive transport/token details, and local/test PostgreSQL isolation remains appropriate. Full marketplace, chat, admin and mobile implementation belongs to subsequent plans.

Validation limits: reviewed source and unit tests; root independently reports six tests, typecheck and build passing. This review does not claim real PostgreSQL migration, auth-handler or SMTP integration coverage. The implementation report explicitly records those unverified paths and Docker absence.
