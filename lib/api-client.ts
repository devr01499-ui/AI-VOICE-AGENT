import axios from 'axios';
import { supabase } from './supabase';

export const getBackendUrl = (): string => {
  return (
    process.env.NEXT_PUBLIC_API_URL || 
    process.env.NEXT_PUBLIC_BACKEND_URL || 
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://ai-voice-agent-backend-mv32.onrender.com')
  );
};

const api = axios.create({
  baseURL: 
    process.env.NEXT_PUBLIC_API_URL || 
    process.env.NEXT_PUBLIC_BACKEND_URL || 
    (typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://ai-voice-agent-backend-mv32.onrender.com'),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(
  async (config) => {
    try {
      const sessionResult = await supabase.auth.getSession();
      const token = sessionResult.data?.session?.access_token;
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      } else {
        return Promise.reject(new Error("MISSING_ACTIVE_SESSION_TOKEN"));
      }
    } catch (e) {
      return Promise.reject(new Error("MISSING_ACTIVE_SESSION_TOKEN"));
    }
    
    config.headers['x-request-id'] = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `req-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const customError = {
      message: 
        error.response?.data?.error?.message || 
        error.response?.data?.message || 
        'An unexpected error occurred.',
      status: error.response?.status || 500,
      originalError: error,
    };
    
    // We can bubble up errors to the hook layer to present toasts dynamically.
    return Promise.reject(customError);
  }
);

export default api;
