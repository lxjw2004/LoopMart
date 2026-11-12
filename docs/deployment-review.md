# Deployment preparation review

Reviewed Dockerfile, local/deployment/auth Compose, setup/migration/development/admin/browser seed scripts, README and operations documentation. No SSH, deployment, external-system change, secret printing, or Cardmaster access was performed.

## Corrections requested from the main agent

1. Root TypeScript includes apps/packages/tests but omits scripts. Thus Docker's `npm run build:server` does not emit `dist/scripts/migrate.js`, although deployment Compose executes it. Include script sources and verify the compiled entrypoint exists.
2. `.dockerignore` omits `backups/`. The documented backup command writes sensitive database dumps there; Dockerfile copies the whole build context and then the whole application into runtime. Exclude backups and browser report/result output before building images.
3. README still describes an authentication-only foundation and recommends only `auth:migrate`. Auth now queries business settings; running only that migration leaves signup policy lookup broken. Point initial setup to current business+auth `db:migrate` instructions and full application commands.

## Confirmed isolation and preparation

Local PostgreSQL host ports bind 127.0.0.1, and web/admin development processes explicitly bind loopback. API/auth default to loopback; container-only HOST overrides permit internal network communication. Production database has no host-published port. Production web/admin/auth published ports are loopback-only. Compose uses LoopMart project/network/volume names and documents separate Cardmaster resources.

SQL migration copying is included in build:server and matches compiled migration resource paths. Runtime API/auth entrypoints and Docker node24 runtime are consistent. Root fixes to script compilation remain necessary for deployment migration.

Environment setup refuses existing files, generates secrets without printing them, writes mode0600 and leaves SMTP blank. Git tracks only `.env.example`, with no private environment files or credential artifacts observed. Browser seed checks TEST_DATABASE_URL is localhost/127.0.0.1 and database name is loopmart_test before access, uses injected test mail verification, and stores generated credentials in ignored `.superpowers` output. It does not provide a public verification bypass.

Deployment materials remain templates requiring reviewed domains, immutable image tag and private environment placement. No image build or deployment is claimed by this review.

## Follow-up on API review

Inspected the API owner's final canonical path gate: raw path must equal parsed pathname, duplicate slashes are rejected, and `/api/v1` prefix boundary is required before dispatch. This closes the reported audit-wrapper path mismatch. Mapped PostgreSQL400 errors now use generic client messages; the owner reports real PostgreSQL regression coverage. Existing SSE revocation checking retains its bounded20-second delay.
