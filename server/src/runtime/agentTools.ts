/**
 * Turns an agent's saved "Functions" (editor) and flow "function" nodes into executable tools.
 *
 * Before this module, functions were offered to the model without a URL or execution type, so
 * every call to them failed on a live call. Now:
 * - "Custom API" functions become HTTP tools (URL, method, headers, parameter schema).
 * - Names must be valid and must not collide with the platform's built-in tools
 *   (end call, calendar, knowledge base, ...); colliding or duplicate names are skipped
 *   instead of aborting the whole call.
 * - Other function types (end call, calendar, transfer, SMS, ...) are platform features: they
 *   are provided by the built-in tools when that feature is available, so they are not declared
 *   a second time here.
 */
import { logger } from '../utils/logger';
import type { ToolDefinition } from '../types';

/** Names handled by CallOrchestrator itself. A custom tool may never reuse them. */
export const RESERVED_TOOL_NAMES = new Set([
  'hang_up', 'end_call', 'transfer_call', 'send_sms', 'book_follow_up_call', 'get_available_slots',
  'book_appointment', 'reschedule_appointment', 'cancel_appointment', 'check_availability',
  'check_calendar_availability', 'schedule_event', 'lookup_knowledge_base', 'query_knowledge_base',
  'search_knowledge_base', 'press_digit', 'agent_transfer', 'execute_inline_code',
]);

export const TOOL_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
/** Headers a customer may not set on outbound tool requests. */
const BLOCKED_HEADERS = new Set(['host', 'content-length', 'connection', 'transfer-encoding', 'cookie', 'proxy-authorization', 'upgrade', 'te', 'trailer']);

export function isReservedToolName(name: string): boolean {
  return RESERVED_TOOL_NAMES.has(name) || name.startsWith('code_');
}

/** Returns why a function name is not usable, or null if it is fine. */
export function toolNameProblem(name: unknown): string | null {
  if (typeof name !== 'string' || !TOOL_NAME_PATTERN.test(name)) {
    return 'Use letters, numbers and underscores only, starting with a letter (max 64 characters).';
  }
  if (isReservedToolName(name)) return `"${name}" is a built-in tool name. Choose a different name.`;
  return null;
}

/** Parses the editor's header text (JSON object) into a safe string map. Invalid input → {}. */
export function parseToolHeaders(raw: unknown): Record<string, string> {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    if (!raw.trim()) return {};
    try { obj = JSON.parse(raw); } catch { return {}; }
  }
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = String(k).trim();
    if (!/^[A-Za-z0-9-]{1,100}$/.test(key) || BLOCKED_HEADERS.has(key.toLowerCase())) continue;
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
    const value = String(v);
    if (/[\r\n]/.test(value) || value.length > 4000) continue;
    out[key] = value;
  }
  return out;
}

function normalizeParameters(p: unknown): Record<string, unknown> {
  if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
  if (typeof p === 'string') {
    try {
      const parsed = JSON.parse(p);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch { /* fall through */ }
  }
  return { type: 'OBJECT', properties: {} };
}

function httpTool(name: string, description: string, parameters: unknown, url: unknown, method: unknown, headers: unknown): ToolDefinition | null {
  if (typeof url !== 'string' || !/^https?:\/\//i.test(url.trim())) return null;
  const m = typeof method === 'string' && ALLOWED_METHODS.has(method.toUpperCase()) ? method.toUpperCase() : 'POST';
  return {
    name,
    description: (description || `Calls ${name}`).slice(0, 1000),
    parameters: normalizeParameters(parameters),
    executionType: 'http',
    config: { url: url.trim(), method: m, headers: parseToolHeaders(headers) },
  };
}

/**
 * Builds executable tools from the editor's saved functions and the flow graph's function nodes.
 * Invalid, reserved and duplicate names are skipped with a warning.
 */
export function buildAgentTools(functions: unknown, flowGraph: unknown, context: { callId?: string } = {}): ToolDefinition[] {
  const tools: ToolDefinition[] = [];
  const seen = new Set<string>();
  const add = (tool: ToolDefinition | null, source: string) => {
    if (!tool) return;
    const problem = toolNameProblem(tool.name);
    if (problem || seen.has(tool.name)) {
      logger.warn('agentTools: tool skipped', { callId: context.callId, source, name: tool.name, reason: problem || 'duplicate name' });
      return;
    }
    seen.add(tool.name);
    tools.push(tool);
  };

  if (Array.isArray(functions)) {
    for (const fn of functions) {
      if (!fn || typeof fn !== 'object') continue;
      const type = (fn as any).type || 'custom_api';
      if (type !== 'custom_api') continue; // platform features come from the built-in tools
      add(httpTool(String((fn as any).name || ''), String((fn as any).description || ''), (fn as any).parameters, (fn as any).url, (fn as any).method, (fn as any).headers), 'editor');
    }
  }

  let graph: any = flowGraph;
  if (typeof flowGraph === 'string') {
    try { graph = flowGraph ? JSON.parse(flowGraph) : null; } catch { graph = null; }
  }
  if (graph && Array.isArray(graph.nodes)) {
    for (const node of graph.nodes) {
      if (node?.type !== 'function' && node?.type !== 'callTool') continue;
      const data = node.data || {};
      const name = String(data.toolName || data.label || '').toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/^[^a-z_]+/, '');
      add(httpTool(name, String(data.instructions || data.prompt || ''), data.parameters, data.url, data.method, data.headers), 'flow');
    }
  }
  return tools;
}

/** The declaration the AI model sees for an executable tool. */
export function toModelDeclaration(tool: ToolDefinition) {
  return { type: 'function', name: tool.name, description: tool.description, parameters: tool.parameters };
}
