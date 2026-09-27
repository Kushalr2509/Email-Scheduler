export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    credentials: 'include', // Important for cookies
  });

  if (!response.ok) {
    let message = 'API request failed';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {
      // Ignore JSON parse error on non-JSON response
    }
    
    // Auto-redirect to login on 401 Unauthenticated
    if (response.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/') {
      window.location.href = '/';
    }

    throw new ApiError(response.status, message);
  }

  return response;
}

export const api = {
  get: async (endpoint: string) => {
    const res = await fetchWithAuth(endpoint);
    return res.json();
  },
  post: async (endpoint: string, body: any, headers?: Record<string, string>) => {
    const res = await fetchWithAuth(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
      headers,
    });
    return res.json();
  },
};
