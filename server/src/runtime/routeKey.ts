/**
 * Key of a live-call route (transfer destination, specialist, WhatsApp message): an editor function's
 * name or a flow node's id, as lower-case letters, digits and underscores (max 40). Identical copy in
 * Frontend/src/app/components/agents/flowCompiler.ts (test_call_routing checks they agree).
 */
export function routeKey(raw: unknown): string {
  let k = String(raw ?? '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  if (!k) k = 'route';
  if (/^[0-9]/.test(k)) k = `r_${k}`.slice(0, 40);
  return k;
}
