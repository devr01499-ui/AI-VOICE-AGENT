/**
 * A plan a signed-out visitor chose on the pricing page, kept until they sign in so checkout can
 * open straight after (audit #114). It expires, and it is read only at the moment of sign-in, so a
 * later token refresh or an old leftover entry can never open checkout by surprise.
 * The price stored here is display-only: the server decides what is charged.
 */
const KEY = 'pending_plan_purchase';
export const PENDING_PLAN_TTL_MS = 30 * 60 * 1000;

export interface PendingPlan {
  planName: string;
  price: number;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function savePendingPlan(planName: string, price: number): void {
  try {
    storage()?.setItem(KEY, JSON.stringify({ planName, price, at: Date.now() }));
  } catch {
    // storage blocked: the visitor just picks the plan again after signing in
  }
}

export function clearPendingPlan(): void {
  try {
    storage()?.removeItem(KEY);
  } catch {
    // ignore
  }
}

/** The pending plan if it is still fresh; stale, malformed or old-format entries are removed. */
export function readPendingPlan(now: number = Date.now()): PendingPlan | null {
  let raw: string | null = null;
  try {
    raw = storage()?.getItem(KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const at = Number(parsed?.at);
    if (typeof parsed?.planName === 'string' && parsed.planName && Number.isFinite(at) && now - at >= 0 && now - at <= PENDING_PLAN_TTL_MS) {
      return { planName: parsed.planName, price: Number(parsed.price) || 0 };
    }
  } catch {
    // fall through: malformed
  }
  clearPendingPlan();
  return null;
}
