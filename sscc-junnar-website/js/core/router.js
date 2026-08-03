/**
 * SSCC Core: Lightweight Router
 */
export class Router {
  constructor() {
    this.routes = new Map();
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', () => this.handleRoute());
    }
  }

  add(path, handler) {
    this.routes.set(path, handler);
  }

  navigate(path) {
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', path);
      this.handleRoute();
    }
  }

  handleRoute() {
    if (typeof window === 'undefined') return;
    const path = window.location.pathname;
    const handler = this.routes.get(path) || this.routes.get('*');
    if (handler) handler(path);
  }
}
