# Claritiy Voice

Multilingual AI voice agents (inbound, outbound and batch calling) for India-first businesses.

## Repository layout

| Path | What it is |
|---|---|
| `Frontend/` | Vite + React SPA (TypeScript, Tailwind). Marketing site and customer dashboard. Page routing is custom page state in `src/app/App.tsx`, with lazy-loaded pages. Deployed on Vercel. Package manager: **pnpm**. |
| `Admin/` | Admin console (Vite + React). Bundled into `Frontend/dist/admin` by `npm run build`. |
| `server/` | Express + Prisma (PostgreSQL) API under `/api/v2`, voice pipeline (Gemini Live), carrier webhooks, billing (Razorpay). Deployed on Render (`render.yaml`). Package manager: npm. |
| `docs/` | Runbook, launch checklist, fix log, security audit, compliance notes, code map. Start with `docs/RUNBOOK.md`. |

There is no Next.js in this project (an older README described one).

## Commands

```
npm run typecheck   # Frontend + server, must be 0 errors
npm run build       # Frontend + Admin bundle
cd server && npm run test:security   # main server test chain (needs TEST_DATABASE_URL, see docs/RUNBOOK.md)
cd Frontend && npx playwright test --workers=1   # browser tests
```

Tests refuse to run against anything but a dedicated test database (`server/scripts/lib/testDbGuard.cjs`). Never point them at production.

## Key documents

- `docs/RUNBOOK.md`: environment variables (names only), deploy, rollback, carrier webhook URLs, incidents.
- `docs/SECURITY_AUDIT.md`: security findings, fixes and the owner's security steps.
- `docs/COMPLIANCE_NOTES.md`: recording consent, TRAI/DND calling hours, GST and marketing-claims notes.
- `docs/LAUNCH_CHECKLIST.md`, `docs/PROGRESS.md`: launch status and owner verification steps.
- `GOVERNANCE_RULES.md`: binding engineering rules (API envelope, tenant isolation, webhook checks).
