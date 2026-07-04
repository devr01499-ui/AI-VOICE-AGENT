import axios from 'axios';

export const getBackendUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3001';
  }
  
  // Primary choice: Vercel environment variable. Final absolute fallback: Live Render instance.
  return process.env.NEXT_PUBLIC_BACKEND_URL || 'https://ai-voice-agent-backend-mv32.onrender.com';
};

const api = axios.create({
  baseURL: getBackendUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    // Automatically attach tokens or active workspace credentials if needed
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
