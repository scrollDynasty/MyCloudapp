// Fetch Configuration
// Centralized fetch helper with proper headers for production API

import { API_URL } from './api';

/**
 * Get headers for API requests
 */
export const getHeaders = (token?: string) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    'User-Agent': 'VPSBilling-App',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Enhanced fetch that automatically adds proper headers
 */
export const fetchWithHeaders = async (
  url: string,
  options: RequestInit = {},
  token?: string
) => {
  const headers = {
    ...getHeaders(token),
    ...(options.headers || {}),
  };
  
  return fetch(url, {
    ...options,
    headers,
  });
};

/**
 * Authenticated fetch helper
 */
export const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = typeof localStorage !== 'undefined' 
    ? localStorage.getItem('token')
    : null;

  const headers = {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  };

  const response = await fetch(`${API_URL}${url}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  return response.json();
};
