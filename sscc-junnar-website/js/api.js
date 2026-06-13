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
      const token = this.token();
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetch(`${this.base}${path}`, { ...options, headers });
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
      const res = await fetch(`${this.base}${path}`, { method, body: formData, headers });
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
  };
})();
