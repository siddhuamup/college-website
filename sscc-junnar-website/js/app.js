/**
 * SSCC Junnar ERP — Main Enterprise App Entry Point
 * Bootstraps Theme, Central State, Toast Notification System & Layout Listeners
 */
import { ThemeManager } from './core/theme.js';
import { store } from './core/state.js';
import { toast } from './components/toast.js';
import { SidebarController } from './components/sidebar.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Theme
  ThemeManager.init();

  // Initialize Sidebar Controller
  SidebarController.init();

  // Bind Theme Toggle Button if present
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const newTheme = ThemeManager.toggle();
      store.dispatch({ type: 'UI/SET_THEME', payload: newTheme });
    });
  }

  // Subscribe state to UI updates
  store.subscribe((state, prevState) => {
    if (state.theme !== prevState.theme) {
      ThemeManager.setTheme(state.theme);
    }
  });

  // Export global instances for legacy script compatibility
  window.SSCC = {
    store,
    toast,
    ThemeManager
  };
});
