# Launch Checklist — Claritiy Voice

Source: CLAUDE.md §6 (17 issues) + §7, §8, §9, §10. An item is ticked **only with proof links** (test output, screenshot, FIX_LOG entry).

## Frontend
- [ ] **F1** No flash of another page on first load (Playwright filmstrip on `/`, `/pricing`, `/login`, `/dashboard`) — Phase 1 — Proof:
- [ ] **F2** Auth: login, sign-up, Google, forgot password, phone/email validation, E2E per path — Phase 1 — Proof:

## Backend / Dashboard
- [ ] **B1** Templates modal + Create Agent layout (no overflow, full width, responsive) — Phase 2 — Proof:
- [ ] **B2** Notification bell: mark read, delete, mark-all-read, badge, tenant-safe endpoints — Phase 2 — Proof:
- [ ] **B3** Prompt Coach: server-side LLM enhancement, limits, injection-safe — Phase 3 — Proof:
- [ ] **B4** "Review QA" and "Auto-detect" removed from UI + dead backend — Phase 2 — Proof:
- [ ] **B5** Test Lab works end to end, tenant-isolated — Phase 3 — Proof:
- [ ] **B6** Prompt-based agent editor: every section saves, persists, and is honoured at runtime — Phase 4 — Proof:
- [ ] **B7** Conversational-format builder: full multi-node flow works — Phase 4 — Proof:
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
- [ ] **D10** Docs hygiene: SYSTEM_CHARTER/TECH_DEBT corrected, RUNBOOK, COMPLIANCE_NOTES current (CLAUDE.md §10) — Phases 13–14 — Proof:
