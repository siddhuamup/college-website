/**
 * SSCC Core: Central State Management
 * Enterprise Pub/Sub Store with Middleware & Reducer Support
 */
class Store {
  constructor(initialState = {}) {
    this.state = { ...initialState };
    this.listeners = new Set();
    this.middleware = [];
  }

  getState() {
    return Object.freeze({ ...this.state });
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispatch(action) {
    const prevState = this.state;
    let processedAction = action;
    for (const mw of this.middleware) {
      processedAction = mw(processedAction, prevState);
      if (!processedAction) return;
    }
    this.state = this.reducer(prevState, processedAction);
    if (prevState !== this.state) {
      this.listeners.forEach(fn => fn(this.state, prevState));
    }
  }

  reducer(state, action) {
    switch (action.type) {
      case 'AUTH/SET_USER':
        return { ...state, user: action.payload, isAuthenticated: true };
      case 'AUTH/LOGOUT':
        return { ...state, user: null, isAuthenticated: false, token: null };
      case 'UI/SET_THEME':
        return { ...state, theme: action.payload };
      case 'UI/SET_SIDEBAR':
        return { ...state, sidebarOpen: action.payload };
      case 'UI/SET_LOADING':
        return { ...state, globalLoading: action.payload };
      case 'NOTIFICATIONS/ADD':
        return { ...state, notifications: [...state.notifications, action.payload] };
      case 'NOTIFICATIONS/REMOVE':
        return { ...state, notifications: state.notifications.filter(n => n.id !== action.payload) };
      default:
        return state;
    }
  }

  use(middleware) {
    this.middleware.push(middleware);
  }
}

export const store = new Store({
  user: null,
  isAuthenticated: false,
  token: null,
  theme: localStorage.getItem('theme') || 'light',
  sidebarOpen: window.innerWidth > 1024,
  globalLoading: false,
  notifications: []
});
