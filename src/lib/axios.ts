import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

import axios from 'axios';

import { AUTH } from 'src/lib/firebase';
import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

const axiosInstance = axios.create({
  baseURL: CONFIG.serverUrl,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Firebase ID tokens expire after ~1h. Fetch the current token per request —
// the SDK refreshes it automatically when expired — so idle tabs never send a
// dead token. Fall back to the stored token before auth has restored.
axiosInstance.interceptors.request.use(async (config) => {
  // After a reload, wait for Firebase to finish restoring the session before
  // deciding there is no user — otherwise early requests race ahead and send
  // the stale stored token.
  await (AUTH as any)?.authStateReady?.().catch(() => undefined);
  const currentUser = (AUTH as any)?.currentUser;
  if (currentUser) {
    try {
      const token = await currentUser.getIdToken();
      if (token) {
        localStorage.setItem('firebaseIdToken', token);
        config.headers.Authorization = `Bearer ${token}`;
        return config;
      }
    } catch {
      // fall through to the stored token
    }
  }
  const stored = localStorage.getItem('firebaseIdToken');
  if (stored) {
    config.headers.Authorization = `Bearer ${stored}`;
  }
  return config;
});

// Airtable computed fields that fail (formula/lookup NaN, errors, Infinity)
// come back as sentinel objects like {"specialValue": "NaN"}. Rendering one
// crashes React with error #31 — normalize them to null so views show blank.
const isSpecialValue = (v: any): boolean => {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return false;
  const keys = Object.keys(v);
  return keys.length === 1 && keys[0].toLowerCase() === 'specialvalue';
};

const sanitizeSpecialValues = (value: any): any => {
  if (isSpecialValue(value)) return null;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) value[i] = sanitizeSpecialValues(value[i]);
  } else if (value != null && typeof value === 'object') {
    Object.keys(value).forEach((k) => {
      value[k] = sanitizeSpecialValues(value[k]);
    });
  }
  return value;
};

axiosInstance.interceptors.response.use(
  (response) => {
    if (response.data != null && typeof response.data === 'object') {
      response.data = sanitizeSpecialValues(response.data);
    }
    return response;
  },
  async (error) => {
    const original = error?.config as (InternalAxiosRequestConfig & { __retried?: boolean }) | undefined;

    // Token was valid when issued but rejected — force-refresh once and retry.
    if (error?.response?.status === 401 && original && !original.__retried) {
      const currentUser = (AUTH as any)?.currentUser;
      if (currentUser) {
        original.__retried = true;
        try {
          const token = await currentUser.getIdToken(true);
          localStorage.setItem('firebaseIdToken', token);
          axiosInstance.defaults.headers.common.Authorization = `Bearer ${token}`;
          original.headers.Authorization = `Bearer ${token}`;
          return axiosInstance.request(original);
        } catch {
          // fall through to the normalized error
        }
      }
    }

    // No response at all — typical right after the machine wakes from sleep
    // while the network is still reconnecting. Wait a beat and retry GETs once.
    if (!error?.response && original && !original.__retried && (!original.method || original.method === 'get')) {
      original.__retried = true;
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return axiosInstance.request(original);
    }

    const message = error?.response?.data?.message || error?.message || 'Something went wrong!';
    console.error('Axios error:', message);
    return Promise.reject(new Error(message));
  }
);

export default axiosInstance;

// ----------------------------------------------------------------------

export const fetcher = async <T = unknown>(
  args: string | [string, AxiosRequestConfig]
): Promise<T> => {
  try {
    const [url, config] = Array.isArray(args) ? args : [args, {}];

    const res = await axiosInstance.get<T>(url, config);

    return res.data;
  } catch (error) {
    console.error('Fetcher failed:', error);
    throw error;
  }
};

// ----------------------------------------------------------------------

export const endpoints = {
  chat: '/api/chat',
  kanban: '/api/kanban',
  calendar: '/api/calendar',
  auth: {
    me: '/api/auth/me',
    signIn: '/api/auth/sign-in',
    signUp: '/api/auth/sign-up',
  },
  mail: {
    list: '/api/mail/list',
    details: '/api/mail/details',
    labels: '/api/mail/labels',
  },
  post: {
    list: '/api/post/list',
    details: '/api/post/details',
    latest: '/api/post/latest',
    search: '/api/post/search',
  },
  product: {
    list: '/api/product/list',
    details: '/api/product/details',
    search: '/api/product/search',
  },
} as const;
