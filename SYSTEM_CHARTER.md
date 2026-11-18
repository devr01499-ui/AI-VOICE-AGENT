# SYSTEM_CHARTER

Rewritten 2026-11-18 (Phase 13) to describe the system as built. The earlier charter planned a Next.js app with Twilio/Exotel; neither exists here.

## 1. Product
Claritiy Voice: multilingual AI voice agents (Hindi, English and code-switched) that answer inbound calls, place outbound calls and run batch campaigns for India-first businesses. Customers build agents (single prompt or a visual conversation flow), attach knowledge bases and calendars, buy a plan, get one phone number, and see call history, recordings, reports and analytics.

## 2. Architecture (as built)
- **Frontend** (`Frontend/`, Vercel): Vite + React SPA in TypeScript with Tailwind and framer-motion. Custom page-state routing in `src/app/App.tsx`, lazy-loaded pages, and SEO pre-render (`scripts/prerender-seo.js`). Supabase Auth (email and Google). Razorpay checkout widget.
- **Admin console** (`Admin/`): bundled under `/admin`; staff permissions are enforced by the server (`requireStaff`).
- **API** (`server/`, Render, Singapore): Express + Prisma + PostgreSQL (Supabase), all routes under `/api/v2` with the `{ success, data }` envelope. Tenant isolation means every tenant query carries the user or workspace id.
- **Voice**: carriers stream call audio over WebSocket (L16 16 kHz) into a Pipecat-style pipeline (`core/pipeline`, `AudioStreamHandler`) with Gemini Live as the speech-to-speech model. Two hosted carriers are integrated behind neutral naming in the UI.
- **Payments**: Razorpay orders created and verified server-side (signature + captured status + amount + order notes); webhook and periodic reconciliation as fallback.
- **Background jobs**: KB ingestion queue, batch dialer (TRAI calling hours), analysis jobs, data retention, payment reconciliation, alert evaluation.

## 3. Out of scope
- Self-hosted SIP trunking (removed in Phase 13), number resale outside a paid plan, international calling by default (India-only toll-fraud guard).

## 4. Roles
- Owner: Rohit (founder).
- Engineering: see `CLAUDE.md` (working method) and `GOVERNANCE_RULES.md` (binding rules).
