# ARCHITECTURE_DECISIONS

## ADR-001: Next.js 14 App Router Framework Selection
- **Status**: Proposed
- **Context**: The Voice AI Agent Dashboard requires highly interactive pages, visual canvas editing, search capabilities, and API route endpoints.
- **Decision**: Use Next.js 14 with App Router to support server components, server-side actions, client-side interactive canvas editors, and seamless API endpoints.
- **Rejected Alternative**: Single Page Application (SPA) via Vite + React. Reason: Lacks clean, server-side data loading patterns, optimized SEO, and robust api routing.
- **Consequences**: Fast initial page loads, structured routing, but requires careful hydration handling when using client-heavy state like Zustand/dnd-kit.

## ADR-002: State Management Strategy
- **Status**: Proposed
- **Context**: The drag-and-drop workflow canvas requires a fast and centralized client-side state manager to handle undo/redo, dynamic connections, and canvas coordinates.
- **Decision**: Use Zustand for local/canvas-specific states and React Query for server states.
- **Rejected Alternative**: Redux Toolkit. Reason: High boilerplate and slower setup cycles for lightweight interactive states.
- **Consequences**: Minimal boilerplate, easily decoupled from API queries.

## ADR-003: Prisma 7 SQLite Connection via Driver Adapter
- **Status**: Proposed
- **Context**: Prisma 7 has removed support for direct native Rust-based query engines. Initializing the Prisma Client constructor with SQLite now requires a JavaScript driver adapter, or the initialization fails.
- **Decision**: Install `better-sqlite3` and `@prisma/adapter-better-sqlite3`, and pass the `PrismaBetterSqlite3` adapter to the `PrismaClient` constructor.
- **Rejected Alternative**: Downgrading to Prisma v6. Reason: Reverting Prisma versions would break dependencies and cause version conflicts with package-lock.json and other workspace configurations.
- **Consequences**: Adds `better-sqlite3` and its types to dependencies, but enables Prisma 7 compatibility in SQLite local environments.

