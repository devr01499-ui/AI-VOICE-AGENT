# SECURITY MODEL

## 1. Authentication & Session Strategy
- **Session Framework**: NextAuth.js configured with JSON Web Token (JWT) session strategy, backed by Supabase Postgres session persistence.
- **Middleware Guard**: Robust route protection mapping dashboard boundaries `/app/(dashboard)/*` to authenticated sessions.
- **Provider Abstraction**: Decoupled JWT claims ensuring unified user interface credentials.

## 2. Multi-Tenant Role-Based Access Control (RBAC)
We establish the following hierarchy of roles:
* `super_admin`: Full system management, telemetry monitoring, global billing controls.
* `tenant_admin`: Tenant-wide configurations, sub-account creation, member onboarding.
* `manager`: Agent design editing, visual workflow creation, custom integration keys.
* `recruiter`: Execution permissions, call campaigns execution, view call analytics.
* `viewer`: Read-only access to conversation history, transcriptions, and metrics.
* `api_service`: Machine-to-machine integration token, REST request triggers.

## 3. Database Security (Supabase Postgres & RLS)
- **Row-Level Security (RLS)**: Enforced on all tenant-specific tables. All queries must filter by `tenant_id` linked to the caller's JWT metadata.
- **Connection String Isolation**: Absolute separation of high-privilege migration keys from public/frontend keys.
- **API Tokens**: Encrypted at rest in Supabase DB using standard encryption standards before dispatching requests to external Voice providers (ASR/TTS/LLM).
