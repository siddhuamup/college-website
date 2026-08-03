/**
 * SSCC Core: Enterprise HTTP Client Wrapper
 * Features Interceptors, Request Caching, Auto-Authorization Token Injection,
 * 401 Session Expiry Redirects & Central Error Toast Dispatch
 */
class HttpClient {
  constructor(baseURL = '') {
    this.baseURL = baseURL;
    this.interceptors = { request: [], response: [], error: [] };
    this.cache = new Map();
  }

  onRequest(fn) { this.interceptors.request.push(fn); }
  onResponse(fn) { this.interceptors.response.push(fn); }
  onError(fn) { this.interceptors.error.push(fn); }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', ...options.headers },
      ...options
    };

    if (typeof localStorage !== 'undefined') {
      const token = localStorage.getItem('auth_token') || localStorage.getItem('ssc_token');
      if (token) config.headers['Authorization'] = `Bearer ${token}`;
    }

    for (const interceptor of this.interceptors.request) await interceptor(config);

    if (config.method === 'GET' && config.cache !== false) {
      const cached = this.cache.get(url);
      if (cached && Date.now() - cached.timestamp < (config.cacheTTL || 60000)) return cached.data;
    }

    try {
      const response = await fetch(url, config);
      if (!response.ok) { const error = await this.parseError(response); throw error; }
      const data = await response.json();
      if (config.method === 'GET' || !config.method) this.cache.set(url, { data, timestamp: Date.now() });
      for (const interceptor of this.interceptors.response) await interceptor(data, response);
      return data;
    } catch (error) {
      for (const interceptor of this.interceptors.error) await interceptor(error);
      throw error;
    }
  }

  async parseError(response) {
    let message = `HTTP ${response.status}: ${response.statusText}`;
    let data = null;
    try { data = await response.json(); message = data.error || data.message || message; } catch { try { const text = await response.text(); if (text) message = text; } catch {} }
    const error = new Error(message);
    error.status = response.status;
    error.data = data;
    error.response = response;
    return error;
  }

  get(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'GET' }); }
  post(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }); }
  put(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'PUT', body: JSON.stringify(body) }); }
  patch(endpoint, body, options = {}) { return this.request(endpoint, { ...options, method: 'PATCH', body: JSON.stringify(body) }); }
  delete(endpoint, options = {}) { return this.request(endpoint, { ...options, method: 'DELETE' }); }

  clearCache(pattern) {
    if (!pattern) { this.cache.clear(); }
    else { for (const key of this.cache.keys()) { if (key.includes(pattern)) this.cache.delete(key); } }
  }
}

export const api = new HttpClient('/api');

api.onError(async (error) => {
  if (error.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('ssc_token');
    window.location.href = '/login.html?session=expired';
  }
  if (error.status === 403 && typeof window !== 'undefined') {
    const { toast } = await import('../components/toast.js');
    toast.error('You do not have permission to perform this action.', 'Access Denied');
  }
  if (error.status >= 500 && typeof window !== 'undefined') {
    const { toast } = await import('../components/toast.js');
    toast.error('Something went wrong on our end. Please try again later.', 'Server Error');
  }
});
