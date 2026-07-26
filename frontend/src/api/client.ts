import axios from 'axios';

export const TOKEN_STORAGE_KEY = 'vyuha.token';

/**
 * API base. In local dev this stays `/api` and Vite proxies to the backend.
 * On Catalyst the client (Web Client Hosting) and the API (AppSail) are
 * separate origins, so VITE_API_BASE_URL points at the AppSail URL and we
 * append `/api`.
 */
const apiBase = import.meta.env.VITE_API_BASE_URL
  ? `${String(import.meta.env.VITE_API_BASE_URL).replace(/\/$/, '')}/api`
  : '/api';

/** True when the deployment has Catalyst Zia AI wired up (set at build time). */
export const CATALYST_AI = import.meta.env.VITE_CATALYST_AI === 'true';

/**
 * Shared axios instance. The auth token is attached by a request interceptor;
 * a 401 anywhere clears the session and bounces the user to the login screen.
 */
export const api = axios.create({ baseURL: apiBase });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  onUnauthorized = handler;
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const isLoginCall = error?.config?.url?.includes('/auth/login');
    if (status === 401 && !isLoginCall) onUnauthorized?.();
    return Promise.reject(error);
  },
);

export function extractErrorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail;
    if (typeof detail === 'string') return detail;
    if (error.code === 'ERR_NETWORK') {
      return 'Cannot reach the analytics server. Check that the backend is running.';
    }
  }
  return fallback;
}
