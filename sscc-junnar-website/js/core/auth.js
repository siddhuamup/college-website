/**
 * SSCC Core: Auth Session Management
 */
export class AuthManager {
  static getToken() {
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem('auth_token') || localStorage.getItem('ssc_token');
  }

  static setToken(token) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('auth_token', token);
    localStorage.setItem('ssc_token', token);
  }

  static removeToken() {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem('auth_token');
    localStorage.removeItem('ssc_token');
    localStorage.removeItem('ssc_user');
  }

  static getUser() {
    if (typeof localStorage === 'undefined') return null;
    try {
      const u = localStorage.getItem('ssc_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  }

  static setUser(user) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem('ssc_user', JSON.stringify(user));
  }

  static isAuthenticated() {
    return !!this.getToken();
  }
}
