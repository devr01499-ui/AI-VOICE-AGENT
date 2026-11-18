/**
 * Transport limits (Phase 12, CLAUDE.md §7 heavy traffic / DoS).
 *
 * WebSocket message caps: the `ws` library accepts up to 100 MB per message by default, so a single
 * connection could exhaust the voice server's memory. Carrier media frames (20 ms of 16 kHz PCM,
 * base64 in JSON) are about 1 KB and browser tester chunks a few KB, so 1 MB leaves a wide margin.
 * The live-transcript socket only receives small control messages.
 */
export const WS_MAX_AUDIO_MESSAGE_BYTES = 1024 * 1024;
export const WS_MAX_TRANSCRIPT_MESSAGE_BYTES = 64 * 1024;
