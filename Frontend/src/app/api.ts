/**
 * api.ts — Centralized typed API client for Claritiy Voice Frontend
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
  direction?: string | null;
  tags?: string[];
  qaEvaluation?: {
    overallScore: number;
    passed: boolean;
    status: 'PASS' | 'WARN' | 'FAIL';
    summary: string;
    flaggedIssues: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ApiCall {
  id: string;
  direction?: 'inbound' | 'outbound';
  callDirection?: string;
  status: string;
  contactNumber?: string;
  businessNumber?: string;
  phoneNumber?: string;
  recipientPhoneNumber?: string;
  fromPhoneNumber?: string;
  agentName?: string;
  agentId?: string;
  agent?: { name: string } | null;
  startedAt?: string | null;
  endedAt?: string | null;
  duration?: number | null;
  durationSeconds?: number | null;
  billedMinutes?: number;
  hasTranscript?: boolean;
  hasRecording?: boolean;
  recordingUrl?: string | null;
  transcript?: string | null;
  sentiment?: string | null;
  summary?: string | null;
  userId?: string;
  batchId?: string | null;
  batchName?: string | null;
  lastError?: string | null;
  lastErrorCode?: string | null;
  createdAt: string;
  updatedAt?: string;
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
  userId?: string;
  fromPhoneNumber?: string;
  record?: boolean;
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

  const isPublicPath =
    path.startsWith('/api/v2/user/consent') ||
    path.startsWith('/api/v2/user/validate-signup') ||
    path.startsWith('/health');

  if ((!token || token === 'undefined' || token === 'null' || token.startsWith('{')) && !isPublicPath) {
    await supabase.auth.signOut().catch(() => {});
    throw new Error("UNAUTHORIZED_ACCESS");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token && token !== 'undefined' && token !== 'null' ? { "Authorization": `Bearer ${token}` } : {}),
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

  // Defensive fallback: If backend returned success: true but omitted the "data" wrapper,
  // extract top-level properties so UI callers never receive undefined.
  if (json.data === undefined) {
    const { success, error, message, ...rest } = json as any;
    return (Object.keys(rest).length > 0 ? rest : json) as T;
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
  userQuery: string,
  history?: Array<{ role: 'user' | 'model'; content: string }>
): Promise<{ reply: string }> {
  return apiFetch<{ reply: string }>("/api/v2/agents/test-prompt", {
    method: "POST",
    body: JSON.stringify({ systemPrompt, userQuery, history }),
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
  direction?: string;
  search?: string;
  agentId?: string;
  batchId?: string;
  dateRange?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}): Promise<ApiCall[]> {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.set("status", filters.status);
  if (filters?.direction && filters.direction !== 'all') params.set("direction", filters.direction);
  if (filters?.search && filters.search.trim()) params.set("search", filters.search.trim());
  if (filters?.agentId && filters.agentId !== 'all') params.set("agentId", filters.agentId);
  if (filters?.batchId && filters.batchId !== 'all') params.set("batchId", filters.batchId);
  if (filters?.dateRange && filters.dateRange !== 'all') params.set("dateRange", filters.dateRange);
  if (filters?.startDate) params.set("startDate", filters.startDate);
  if (filters?.endDate) params.set("endDate", filters.endDate);
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
      ...(payload.fromPhoneNumber ? { fromPhoneNumber: payload.fromPhoneNumber } : {}),
      ...(payload.record !== undefined ? { record: payload.record } : {}),
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

export interface CallTranscriptTurn {
  id: string;
  speaker: 'agent' | 'caller';
  role: 'agent' | 'caller';
  text: string;
  startTime?: number;
  endTime?: number;
  sequenceNumber?: number;
}

export interface CallTranscriptResponse {
  callId: string;
  transcript: string | null;
  turns?: CallTranscriptTurn[];
  totalTurns?: number;
}

/** GET /api/v2/calls/:callId/transcript — Fetch call transcript */
export async function getCallTranscript(callId: string): Promise<CallTranscriptResponse> {
  return apiFetch<CallTranscriptResponse>(`/api/v2/calls/${callId}/transcript`);
}

// ─── WebSocket Helper ─────────────────────────────────────────────────────────

/**
 * Requests a short-lived single-use ticket to authenticate the live transcript WebSocket stream.
 */
export async function requestTranscriptTicket(callId: string): Promise<string> {
  const res = await apiClient.post(`/api/v2/calls/${callId}/transcript-ticket`);
  return res.data?.data?.ticket || res.data?.ticket || '';
}

/**
 * Builds the WebSocket URL for the live transcript stream with signed ticket authentication.
 */
