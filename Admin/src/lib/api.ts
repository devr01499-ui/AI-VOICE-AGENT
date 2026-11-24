import { supabase } from './supabase';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (isLocal
    ? 'http://localhost:3001'
    : 'https://ai-voice-agent-backend-mv32.onrender.com');

/**
 * Owner access key (owner decision 2026-11-24: no login screen). Set VITE_ADMIN_ACCESS_KEY only in
 * the admin console's own Vercel project, to the same value as ADMIN_ACCESS_KEY on the server.
 * When it is set, the console opens without a sign-in and every request carries the key; when it is
 * not set (e.g. the /admin copy on the main site), the normal sign-in + two-factor flow is used.
 */
export const ACCESS_KEY: string = String(import.meta.env.VITE_ADMIN_ACCESS_KEY || '').trim();
export const ACCESS_KEY_MODE = ACCESS_KEY.length >= 32;

async function authHeaders(): Promise<Record<string, string>> {
  if (ACCESS_KEY_MODE) return { 'x-admin-access-key': ACCESS_KEY };
  const session = (await supabase.auth.getSession()).data.session;
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
}

export class AdminApiError extends Error {
  status: number;
  code?: string;
  data?: any;

  constructor(message: string, status: number, code?: string, data?: any) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

/**
 * One key per dialog opening: the server applies an action with the same key only once, so a
 * double click or a network retry never grants minutes or a plan twice.
 */
export function newRequestKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `k${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Downloads a file from an admin endpoint WITH the sign-in token (a plain link or window.open
 * sends no token, so every export used to fail with 401).
 */
export async function adminDownload(endpoint: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
    headers: await authHeaders(),
  });
  if (!res.ok) {
    let msg = `Download failed (HTTP ${res.status})`;
    try {
      const body = await res.json();
      msg = body.message || body.error || msg;
    } catch { /* not JSON */ }
    throw new AdminApiError(msg, res.status);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function adminFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-request-id': `admin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...(await authHeaders()),
    ...(options.headers as Record<string, string>),
  };

  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  const contentType = res.headers.get('content-type');
  const isJson = contentType && contentType.includes('application/json');
  const body = isJson ? await res.json() : await res.text();

  if (!res.ok) {
    const errorMsg =
      (isJson && (body.message || body.error)) ||
      res.statusText ||
      `HTTP ${res.status}`;
    const errorCode = isJson && typeof body.error === 'string' ? body.error : undefined;
    throw new AdminApiError(errorMsg, res.status, errorCode, body);
  }

  return body as T;
}
