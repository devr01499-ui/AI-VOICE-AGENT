# TECHNICAL DEBT REGISTRY

Rewritten 2026-11-18 (Phase 13). The previous entries referred to NextAuth and an SQLite fallback that do not exist. Each item below has an owner decision or a phase that closes it; full detail is in the linked document.

| ID | Area | Debt | Impact | Plan | Where tracked |
|---|---|---|---|---|---|
| TD-01 | Deploy | Render builds with `prisma db push` instead of committed migrations (`prisma migrate deploy`). The `--skip-generate` flag in `render.yaml` no longer exists in Prisma 7. | High | Migration baseline (Option A), owner choice pending | PROGRESS P1, PRELAUNCH_NOTES §4 |
| TD-02 | Secrets | Encryption and webhook signing fall back to legacy/shared secrets when `ENCRYPTION_KEY` / `VOBIZ_WEBHOOK_SECRET` are unset (boot logs CRITICAL) | High | Owner sets the variables, then the fallbacks are removed after re-encryption | SECURITY_AUDIT S14, owner steps 20–21 |
| TD-03 | Validation | zod 3 has a memory-exhaustion advisory; the fix is only in zod 4 (breaking) | Medium | Separate zod 4 migration with full regression; mitigated by the 10 MB body cap | SECURITY_AUDIT A1 |
| TD-04 | Scale | Rate-limit counters are in memory per instance | Medium (only when 2+ instances) | Redis store before scaling out | SECURITY_AUDIT A3 |
| TD-05 | Frontend | `App.tsx` is ~8,000 lines with page-state routing | Medium (maintainability) | Extract pages only when an issue needs it, with before/after screenshots (CLAUDE.md §5) | CLAUDE.md §5 |
| TD-06 | Repo | The root `package.json` still carries Next.js-era dependencies and an eslint config for `eslint-config-next`; the deploy workflow runs `npm ci` at the root | Low | Clean up together with the CI workflow (Phase 14) | PROGRESS |
| TD-07 | Tests | ~20 root `scripts/test_*.js` are not wired into any npm script or CI | Medium | Wire the passing ones into CI, remove the broken ones (Phase 14) | PROGRESS |
| TD-08 | Compliance | National DND/DLT registry checks are not implemented; only the platform opt-out list and calling hours are enforced | High (legal) | Legal advice, then DLT integration | COMPLIANCE_NOTES |
