# Fix Log — Claritiy Voice

One entry per fix, newest at the bottom. Template:

```
## <issue id> — <short title> (Phase N, branch <name>, commit <sha>)
- Issue: what the user saw
- Root cause: one paragraph
- Files: paths changed
- Tests: added/updated, and the script that runs them
- Verified: what was run and seen working
- Not verified here: what could not be checked (e.g. live carrier calls)
```

---

## Phase 0 — Setup (branch chore/phase-0-setup)
- No product code changed. Created docs/PROGRESS.md, CODEMAP.md, LAUNCH_CHECKLIST.md, RUNBOOK.md, PHASED_PROMPTS.md and this file.
- Baseline results are recorded in docs/PROGRESS.md.

## F1 — Another page flashed before the real page (Phase 1, branch fix/frontend-first-load-auth)
- Issue: on first load a plain white page (heading, one paragraph, a row of green links) showed for a moment, then the real page appeared. It happened on every URL, including /login and /dashboard.
- Root cause: `Frontend/scripts/prerender-seo.js` writes crawlable fallback HTML into `<div id="root">` of every built page, and Vercel serves the home copy for all app routes. That unstyled fallback was painted until the JavaScript bundle loaded and React replaced it. After React mounted there were two more intermediate states: a spinner as the Suspense fallback and a fade-in animation on the first page, and a different "Verifying Workspace Credentials" screen on dashboard routes.
- Fix: `index.html` now ships a neutral branded splash as the first child of `#root` (fixed overlay, inline CSS, hidden via `<noscript>` when JavaScript is off). The prerender script puts the crawlable content after the splash in `.cv-prerender` (same HTML for crawlers and visitors; nothing is removed or served differently). The React Suspense fallback and the auth-check screen use the identical splash (`BrandSplash.tsx`), and the first page no longer animates in (`AnimatePresence initial={false}`). The three hand-copied path maps in `App.tsx` were replaced by one module, `lib/routes.ts`.
- Files: Frontend/index.html, Frontend/scripts/prerender-seo.js, Frontend/scripts/verify-first-paint.js (new), Frontend/package.json (postbuild), Frontend/src/app/App.tsx, Frontend/src/app/lib/routes.ts (new), Frontend/src/app/components/common/BrandSplash.tsx (new), Frontend/src/app/components/auth/ProtectedRoute.tsx.
- Tests: `verify-first-paint.js` runs in every build (`postbuild`) and fails the build if any page would paint something before the splash. Passes on 108 built pages; fails (exit 1) when given the pre-fix page shape.
- Verified: Playwright filmstrip on the built site at 0/50/100/200/500/1500 ms for `/`, `/pricing`, `/login`, `/dashboard`, logged out, with bundles delayed 300 ms. Before: the unstyled fallback page was the visible content. After: only the splash is visible until the correct page appears (home hero, pricing, sign-in). Screenshots in docs/proof/F1/. Root build passes; frontend typecheck still 41 errors (no new ones).
- Not verified here: the logged-in `/dashboard` first paint (the simulated session was not accepted by the Supabase client, so that run showed the sign-in screen); real Vercel hosting; the visual result on a slow real phone.
