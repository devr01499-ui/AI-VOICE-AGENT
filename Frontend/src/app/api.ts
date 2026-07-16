/**
 * api.ts — Centralized typed API client for bOLNA Frontend
 *
 * SIGNALING DESTINATION: https://ai-voice-agent-backend-mv32.onrender.com
 * All requests include `x-user-id` header for dev-mode auth bypass.
 *
 * Non-JSON fallback shield: All fetches check Content-Type before JSON.parse
 * to prevent HTML 404 pages from throwing parse errors.
 */

// ─── Constants ────────────────────────────────────────────────────────────────
import { supabase } from "./lib/supabaseClient";

const PRODUCTION_BACKEND_URL = 'https://ai-voice-agent-backend-mv32.onrender.com';

const BACKEND_URL = 
  (import.meta as any).env?.VITE_API_URL || 
  (import.meta as any).env?.VITE_BACKEND_URL || 
  process.env?.NEXT_PUBLIC_API_URL || 
  PRODUCTION_BACKEND_URL; // Guarantee resolution

const baseURL = BACKEND_URL.endsWith('/') ? BACKEND_URL.slice(0, -1) : BACKEND_URL;

console.log(`[API Client Master Injection]: Lock established on target domain -> ${baseURL}`);

export const API_BASE = baseURL;

/** Seeded fallback user ID for dev-mode auth bypass */
export const DEV_USER_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

/** Default agent ID for outbound calls */
export const DEFAULT_AGENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

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
  userId?: string;
}

export interface ApiProfile {
  id: string;
  email: string;
  fullName: string | null;
  billingBalance: number | null;
  geminiApiKey?: string | null;
  callingBalanceMinutes?: number | null;
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

async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  // Asynchronously retrieve active Supabase session
  const sessionResult = await supabase.auth.getSession();
  const token = sessionResult.data?.session?.access_token;

  if (!token || token === 'undefined' || token === 'null' || token.startsWith('{')) {
    await supabase.auth.signOut().catch(() => {});
    throw new Error("UNAUTHORIZED_ACCESS");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`,
    ...(options.headers as Record<string, string> | undefined),
  };

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401 || res.status === 403) {
    await supabase.auth.signOut().catch(() => {});
    throw new Error("UNAUTHORIZED_ACCESS");
  }

  // ── Non-JSON fallback shield ──────────────────────────────────────────────
  // If a Vercel routing rule or proxy returns HTML (e.g. 404 page),
  // we catch it as text to prevent JSON.parse from throwing.
  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    const text = await res.text();
    throw new Error(
      `Non-JSON response [${res.status}] from ${url}: ${text.slice(0, 200)}`
    );
  }

  const json = (await res.json()) as ApiResponse<T>;

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? `API error ${res.status}`);
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

export interface ApiKnowledgeBase {
  id: string;
  name: string;
  agentId: string;
  createdAt: string;
  sizeChars: number;
}

export async function fetchKBList(): Promise<ApiKnowledgeBase[]> {
  return apiFetch<ApiKnowledgeBase[]>('/api/v2/knowledge-base');
}

export async function uploadKBDocument(name: string, agentId: string, fileBase64: string): Promise<ApiKnowledgeBase> {
  return apiFetch<ApiKnowledgeBase>('/api/v2/knowledge-base/upload', {
    method: 'POST',
    body: JSON.stringify({ name, agentId, fileBase64 }),
  });
}

export async function scrapeKBUrl(url: string, agentId: string): Promise<ApiKnowledgeBase> {
  return apiFetch<ApiKnowledgeBase>('/api/v2/knowledge-base/scrape', {
    method: 'POST',
    body: JSON.stringify({ url, agentId }),
  });
}

export async function deleteKBDocument(id: string): Promise<void> {
  return apiFetch<void>(`/api/v2/knowledge-base/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchAnalyticsSummary(): Promise<any> {
  return apiFetch<any>('/api/v2/analytics/summary');
}

export async function updateBillingConfig(geminiApiKey: string | null): Promise<any> {
  return apiFetch<any>('/api/v2/user/billing-config', {
    method: 'POST',
    body: JSON.stringify({ geminiApiKey }),
  });
}

// Harmonized Axios-like apiClient contract for cross-platform compliance
export const apiClient = {
  get: async <T>(path: string, options?: RequestInit): Promise<T> => apiFetch<T>(path, { ...options, method: 'GET' }),
  post: async <T>(path: string, data?: any, options?: RequestInit): Promise<T> => apiFetch<T>(path, { ...options, method: 'POST', body: JSON.stringify(data) }),
  put: async <T>(path: string, data?: any, options?: RequestInit): Promise<T> => apiFetch<T>(path, { ...options, method: 'PUT', body: JSON.stringify(data) }),
  delete: async <T>(path: string, options?: RequestInit): Promise<T> => apiFetch<T>(path, { ...options, method: 'DELETE' }),
};
