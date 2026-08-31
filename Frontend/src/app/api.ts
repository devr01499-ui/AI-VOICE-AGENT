/**
 * api.ts — Centralized typed API client for bOLNA Frontend
 *
 * SIGNALING DESTINATION: https://ai-voice-agent-backend-mv32.onrender.com
 * All requests include `x-user-id` header for dev-mode auth bypass.
 *
 * Non-JSON fallback shield: All fetches check Content-Type before JSON.parse
 * to prevent HTML 404 pages from throwing parse errors.
 */

import { supabase } from "./lib/supabaseClient";

const PRODUCTION_TARGET = 'https://ai-voice-agent-backend-mv32.onrender.com';

let envUrl = 
  (import.meta as any).env?.VITE_API_BASE_URL || 
  (import.meta as any).env?.VITE_API_URL || 
  (import.meta as any).env?.VITE_BACKEND_URL || 
  PRODUCTION_TARGET;

// Strip any stray markdown/bracket characters, however partial or malformed
envUrl = envUrl.replace(/[\[\]()]/g, '').trim();

// Validate the result is actually a usable URL before trusting it —
// if it isn't, fall back to the known-good production target and warn loudly
try {
  new URL(envUrl);
  if ((envUrl.match(/https?:\/\//g) || []).length > 1) throw new Error('Multiple URLs detected');
} catch {
  console.error('[api.ts] Invalid API base URL detected in environment configuration, falling back to production target:', envUrl);
  envUrl = PRODUCTION_TARGET;
}

export const API_BASE = envUrl.endsWith('/') ? envUrl.slice(0, -1) : envUrl;

/** Seeded fallback user ID for dev-mode auth bypass */
export const DEV_USER_ID = "1e69187e-82d5-4166-929f-4bbba90e5304";

/** Default agent ID for outbound calls */
export const DEFAULT_AGENT_ID = "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d22";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiAgent {
  id: string;
  name: string;
  description: string | null;
  agentType: string;
  status: string;
  version: number;
  workspaceId: string | null;
  model: string | null;
  voiceName: string | null;
  temperature: number | null;
  systemPrompt: string | null;
  flowGraph: string | null;
  agentConfig: unknown;
  isRecordingEnabled?: boolean;
  isTranscriptionEnabled?: boolean;
  systemVoice?: string | null;
  languageMode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiCall {
  id: string;
  status: string;
  phoneNumber?: string;
  duration?: number | null;
  createdAt: string;
  updatedAt: string;
  agent?: { name: string } | null;
  transcript?: string | null;
  recordingUrl?: string | null;
  sentiment?: string | null;
  summary?: string | null;
  userId?: string;
}

export interface ApiProfile {
  id: string;
  email: string;
  fullName: string | null;
  billingBalance: number | null;
  geminiApiKey?: string | null;
  callingBalanceMinutes?: number | null;
  workspaceRole?: string;
  accountType?: string;
}


export interface ApiResponse<T> {
  success: boolean;
  data: T;
  count?: number;
  error?: string;
}

export interface InitiateCallPayload {
  phoneNumber: string;
  agentId: string;
  userId: string;
  userData?: Record<string, unknown>;
  maxDuration?: number;
}

export interface CreateAgentPayload {
  name: string;
  description?: string;
  agentType?: string;
  status?: string;
  model?: string;
  voiceName?: string;
  temperature?: number;
  systemPrompt?: string;
  flowGraph?: string;
  agentConfig?: Record<string, unknown>;
  tags?: string[];
  workspaceId?: string;
  isRecordingEnabled?: boolean;
  isTranscriptionEnabled?: boolean;
  systemVoice?: string;
}

// ─── Core Fetch Helper ────────────────────────────────────────────────────────

export function getAuthToken(): string | null {
  try {
    const storageKey = Object.keys(localStorage).find(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
    if (storageKey) {
      const sessionData = localStorage.getItem(storageKey);
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        if (parsed?.access_token) return parsed.access_token;
      }
    }
    return localStorage.getItem('sb-access-token') || localStorage.getItem('token');
  } catch (error) {
    console.error("[getAuthToken Extraction Fault]:", error);
    return null;
  }
}

export async function getValidAuthToken(): Promise<string | null> {
  let token: string | null = getAuthToken();
  if (!token) {
    const sessionResult = await supabase.auth.getSession().catch(() => null);
    token = sessionResult?.data?.session?.access_token || null;
  }
  if (!token || token === 'undefined' || token === 'null' || token.startsWith('{')) {
    return null;
  }
  return token;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  let token: string | null = getAuthToken();

  // Asymmetric fallback: retrieve active Supabase session asynchronously if needed
  if (!token) {
    const sessionResult = await supabase.auth.getSession().catch(() => null);
    token = sessionResult?.data?.session?.access_token || null;
  }

  if (!token || token === 'undefined' || token === 'null' || token.startsWith('{')) {
    await supabase.auth.signOut().catch(() => {});
    throw new Error("UNAUTHORIZED_ACCESS");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err: any) {
    if (err?.name === 'TypeError' || err?.message === 'Failed to fetch') {
      throw new Error(`Unable to connect to backend server at ${API_BASE}. The backend may be spinning up or temporarily rate-limited. Please retry in a few seconds.`);
    }
    throw err;
  }

  if (res.status === 401 || res.status === 403) {
    await supabase.auth.signOut().catch(() => {});
    throw new Error("UNAUTHORIZED_ACCESS");
  }

  if (res.status === 429) {
    throw new Error(`Rate limit exceeded [429] from backend service. Please wait a moment before trying again.`);
  }

  // ── Non-JSON fallback shield ──────────────────────────────────────────────
  // If a Vercel/Render routing rule, proxy, or Cloudflare returns HTML (e.g. 404 page or bot challenge),
  // we catch it as text to prevent JSON.parse from throwing opaque syntax errors.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Non-JSON response [${res.status}] from ${url}: ${text.slice(0, 200)}`
    );
  }

  const json = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !json.success) {
    let errorMessage = json.error;
    if (errorMessage && typeof errorMessage === 'object') {
      errorMessage = (errorMessage as any).message || JSON.stringify(errorMessage);
    }
    throw new Error(errorMessage as string ?? `API error ${res.status}`);
  }

  return json.data;
}

// ─── Agents ───────────────────────────────────────────────────────────────────

/** GET /api/v2/agents — List all agents for the authenticated user */
export async function fetchAgents(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiAgent[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters?.offset !== undefined) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return apiFetch<ApiAgent[]>(`/api/v2/agents${qs ? `?${qs}` : ""}`);
}

/** GET /api/v2/agents/:agentId — Get a single agent */
export async function fetchAgent(agentId: string): Promise<ApiAgent> {
  return apiFetch<ApiAgent>(`/api/v2/agents/${agentId}`);
}

/** POST /api/v2/agents — Create a new agent */
export async function createAgent(payload: CreateAgentPayload): Promise<ApiAgent> {
  return apiFetch<ApiAgent>("/api/v2/agents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** DELETE /api/v2/agents/:agentId — Delete an agent */
export async function deleteAgent(agentId: string): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/v2/agents/${agentId}`, {
    method: "DELETE",
  });
}

export interface AgentExportEnvelope {
  claritiyVoiceAgentExport: string;
  exportedAt: string;
  agent: {
    name: string;
    description?: string | null;
    agentType?: string;
    agentConfig?: any;
    model?: string | null;
    voiceName?: string | null;
    systemVoice?: string | null;
    languageMode?: string | null;
    temperature?: number;
    systemPrompt?: string | null;
    tags?: string[];
    flowGraph?: any;
  };
}

/** Export an agent as a downloadable JSON file */
export async function exportAgentAsJson(agentId: string): Promise<void> {
  const agent = await fetchAgent(agentId);
  const exportData: AgentExportEnvelope = {
    claritiyVoiceAgentExport: "1.0",
    exportedAt: new Date().toISOString(),
    agent: {
      name: agent.name,
      description: agent.description ?? null,
      agentType: agent.agentType || 'conversational',
      agentConfig: agent.agentConfig || {},
      model: agent.model ?? null,
      voiceName: agent.voiceName ?? null,
      systemVoice: agent.systemVoice ?? 'Puck',
      languageMode: agent.languageMode ?? 'auto',
      temperature: agent.temperature !== null && agent.temperature !== undefined ? Number(agent.temperature) : 0.7,
      systemPrompt: agent.systemPrompt ?? null,
      tags: Array.isArray(agent.tags) ? agent.tags : [],
      flowGraph: agent.flowGraph ?? null,
    },
  };

  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const sanitizedName = (agent.name || "agent").replace(/[^a-z0-9_-]/gi, "_").toLowerCase();
  a.href = url;
  a.download = `${sanitizedName}-export.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Import a sanitized agent payload to create a new draft agent */
export async function importAgentFromJson(payload: Record<string, any>): Promise<ApiAgent> {
  return createAgent(payload as any);
}


/** PUT /api/v2/agents/:agentId — Update an existing agent */
export async function updateAgent(
  agentId: string,
  payload: Partial<CreateAgentPayload>
): Promise<ApiAgent> {
  return apiFetch<ApiAgent>(`/api/v2/agents/${agentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

/** POST /api/v2/agents/optimize — AI-powered system prompt optimizer */
export async function optimizePrompt(description: string): Promise<{
  prompt: string;
  model: string;
  voiceName: string;
  temperature: number;
}> {
  return apiFetch("/api/v2/agents/optimize", {
    method: "POST",
    body: JSON.stringify({ description }),
  });
}

/** POST /api/v2/agents/conversational-builder — Chat with AI to build agent config */
export async function buildAgentConversation(
  message: string,
  history: Array<{ role: 'user' | 'model'; content: string }>
): Promise<{
  isFinal: boolean;
  response: string | null;
  config: {
    systemPrompt: string;
    systemVoice: string;
    temperature: number;
    languageMode: string;
  } | null;
}> {
  return apiFetch("/api/v2/agents/conversational-builder", {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

/** POST /api/v2/agents/:agentId/chat — Converse with an agent using LLM */
export async function chatWithAgent(
  agentId: string,
  message: string,
  history: Array<{ role: 'user' | 'model'; text: string }> = []
): Promise<{ text: string }> {
  return apiFetch<{ text: string }>(`/api/v2/agents/${agentId}/chat`, {
    method: "POST",
    body: JSON.stringify({ message, history }),
  });
}

/** POST /api/v2/agents/test-prompt — Fast LLM text test for prompt preview */
export async function testAgentPrompt(
  systemPrompt: string,
  userQuery: string
): Promise<{ reply: string }> {
  return apiFetch<{ reply: string }>("/api/v2/agents/test-prompt", {
    method: "POST",
    body: JSON.stringify({ systemPrompt, userQuery }),
  });
}


/** GET /api/v2/agents/me/profile — Fetch current user profile */
export async function fetchProfile(): Promise<ApiProfile> {
  return apiFetch<ApiProfile>("/api/v2/agents/me/profile");
}

// ─── Calls ────────────────────────────────────────────────────────────────────

/** GET /api/v2/calls — List all calls for the authenticated user */
export async function fetchCalls(filters?: {
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiCall[]> {
  const params = new URLSearchParams();
  if (filters?.status) params.set("status", filters.status);
  if (filters?.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters?.offset !== undefined) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return apiFetch<ApiCall[]>(`/api/v2/calls${qs ? `?${qs}` : ""}`);
}

/**
 * POST /api/v2/calls — Initiate an outbound call
 *
 * ABSOLUTE SIGNALING DESTINATION:
 *   POST https://ai-voice-agent-backend-mv32.onrender.com/api/v2/calls
 *
 * Schema:
 *   { phoneNumber, agentId, userId }
 */
export async function initiateCall(payload: InitiateCallPayload): Promise<ApiCall> {
  return apiFetch<ApiCall>("/api/v2/calls", {
    method: "POST",
    body: JSON.stringify({
      phoneNumber: payload.phoneNumber,
      agentId: payload.agentId,
      userId: payload.userId ?? DEV_USER_ID,
      ...(payload.userData ? { userData: payload.userData } : {}),
      ...(payload.maxDuration ? { maxDuration: payload.maxDuration } : {}),
    }),
  });
}

/** GET /api/v2/calls/:callId — Get call status and details */
export async function getCallStatus(callId: string): Promise<ApiCall> {
  return apiFetch<ApiCall>(`/api/v2/calls/${callId}`);
}

/** POST /api/v2/calls/:callId/terminate — End an active call */
export async function terminateCall(callId: string): Promise<void> {
  await apiFetch<void>(`/api/v2/calls/${callId}/terminate`, {
    method: "POST",
  });
}

/** GET /api/v2/calls/:callId/transcript — Fetch call transcript */
export async function getCallTranscript(callId: string): Promise<{
  transcript: string | null;
  turns?: unknown[];
}> {
  return apiFetch(`/api/v2/calls/${callId}/transcript`);
}

// ─── WebSocket Helper ─────────────────────────────────────────────────────────

/**
 * Builds the WebSocket URL for the live transcript stream.
 *
 * REAL-TIME SIGNAL BINDING:
 *   WS wss://ai-voice-agent-backend-mv32.onrender.com/live-transcript?callId=<id>
 */
export function getLiveTranscriptWsUrl(callId: string): string {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}/live-transcript?callId=${callId}`;
}

export function getSandboxTestWsUrl(agentId: string, token: string): string {
  const wsBase = API_BASE.replace(/^http/, "ws");
  return `${wsBase}/api/v2/sandbox/test-stream?agentId=${agentId}&token=${encodeURIComponent(token)}`;
}


export interface ApiKnowledgeBase {
  id: string;
  name: string;
  agentId?: string;
  agentIds?: string[];
  createdAt: string;
  sizeChars: number;
}

export async function fetchKBList(): Promise<ApiKnowledgeBase[]> {
  return apiFetch<ApiKnowledgeBase[]>('/api/v2/knowledge-base');
}

export async function uploadKBDocument(name: string, agentId: string, fileBase64: string): Promise<ApiKnowledgeBase> {
  return apiFetch<ApiKnowledgeBase>('/api/v2/knowledge-base/upload', {
    method: 'POST',
    body: JSON.stringify({ name, agentId: agentId || undefined, fileBase64 }),
  });
}

export async function scrapeKBUrl(url: string, agentId: string): Promise<ApiKnowledgeBase> {
  return apiFetch<ApiKnowledgeBase>('/api/v2/knowledge-base/scrape', {
    method: 'POST',
    body: JSON.stringify({ url, agentId: agentId || undefined }),
  });
}

export async function updateKBAgents(id: string, agentIds: string[]): Promise<void> {
  return apiFetch<void>(`/api/v2/knowledge-base/${id}/update-agents`, {
    method: 'POST',
    body: JSON.stringify({ agentIds }),
  });
}

export async function deleteKBDocument(id: string): Promise<void> {
  return apiFetch<void>(`/api/v2/knowledge-base/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchCalendarBookings(): Promise<any> {
  return apiFetch<any>('/api/v2/calendar/bookings');
}

export async function fetchCalendarBatches(): Promise<any> {
  return apiFetch<any>('/api/v2/calendar/batches');
}

export async function getCalendarStatus(): Promise<{ connected?: boolean; email?: string }> {
  return apiFetch<{ connected?: boolean; email?: string }>('/api/v2/calendar/status');
}


export async function updateBillingConfig(geminiApiKey: string | null): Promise<any> {
  return apiFetch<any>('/api/v2/user/billing-config', {
    method: 'POST',
    body: JSON.stringify({ geminiApiKey }),
  });
}

// Harmonized Axios-like apiClient contract for cross-platform compliance
export const apiClient = {
  get: async (path: string, options?: RequestInit) => {
    const result = await apiFetch<any>(path, { ...options, method: 'GET' });
    return { data: { success: true, data: result } };
  },
  post: async (path: string, data?: any, options?: RequestInit) => {
    const result = await apiFetch<any>(path, { ...options, method: 'POST', body: JSON.stringify(data) });
    return { data: { success: true, data: result } };
  },
  put: async (path: string, data?: any, options?: RequestInit) => {
    const result = await apiFetch<any>(path, { ...options, method: 'PUT', body: JSON.stringify(data) });
    return { data: { success: true, data: result } };
  },
  delete: async (path: string, options?: RequestInit) => {
    const result = await apiFetch<any>(path, { ...options, method: 'DELETE' });
    return { data: { success: true, data: result } };
  }
};

export interface ApiTeamMember { id: string; ownerId: string; memberId: string; role: string; createdAt: string; member: { id: string; email: string; fullName: string; createdAt: string; }; }
export async function fetchTeamMembers(): Promise<ApiTeamMember[]> { return await apiFetch('/api/v2/team'); }
export async function inviteTeamMember(email: string): Promise<ApiTeamMember> { return await apiFetch('/api/v2/team/invite', { method: 'POST', body: JSON.stringify({ email }) }); }
export async function removeTeamMember(memberId: string): Promise<void> { await apiFetch('/api/v2/team/' + memberId, { method: 'DELETE' }); }

export async function executeConductorPrompt(prompt: string, chatHistory?: any[]): Promise<{ reply: string; actionsExecuted?: any[]; error?: string; currentPlan?: string }> {
  return apiFetch('/api/v2/conductor/execute', {
    method: 'POST',
    body: JSON.stringify({ prompt, chatHistory }),
  });
}
