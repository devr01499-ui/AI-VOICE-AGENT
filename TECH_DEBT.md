# TECHNICAL DEBT REGISTRY

## 1. Overview
This document tracks known deviations from the ideal enterprise architecture, shortcuts taken during early phases, and refactoring items needed to maintain production-grade system integrity.

## 2. Active Debt Registry
| ID | Phase | Component | Description | Impact | Mitigation Plan | Target Resolution |
|----|-------|-----------|-------------|--------|-----------------|-------------------|
| TD-001 | Phase 1 | Authentication | Mock auth tokens or placeholder keys for dev testing | Low | Explicitly secure all routes using NextAuth session middleware | End of Phase 1 |
| TD-002 | Phase 1 | Schema | Local PostgreSQL / SQLite dev fallback before Supabase integration | Medium | Ensure Prisma migrations and dynamic schemas are fully aligned with Supabase | End of Phase 1 |
