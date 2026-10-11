import { supabase } from './supabase';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3001';

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
