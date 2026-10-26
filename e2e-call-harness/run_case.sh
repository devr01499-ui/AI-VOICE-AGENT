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

for i in {1..30}; do
  if curl -s "http://127.0.0.1:${FAKE_GEMINI_PORT}/health" >/dev/null 2>&1; then
    echo "✓ Fake Gemini service is online!"
    break
  fi
  sleep 0.5
done

# 2. Start Application Server
echo "2. Starting Voice Engine Server on port ${PORT}..."
(
  cd "${ROOT_DIR}/server"
  node dist/index.js
) &
SERVER_PID=$!

for i in {1..40}; do
  if curl -s "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "✓ Voice Engine server is online!"
    break
  fi
  sleep 0.5
done

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
