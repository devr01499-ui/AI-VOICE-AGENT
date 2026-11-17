# Agent editor audit — what each control really does on a live call

Built 2026-11-17 (Phase 4) from a read-only trace: editor → `getStudioPayload` → `routes/agents.ts` (POST/PUT) → `Agent.agentConfig` → live call path (carrier → `CallOrchestrator.startVoiceSession` → PipecatRunner → `GeminiLiveProvider`, greeting/silence in `AudioStreamHandler`). Line numbers are from that date; re-grep before editing. "Status" column is updated as each item is fixed (see FIX_LOG.md).

## Severity-ordered problems

| # | Problem | Evidence | Status |
|---|---|---|---|
| A1 | Saving a FLOW agent replaces the whole `agentConfig` with `{ handbookPresets }` — webhooks, post-call fields, call settings, functions, MCPs, greeting are wiped | App.tsx ~7113/7136 + agents.ts PUT ~713 | FIXED (see FIX_LOG) |
| A2 | One tool registry shared by all calls; each new call clears/refills it — concurrent calls overwrite each other's tools | CallOrchestrator.ts ~166, ~586 | FIXED (see FIX_LOG) |
| A3 | Agent lookup failure runs the call as a hard-coded user id with a recruiter prompt (billing/calendar go to that user) | CallOrchestrator.ts ~430-435 | FIXED (see FIX_LOG) |
| A4 | Duplicate tool name throws 409 and aborts the call (e.g. a function named like a built-in) | ToolExecutor.ts ~47-54 | FIXED (see FIX_LOG) |
| A5 | Custom Functions are declared to the model but fail on execution (no executionType/url mapping); flow "function" nodes same | CallOrchestrator.ts ~393-399, ~45-55; ToolExecutor.ts ~178-191 | FIXED (see FIX_LOG) |
| A6 | Post-call extraction fields / summary prompt never run on live calls (only on an unused webhook path) and results are not shown anywhere | CallService.ts ~499-575 vs CallFinalizer → AnalysisService | FIXED (see FIX_LOG) |
| A7 | Webhooks: only `call_analyzed` is ever sent; `call_started`, `call_ended`, `transcript_updated` never fire; no retries; signature has no timestamp (replayable); deliveries sequential | WebhookDispatcher.ts | FIXED (see FIX_LOG) |
| A8 | Security & Fallback section is a no-op (PII categories, fallback model/voice/retries have no reader); the real PII switch `Agent.isPiiRedactionEnabled` is never set by the editor | grep of server/src | FIXED (see FIX_LOG) |
| A9 | Flow agents: global prompt + handbook discarded at call time; direction ignored (always outbound); branch conditions lost (edges saved without labels); voice/language/flexibility not reloaded, so re-saving resets them; KB/Speech/Transcription panels in the flow builder not saved | systemInstructionBuilder.ts ~273-283; FlowCompiler.ts ~262; VisualFlowCanvas.tsx ~213-218, ~351-355 | FIXED (see FIX_LOG); Code/MCP/Subagent nodes marked Soon |
| A10 | SSRF: sandbox custom API calls have no SSRF check and no timeout; live HTTP tools have no timeout; `assertSafeUrl` checks DNS once and fetch follows redirects (rebinding/redirect bypass) | SandboxStreamHandler.ts ~305; ToolExecutor.ts ~223; ssrfValidator.ts ~204 | PARTLY FIXED — DNS-rebinding pin left for Phase 12 (P10) |
| A11 | PUT `/agents/:id` has no body schema; client can set `status` (any string), `agentType`, `workspaceId` | agents.ts ~639-731 | FIXED (see FIX_LOG) |
| A12 | Webhook secret and MCP `apiKey` stored and returned in plain text by GET | agents.ts ~409 | FIXED (see FIX_LOG) |
| A13 | MCP servers used only in browser test calls, never on live calls | SandboxStreamHandler.ts ~190-282 | FIXED (see FIX_LOG) |
| A14 | Knowledge Base count badge shows 0 until the section is opened | SinglePromptStudio.tsx ~266, ~2377 | FIXED (see FIX_LOG) |

## Single-prompt editor controls

| Section | Control | Live-call consumer | Verdict |
|---|---|---|---|
| Top bar | Voice | GeminiLiveProvider voice config | WORKS |
| Top bar | Language | systemInstructionBuilder + GeminiLiveProvider | WORKS |
| Top bar | Direction | prompt text (greeting uses the call's direction) | WORKS (prompt) |
| Top bar | Industry | systemInstructionBuilder overlay | WORKS |
| Top bar | Welcome / who speaks first | AudioStreamHandler + greetingUtils | WORKS |
| Top bar | AI speaks after silence | AudioStreamHandler | WORKS |
| Functions | Custom API function | declared, execution fails | BROKEN (A5) |
| Functions | Transfer / SMS / Press digit / Agent transfer | return "unavailable" | NO-OP, labelled Coming Soon |
| Functions | Check/Book calendar `calendarId` | never read | BROKEN |
| Knowledge Base | Attach KBs | HybridSearchService on live calls | WORKS (badge A14) |
| Scheduling | Hours, length, buffer, notice, max/day | CalendarService.getFreeSlots | WORKS (saved separately from main Save) |
| Scheduling | Add Meet link | parsed only | NO-OP |
| Intelligence | Response style, Fast/Smart | prompt blocks | WORKS (prompt) |
| Speech | Speed, Volume | prompt hint only, no audio change | PROMPT-ONLY |
| Speech | Responsiveness, Interruption sensitivity | Gemini VAD config | WORKS |
| Speech | Backchanneling | prompt | WORKS (prompt) |
| Transcription | Boosted keywords | prompt hint only | PROMPT-ONLY |
| Call settings | AI end-call tool, Auto-hangup on goodbye, Opt-out keywords | CallOrchestrator / prompt | WORKS |
| Call settings | Closing message | none | NO-OP |
| Call settings | Ambient noise | prompt text only | NO-OP |
| Call settings | End on silence | prompt only; no timer | PROMPT-ONLY |
| Call settings | Max duration | sandbox only | SANDBOX-ONLY |
| Call settings | Voicemail detection | none (disabled, Coming soon) | NO-OP |
| Post-call | Summary prompt, extraction fields | not on live path | BROKEN (A6) |
| Security & Fallback | all controls | none | NO-OP (A8) |
| Webhooks | URL, headers, secret | WebhookDispatcher (call_analyzed only) | PARTIAL (A7) |
| MCPs | servers | sandbox only | SANDBOX-ONLY (A13) |

## Flow builder

| Node / setting | Verdict |
|---|---|
| Conversation text, Collect input, Ending | WORKS |
| Logic split conditions | BROKEN (labels not saved) |
| Check calendar | WORKS when calendar connected |
| Function node | BROKEN (A5) |
| Subagent | NO-OP (transfer disabled) |
| Extract variable (`variableKey`) | NO-OP (server reads `variable`/`variableName`) |
| Code node | NO-OP (code tools filtered out) |
| MCP node | NO-OP |
| Call transfer, Press digit, Agent transfer, In-call SMS | disabled ("Soon"), blocked on save |
| Global prompt + handbook | FIXED (A9) |
| Flexibility, direction, voice/language reload, KB/Speech/Transcription panels | FIXED (A9) |