export function getLiveTranscriptWsUrl(callId: string, ticket?: string): string {
  const wsBase = API_BASE.replace(/^http/, "ws");
  const ticketParam = ticket ? `&ticket=${encodeURIComponent(ticket)}` : '';
  return `${wsBase}/live-transcript?callId=${callId}${ticketParam}`;
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
  status?: 'queued' | 'processing' | 'ready' | 'failed';
  progress?: number;
  errorMessage?: string;
}

export interface KBTestQueryChunk {
  id: string;
  source: string;
  section: string;
  page?: number;
  score: number;
  matchType: string;
  content: string;
}

export interface KBTestQueryResult {
  query: string;
  queryRewritten: string;
  chunksCount: number;
  latencyMs: number;
  embeddingMs: number;
  dbQueryMs: number;
  chunks: KBTestQueryChunk[];
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

export async function assignKBAgent(kbId: string, agentId: string): Promise<void> {
  return apiFetch<void>(`/api/v2/knowledge-base/${kbId}/assign`, {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
}

export async function unassignKBAgent(kbId: string, agentId: string): Promise<void> {
  return apiFetch<void>(`/api/v2/knowledge-base/${kbId}/unassign`, {
    method: 'POST',
    body: JSON.stringify({ agentId }),
  });
}

export async function reindexKBDocument(id: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>(`/api/v2/knowledge-base/${id}/reindex`, {
    method: 'POST',
  });
}

export async function testKBQuery(params: { agentId?: string; kbId?: string; query: string }): Promise<KBTestQueryResult> {
  const res = await apiFetch<{ success: boolean; data: KBTestQueryResult }>('/api/v2/knowledge-base/test-query', {
    method: 'POST',
    body: JSON.stringify(params),
  });
  return (res as any)?.data || res;
}

export async function deleteKBDocument(id: string): Promise<void> {
  return apiFetch<void>(`/api/v2/knowledge-base/${id}`, {
    method: 'DELETE',
  });
}

// ── Agent Intelligence Playbooks & Test Lab ──
export interface PlaybookRequiredField {
  key: string;
  label: string;
  placeholder: string;
  example: string;
  required: boolean;
  maxLength?: number;
}

export interface PlaybookObjection {
  objection: string;
  response: string;
}

export interface PlaybookTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  targetRole: string;
  recommendedResponseStyle: 'concise' | 'balanced' | 'consultative';
  goal: string;
  opening: string;
  discoveryQuestions: string[];
  qualificationCriteria: string[];
  objectionHandlingLibrary: PlaybookObjection[];
  closingNextStep: string;
  complianceRules: string[];
  requiredFields: PlaybookRequiredField[];
}

export interface PromptCoachReviewData {
  score: number;
  letterGrade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F' | string;
  missingSections: string[];
  contradictions: string[];
  warnings: string[];
  strengths: string[];
  characterCount: number;
  passed?: boolean;
  issues?: string[];
  recommendations?: string[];
}

export async function fetchPlaybooks(): Promise<PlaybookTemplate[]> {
  const res = await apiFetch<{ success: boolean; data: PlaybookTemplate[] }>('/api/v2/agents/playbooks');
  const rawList = (res as any)?.data || (Array.isArray(res) ? res : []);
  if (!Array.isArray(rawList)) return [];
  return rawList.map((p: any) => ({
    id: p.id || '',
    title: p.title || p.name || 'Untitled Playbook',
    category: p.category || 'General',
    description: p.description || '',
    targetRole: p.targetRole || 'AI Voice Specialist',
    recommendedResponseStyle: p.recommendedResponseStyle || p.defaultResponseStyle || 'balanced',
    goal: p.goal || '',
    opening: p.opening || '',
    discoveryQuestions: p.discoveryQuestions || [],
    qualificationCriteria: p.qualificationCriteria || [],
    objectionHandlingLibrary: p.objectionHandlingLibrary || (p.objectionHandling ? Object.entries(p.objectionHandling).map(([objection, response]) => ({ objection, response: response as string })) : []),
    closingNextStep: p.closingNextStep || p.closingAsk || '',
    complianceRules: p.complianceRules || [],
    requiredFields: Array.isArray(p.requiredFields) ? p.requiredFields : [],
  }));
}

export async function generatePromptFromCoach(playbookId: string, businessFacts: Record<string, string>): Promise<{
  playbookId: string;
  title: string;
  generatedPrompt: string;
  recommendedStyle: 'concise' | 'balanced' | 'consultative';
  review?: PromptCoachReviewData;
}> {
  const res = await apiFetch<{ success: boolean; data: any }>('/api/v2/agents/prompt-coach/generate', {
    method: 'POST',
    body: JSON.stringify({ playbookId, businessFacts }),
  });
  const data = (res as any)?.data || res;
  return {
    playbookId: data.playbookId || playbookId,
    title: data.title || '',
    generatedPrompt: data.generatedPrompt || data.prompt || '',
    recommendedStyle: data.recommendedStyle || 'balanced',
    review: data.review,
  };
}

export async function reviewPromptWithCoach(prompt: string): Promise<PromptCoachReviewData> {
  const res = await apiFetch<{ success: boolean; data: any }>('/api/v2/agents/prompt-coach/review', {
    method: 'POST',
    body: JSON.stringify({ prompt }),
  });
  const data = (res as any)?.data || res;
  return {
    score: typeof data.score === 'number' ? data.score : 0,
    letterGrade: data.letterGrade || (data.score >= 80 ? 'A' : 'C'),
    missingSections: data.missingSections || [],
    contradictions: data.contradictions || [],
    warnings: data.warnings || (data.recommendations || []),
    strengths: data.strengths || [],
    characterCount: typeof data.characterCount === 'number' ? data.characterCount : (prompt.length || 0),
    passed: data.passed,
    issues: data.issues || [],
    recommendations: data.recommendations || [],
  };
}

export async function runTestLabSimulation(agentId: string, personas?: string[]): Promise<{
  scorecard: {
    passed: boolean;
    averageScore: number;
    results: Array<{
      persona: string;
      score: number;
      passed: boolean;
      dimensionScores: {
        objectionHandling: number;
        kbAccuracy: number;
        compliance: number;
        nextStepAsk: number;
        tone: number;
      };
      feedback: string[];
      turnsCount: number;
    }>;
  };
}> {
  const res = await apiFetch<{ success: boolean; data: any }>(`/api/v2/agents/${agentId}/test-lab`, {
    method: 'POST',
    body: JSON.stringify({ personas }),
  });
  return (res as any)?.data || res;
}

export async function fetchCalendarBookings(): Promise<any> {
  return apiFetch<any>('/api/v2/calendar/bookings');
}

export async function fetchCalendarBatches(): Promise<any> {
  const res = await apiFetch<any>('/api/v2/calendar/batches');
  return res?.success && Array.isArray(res.data) ? res.data : (Array.isArray(res) ? res : []);
}

export async function fetchCalendarBatchDetail(id: string): Promise<any> {
  const res = await apiFetch<any>(`/api/v2/calendar/batches/${id}`);
  return res?.success && res.data ? res.data : null;
}

export async function createBatchCampaign(data: {
  name: string;
  agentId: string;
  numberId?: string;
  scheduleNow?: boolean;
  scheduledAt?: string;
  recipients: any[];
  idempotencyKey?: string;
  consentConfirmed?: boolean;
  consentConfirmedBy?: string;
  estimatedMinutes?: number;
  dialMode?: 'sequential' | 'concurrent';
  interCallDelaySeconds?: number;
}): Promise<any> {
  return apiFetch<any>('/api/v2/calendar/batches', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function pauseBatchCampaign(id: string): Promise<any> {
  return apiFetch<any>(`/api/v2/calendar/batches/${id}/pause`, { method: 'POST' });
}

export async function resumeBatchCampaign(id: string): Promise<any> {
  return apiFetch<any>(`/api/v2/calendar/batches/${id}/resume`, { method: 'POST' });
}

export async function cancelBatchCampaign(id: string, options?: { endCurrentCall?: boolean }): Promise<any> {
  return apiFetch<any>(`/api/v2/calendar/batches/${id}/cancel`, {
    method: 'POST',
    body: JSON.stringify(options || {}),
  });
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

// ─── Shared KYC API Response Contract ──────────────────────────────────────
export interface KycSuccessResponse<T = Record<string, unknown>> {
  success: true;
  data: T;
  message?: string;
}

export interface KycErrorResponse {
  success: false;
  error: string;
  code?: string;
  outcome?: string;
}

export type KycApiResponse<T = Record<string, unknown>> = KycSuccessResponse<T> | KycErrorResponse;

export interface KycDigiLockerInitiateData {
  auth_url: string;
  link: string;
  access_request_id: string;
}

// Harmonized Axios-like apiClient contract for cross-platform compliance
export const apiClient = {
  get: async <T = any>(path: string, options?: RequestInit) => {
    const result = await apiFetch<T>(path, { ...options, method: 'GET' });
    return { data: { success: true, data: result } };
  },
  post: async <T = any>(path: string, data?: any, options?: RequestInit) => {
    const result = await apiFetch<T>(path, { ...options, method: 'POST', body: JSON.stringify(data) });
    return { data: { success: true, data: result } };
  },
  put: async <T = any>(path: string, data?: any, options?: RequestInit) => {
    const result = await apiFetch<T>(path, { ...options, method: 'PUT', body: JSON.stringify(data) });
    return { data: { success: true, data: result } };
  },
  delete: async <T = any>(path: string, options?: RequestInit) => {
    const result = await apiFetch<T>(path, { ...options, method: 'DELETE' });
    return { data: { success: true, data: result } };
  }
};

export interface ApiTeamMember { id: string; ownerId: string; memberId: string; role: string; createdAt: string; member: { id: string; email: string; fullName: string; createdAt: string; }; }
export async function fetchTeamMembers(): Promise<ApiTeamMember[]> { return await apiFetch('/api/v2/team'); }
export async function inviteTeamMember(email: string, role: string = 'viewer'): Promise<ApiTeamMember> { return await apiFetch('/api/v2/team/invite', { method: 'POST', body: JSON.stringify({ email, role }) }); }
export async function updateTeamMemberRole(memberId: string, role: string): Promise<ApiTeamMember> { return await apiFetch('/api/v2/team/' + memberId + '/role', { method: 'PUT', body: JSON.stringify({ role }) }); }
export async function removeTeamMember(memberId: string): Promise<void> { await apiFetch('/api/v2/team/' + memberId, { method: 'DELETE' }); }

export interface ApiAuditLog {
  id: string;
  workspaceOwnerId: string;
  actorUserId: string;
  action: string;
  targetId: string | null;
  metadata: any;
  createdAt: string;
}

export async function fetchAuditLogs(filters?: { action?: string; startDate?: string; endDate?: string }): Promise<{ data: ApiAuditLog[]; pagination?: any }> {
  const params = new URLSearchParams();
  if (filters?.action) params.append('action', filters.action);
  if (filters?.startDate) params.append('startDate', filters.startDate);
  if (filters?.endDate) params.append('endDate', filters.endDate);
  const query = params.toString() ? `?${params.toString()}` : '';
  return await apiFetch(`/api/v2/audit-logs${query}`);
}

export async function fetchDataRetention(): Promise<{ dataRetentionDays: number | null }> {
  return await apiFetch('/api/v2/user/retention');
}

export async function updateDataRetention(dataRetentionDays: number | null): Promise<{ dataRetentionDays: number | null; message: string }> {
  return await apiFetch('/api/v2/user/retention', {
    method: 'POST',
    body: JSON.stringify({ dataRetentionDays }),
  });
}

export async function fetchIpAllowlist(): Promise<{ allowedIpRanges: string[] }> {
  return await apiFetch('/api/v2/user/ip-allowlist');
}

export async function updateIpAllowlist(allowedIpRanges: string[]): Promise<{ allowedIpRanges: string[]; message: string }> {
  return await apiFetch('/api/v2/user/ip-allowlist', {
    method: 'POST',
    body: JSON.stringify({ allowedIpRanges }),
  });
}

export async function fetchConcurrencyTelemetry(): Promise<{ activeCallCount: number; softLimit: number }> {
  return await apiFetch('/api/v2/user/concurrency');
}

export async function updateConcurrencyLimit(maxConcurrentCalls: number): Promise<{ softLimit: number; message: string }> {
  return await apiFetch('/api/v2/user/concurrency', {
    method: 'POST',
    body: JSON.stringify({ maxConcurrentCalls }),
  });
}

// ─── Call Results & Reports API (M4) ─────────────────────────────────────────

export interface ReportListItem {
  id: string;
  callId: string;
  blueprintId: string;
  blueprintName?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  label: string;
  score: number | null;
  confidence: number | null;
  reviewNeeded: boolean;
  reviewReason?: string | null;
  summary?: string | null;
  fields?: Record<string, any>;
  evidenceQuotes?: Record<string, any>;
  hasHumanCorrection: boolean;
  createdAt: string;
  updatedAt: string;
  call?: {
    id: string;
    recipientPhoneNumber: string;
    fromPhoneNumber?: string;
    direction?: string;
    contactNumber?: string;
    businessNumber?: string;
    status: string;
    durationSeconds?: number;
    recordingUrl?: string | null;
    startedAt?: string;
    endedAt?: string;
    transcript?: string | null;
    agent?: { id: string; name: string } | null;
  };
}

export interface DetailedReport extends ReportListItem {
  call: ApiCall & {
    agent?: { id: string; name: string } | null;
  };
  job?: {
    id: string;
    status: string;
    attempts: number;
    maxAttempts: number;
    lastError?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  auditLogs?: Array<{
    id: string;
    action: string;
    actorUserId: string;
    createdAt: string;
    metadata: any;
  }>;
}

export interface ReportsSummary {
  totalCalls: number;
  analyzedCalls: number;
  pendingAnalysis: number;
  failedAnalysis: number;
  needsReviewCount: number;
  avgScore: number;
  humanCorrectionRate: number;
  labelDistribution: Record<string, number>;
  avgConfidence: number;
}

export interface BlueprintSummary {
  id: string;
  name: string;
  industry: string;
  description: string;
  labels: string[];
  fieldCount: number;
}

export const reportsApi = {
  listReports: async (params?: {
    status?: string;
    label?: string;
    reviewNeeded?: boolean;
    agentId?: string;
    batchId?: string;
    direction?: string;
    dateFrom?: string;
    dateTo?: string;
    cursor?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.append('status', params.status);
    if (params?.label) qs.append('label', params.label);
    if (params?.reviewNeeded !== undefined) qs.append('reviewNeeded', String(params.reviewNeeded));
    if (params?.agentId) qs.append('agentId', params.agentId);
    if (params?.batchId) qs.append('batchId', params.batchId);
    if (params?.direction && params.direction !== 'all') qs.append('direction', params.direction);
    if (params?.dateFrom) qs.append('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.append('dateTo', params.dateTo);
    if (params?.cursor) qs.append('cursor', params.cursor);
    if (params?.limit) qs.append('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return await apiFetch<{ items: ReportListItem[]; nextCursor: string | null; hasMore: boolean; totalCount: number }>(`/api/v2/reports${query}`);
  },
  getSummary: async (params?: { dateFrom?: string; dateTo?: string; agentId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.append('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.append('dateTo', params.dateTo);
    if (params?.agentId) qs.append('agentId', params.agentId);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return await apiFetch<ReportsSummary>(`/api/v2/reports/summary${query}`);
  },
  getBlueprints: async () => {
    return await apiFetch<BlueprintSummary[]>('/api/v2/reports/blueprints');
  },
  getReport: async (callId: string) => {
    return await apiFetch<DetailedReport>(`/api/v2/reports/${callId}`);
  },
  submitCorrection: async (callId: string, payload: { label?: string; fields?: Record<string, any>; score?: number; notes?: string }) => {
    return await apiFetch<{ report: ReportListItem; message: string }>(`/api/v2/reports/${callId}/correct`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  reanalyze: async (callId: string, payload?: { blueprintId?: string; priority?: number }) => {
    return await apiFetch<{ message: string; jobId: string }>(`/api/v2/reports/${callId}/reanalyze`, {
      method: 'POST',
      body: JSON.stringify(payload || {})
    });
  },
  downloadCsv: async (params?: {
    dateFrom?: string;
    dateTo?: string;
    label?: string;
    status?: string;
    direction?: string;
    batchId?: string;
    agentId?: string;
    reviewNeeded?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.append('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.append('dateTo', params.dateTo);
    if (params?.label && params.label !== 'all') qs.append('label', params.label);
    if (params?.status && params.status !== 'all') qs.append('status', params.status);
    if (params?.direction && params.direction !== 'all') qs.append('direction', params.direction);
    if (params?.batchId && params.batchId !== 'all') qs.append('batchId', params.batchId);
    if (params?.agentId && params.agentId !== 'all') qs.append('agentId', params.agentId);
    if (params?.reviewNeeded !== undefined) qs.append('reviewNeeded', String(params.reviewNeeded));
    const query = qs.toString() ? `?${qs.toString()}` : '';

    const token = typeof window !== 'undefined'
      ? (localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'))
      : null;
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/api/v2/reports/export/csv${query}`, {
      method: 'GET',
      headers,
    });
    if (!res.ok) throw new Error(`Export CSV failed with HTTP ${res.status}`);
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `claritiy_call_reports_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  },
  getExportCsvUrl: (params?: { dateFrom?: string; dateTo?: string; label?: string; reviewNeeded?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.append('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.append('dateTo', params.dateTo);
    if (params?.label) qs.append('label', params.label);
    if (params?.reviewNeeded !== undefined) qs.append('reviewNeeded', String(params.reviewNeeded));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return `${API_BASE}/api/v2/reports/export.csv${query}`;
  }
};
