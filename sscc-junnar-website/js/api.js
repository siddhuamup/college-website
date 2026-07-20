(function () {
  const origin = window.location.origin;

  window.SSC_API = {
    base: `${origin}/api`,

    token() {
      return localStorage.getItem('ssc_token');
    },

    setToken(t) {
      if (t) localStorage.setItem('ssc_token', t);
      else localStorage.removeItem('ssc_token');
    },

    async request(path, options = {}) {
      const headers = { ...(options.headers || {}) };
      // Fallback: send Bearer header if localStorage token exists (migration bridge)
      const token = this.token();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${this.base}${path}`, {
        ...options,
        headers,
        credentials: 'include', // Send httpOnly cookies automatically
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      if (!res.ok) {
        const err = new Error(data.error || res.statusText || 'Request failed');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },

    get(path) {
      return this.request(path, { method: 'GET' });
    },

    post(path, body, isJson = true) {
      return this.request(path, {
        method: 'POST',
        headers: isJson ? { 'Content-Type': 'application/json' } : {},
        body: isJson ? JSON.stringify(body) : body,
      });
    },

    patch(path, body) {
      return this.request(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },

    put(path, body) {
      return this.request(path, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    },

    delete(path) {
      return this.request(path, { method: 'DELETE' });
    },

    async upload(path, formData, method = 'POST') {
      const headers = {};
      const token = this.token();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${this.base}${path}`, {
        method,
        body: formData,
        headers,
        credentials: 'include',
      });
      const text = await res.text();
      let data;
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        data = { raw: text };
      }
      if (!res.ok) {
        const err = new Error(data.error || res.statusText || 'Upload failed');
        err.status = res.status;
        err.data = data;
        throw err;
      }
      return data;
    },

    async logout() {
      try {
        await this.request('/auth/logout', { method: 'POST' });
      } catch { /* server may be unreachable */ }
      this.setToken(null);
    },
  };
})();

// ── XSS Protection Utilities ─────────────────────────────────
// Available globally to all portal JS files.

/**
 * Escape user-supplied strings for safe insertion into innerHTML templates.
 * Converts all HTML-significant characters to their entity equivalents.
 */
window.escapeText = function(str) {
  if (str == null) return '';
  const s = String(str);
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
};

/**
 * Sanitize HTML that must preserve formatting (e.g. rich notice bodies).
 * Uses DOMPurify if loaded, otherwise falls back to escapeText().
 */
window.sanitizeHTML = function(html) {
  if (html == null) return '';
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(String(html), {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'code', 'pre'],
      ALLOWED_ATTR: ['href', 'target', 'rel', 'class'],
    });
  }
  return window.escapeText(html);
};
