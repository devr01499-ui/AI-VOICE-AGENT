import { supabase } from './supabase';

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (isLocal
    ? 'http://localhost:3001'
    : 'https://ai-voice-agent-backend-mv32.onrender.com');

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
  const session = (await supabase.auth.getSession()).data.session;
  const res = await fetch(`${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`, {
    headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
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
  const session = (await supabase.auth.getSession()).data.session;
  const token = session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-request-id': `admin_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

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
