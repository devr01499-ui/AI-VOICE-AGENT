# Launch Checklist — Claritiy Voice

Source: CLAUDE.md §6 (17 issues) + §7, §8, §9, §10. An item is ticked **only with proof links** (test output, screenshot, FIX_LOG entry).

Launch gate (Phase 14): every item below is either DONE with proof or listed in PROGRESS.md under "Needs owner verification" with exact steps. Nothing may stay unchecked.

## Frontend
- [x] **F1** No flash of another page on first load — Phase 1 — Proof: FIX_LOG F1; `Frontend/scripts/verify-first-paint.js` (build gate); docs/proof/F1/. Logged-in check: PROGRESS owner step 4
- [x] **F2** Auth — Phase 1 — Proof: FIX_LOG F2; `npm run test:signup` 11/11; `Frontend/e2e/auth-flows.spec.ts` 12/12; docs/proof/F2/. Live email/Google: PROGRESS owner steps 5–8

## Backend / Dashboard
- [x] **B1** Templates + Create Agent layout — Phase 2 — Proof: FIX_LOG B1; `Frontend/e2e/agent-templates-layout.spec.ts` 10/10 (390–1920 px); docs/proof/B1/
- [x] **B2** Notification bell — Phase 2 — Proof: FIX_LOG B2; `npm run test:notifications` 16/16; `Frontend/e2e/notification-bell.spec.ts` 9/9; docs/proof/B2/. Live deploy + email/mute: PROGRESS owner steps 9–10
- [x] **B3** Prompt Coach — Phase 3 — Proof: FIX_LOG B3; `npm run test:prompt-coach` 16/16; `Frontend/e2e/prompt-coach.spec.ts` 6/6. Live AI quality: PROGRESS owner step 11
- [x] **B4** Review QA + Auto-detect removed — Phase 2 — Proof: FIX_LOG B4; `npm run test:agent-rules` 7/7; `Frontend/e2e/agent-editor-removed-features.spec.ts` 3/3; docs/BACKEND_UNUSED_REPORT.md
- [x] **B5** Test Lab — Phase 3 — Proof: FIX_LOG B5; `npm run test:test-lab` 12/12; `Frontend/e2e/test-lab.spec.ts` 5/5. Live AI run: PROGRESS owner step 11
- [x] **B6** Prompt-based agent editor: every section saves, persists, and is honoured at runtime — Phase 4 — Proof: docs/AGENT_EDITOR_AUDIT.md (every control traced; A1–A8, A10–A14 fixed); FIX_LOG Phase 4 entries; test:security suites agent-tools 13, agent-config-integrity 11, post-call-fields 6, pii-redaction 6, mcp-live 4, call-limits 7, calendar-bookings 7; e2e test-lab.spec (KB badge). DNS-rebinding pin → Phase 12 (P10). Live phone call: PROGRESS owner step 12
- [x] **B7** Conversational-format builder: full multi-node flow works — Phase 4 — Proof: FIX_LOG A9; test:flow-agent 8/8 (0/8 on old code); Frontend/e2e/flow-builder.spec.ts 5/5 (4 fail on old code). Live phone call: PROGRESS owner step 12
- [ ] **B8** Knowledge Base RAG Retrieval Inspector + per-plan limits + 1,000-user safety — Phase 5 — Proof:
- [ ] **B9** Phone numbers / KYC / carrier activation / sub-accounts (CRITICAL) — Phase 7 — Proof:
- [ ] **B10** Batch calling lifecycle, caps, DND/calling hours, restart-safe — Phase 8 — Proof:
- [ ] **B11** Calling Configuration page: load < 1 s p95, save < 500 ms — Phase 9 — Proof:
- [ ] **B12** Data pages audit: Call History, Contacts, Analytics, Live Monitoring, AI QA, Call Reports, Alerting — Phase 9 — Proof:
- [ ] **B13** Billing gateway fraud prevention (CRITICAL) — Phase 6 — Proof:
- [ ] **B14** Call recording playback: signed URLs, player, retention, consent — Phase 10 — Proof:
- [ ] **B15** Latency < 1 s p50 / < 1.5 s p95 (measured) + humanized voice — Phase 11 — Proof:

## Cross-cutting
- [ ] **S7** Security / firewall / traffic hardening pass, `docs/SECURITY_AUDIT.md` (CLAUDE.md §7) — Phase 12 — Proof:
- [ ] **Q8** CI workflow + Playwright end-to-end smoke test + quality gates (CLAUDE.md §8) — Phase 14 — Proof:
- [ ] **D9** Dead-code removal + `docs/BACKEND_UNUSED_REPORT.md` (CLAUDE.md §9) — Phase 13 — Proof:
- [ ] **T0** Typecheck at 0 errors for frontend and server (frontend starts at 41) — all phases, closed in Phase 14 — Proof:
- [ ] **M0** Migrations rebuilt from an offline baseline; Render uses `prisma migrate deploy`; CI builds an empty database from migrations (PRELAUNCH_NOTES.md §4) — owner choice pending — Proof:
- [ ] **K0** Production database password rotated after public exposure; Google key literal confirmed revoked — owner — Proof:
- [ ] **D10** Docs hygiene: SYSTEM_CHARTER/TECH_DEBT corrected, RUNBOOK, COMPLIANCE_NOTES current (CLAUDE.md §10) — Phases 13–14 — Proof:
