# CHANGELOG

## [Unreleased] - 2026-06-25
### Fixed
- Removed trailing slash from Vobiz Account endpoint in the health check, bypassing 307 redirects to private hostnames that caused connection timeouts on startup.

## [Unreleased] - 2026-05-20
### Added
- Proposed project roadmap and initial structural plan.
- Initialized mandatory system memory documents (`SYSTEM_CHARTER.md`, `GOVERNANCE_RULES.md`, `ARCHITECTURE_DECISIONS.md`, `BUILD_PLAN.yaml`, `ERROR_LOG.md`, `CHANGELOG.md`).

## [Unreleased] - 2026-06-15
### Fixed
- Fixed TypeScript compile errors related to Express 5 `req.params` typing by casting them to `string`.
- Updated `prisma.config.ts` to expose the datasource URL needed by `prisma db push`.
- Added `ADR-003` to document SQLite connection strategy using driver adapters in Prisma 7.
