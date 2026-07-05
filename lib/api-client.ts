import axios from 'axios';

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
  (config) => {
    // Automatically attach tokens or active workspace credentials if needed
    config.headers['Authorization'] = 'Bearer a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
    config.headers['x-user-id'] = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
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
