#!/usr/bin/env bash
# e2e-call-harness — CI / Test Runner Suite
#
# Enforces:
# 1. First AI audio arrives within 3s of stream "start" event
# 2. WebSocket connection stays open for at least 10s
# 3. Call row is not marked failed during normal calls
# 4. Runs 10 iterations of Outbound Call (timing race defense)
# 5. Runs 10 iterations of Inbound Call (timing race defense)
# 6. Runs Fake Gemini setup rejection and requires SAFE-tier retry to save the call

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

export PORT="${PORT:-3001}"
export FAKE_GEMINI_PORT="${FAKE_GEMINI_PORT:-8095}"
export GEMINI_WS_BASE="ws://127.0.0.1:${FAKE_GEMINI_PORT}"
export GEMINI_HTTP_BASE="http://127.0.0.1:${FAKE_GEMINI_PORT}"
export NODE_ENV="test"

# The database must be a throwaway TEST database that already has the schema (CI builds it before
# this script). The server and the simulator both load the test-DB guard, which refuses any other
# database and blanks live service keys. These fixed TEST_ values are what the guard hands to both
# processes, so the server and the simulator always share the same carrier signing token, and the
# Gemini key only ever reaches the fake Gemini server above.
if [ -z "${TEST_DATABASE_URL:-}" ]; then
  echo "❌ TEST_DATABASE_URL is not set. Point it at a throwaway test database with the schema applied."
  exit 1
fi
export TEST_GEMINI_API_KEY="harness-fake-gemini-key"
export TEST_PLIVO_AUTH_TOKEN="harness-plivo-auth-token"
SERVER_LOG="${SERVER_LOG:-${TMPDIR:-/tmp}/voice_server.log}"

echo "================================================================="
echo "🚀 STARTING E2E CALL HARNESS CI SUITE"
echo "================================================================="
echo "Root Dir: ${ROOT_DIR}"
echo "Server Port: ${PORT}"
echo "Fake Gemini Port: ${FAKE_GEMINI_PORT}"

# Track PIDs for cleanup
FAKE_GEMINI_PID=""
SERVER_PID=""

cleanup() {
  local status=$?
  if [ "${status}" -ne 0 ] && [ -f "${SERVER_LOG}" ]; then
    echo ""
    echo "❌ Harness failed (exit ${status}). Last 60 server log lines:"
    tail -60 "${SERVER_LOG}" || true
  fi
  echo ""
  echo "🧹 Shutting down background test services..."
  if [ -n "${SERVER_PID}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill -15 "${SERVER_PID}" 2>/dev/null || kill -9 "${SERVER_PID}" 2>/dev/null || true
  fi
  if [ -n "${FAKE_GEMINI_PID}" ] && kill -0 "${FAKE_GEMINI_PID}" 2>/dev/null; then
    kill -15 "${FAKE_GEMINI_PID}" 2>/dev/null || kill -9 "${FAKE_GEMINI_PID}" 2>/dev/null || true
  fi
  echo "✓ Services stopped."
}
trap cleanup EXIT INT TERM

# 1. Start Fake Gemini Server
echo "1. Starting Fake Gemini Service on port ${FAKE_GEMINI_PORT}..."
node "${SCRIPT_DIR}/fake_gemini.js" &
FAKE_GEMINI_PID=$!

FAKE_ONLINE=0
for i in {1..30}; do
  if curl -s "http://127.0.0.1:${FAKE_GEMINI_PORT}/health" >/dev/null 2>&1; then
    echo "✓ Fake Gemini service is online!"
    FAKE_ONLINE=1
    break
  fi
  sleep 0.5
done
if [ "$FAKE_ONLINE" -eq 0 ]; then
  echo "❌ Fake Gemini service failed to come online within 15s."
  exit 1
fi

# 2. Start Application Server (through the test-DB guard; exec so SERVER_PID is the node process)
echo "2. Starting Voice Engine Server on port ${PORT}..."
(
  cd "${ROOT_DIR}/server"
  exec node -r ./scripts/lib/testDbGuard.cjs dist/index.js
) > "${SERVER_LOG}" 2>&1 &
SERVER_PID=$!

SERVER_ONLINE=0
for i in {1..40}; do
  if curl -s "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "✓ Voice Engine server is online!"
    SERVER_ONLINE=1
    break
  fi
  sleep 0.5
done

if [ "$SERVER_ONLINE" -eq 0 ]; then
  echo "❌ Voice Engine server failed to come online within 20s."
  exit 1  # the EXIT trap prints the server log tail
fi

# 3. Execute 10 Outbound Call Iterations
echo ""
echo "================================================================="
echo "📞 PHASE 1: OUTBOUND CALL PATH — 10 CONSECUTIVE ITERATIONS"
echo "================================================================="
for iter in {1..10}; do
  echo "--- Outbound Iteration ${iter}/10 ---"
  node "${SCRIPT_DIR}/call_sim.js" outbound
  echo "✓ Iteration ${iter}/10 PASSED"
done

# 4. Execute 10 Inbound Call Iterations
echo ""
echo "================================================================="
echo "📞 PHASE 2: INBOUND CALL PATH — 10 CONSECUTIVE ITERATIONS"
echo "================================================================="
for iter in {1..10}; do
  echo "--- Inbound Iteration ${iter}/10 ---"
  node "${SCRIPT_DIR}/call_sim.js" inbound
  echo "✓ Iteration ${iter}/10 PASSED"
done

# 5. Execute Setup Rejection & Safe-Tier Retry Verification
echo ""
echo "================================================================="
echo "🛡️ PHASE 3: SETUP REJECTION & SAFE-TIER RETRY RESILIENCE"
echo "================================================================="
echo "Testing upstream Gemini setup failure with automatic safe-tier recovery..."
node "${SCRIPT_DIR}/call_sim.js" reject_retry
echo "✓ Safe-tier recovery PASSED"

echo ""
echo "================================================================="
echo "🎉 ALL 21 TEST RUNS GREEN! ZERO TIMING RACES DETECTED."
echo "================================================================="
