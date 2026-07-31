/**
 * ThemeManager — handles theme switching (light/dark) and persistence
 */
(function() {
  const THEME_KEY = 'ssc_theme';

  const ThemeManager = {
    current: 'dark', // 'light' | 'dark'

    init() {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') {
        this.current = saved;
      } else {
        this.current = 'dark'; // baseline default is dark
      }
      this.apply();
    },

    set(mode) {
      if (mode !== 'light' && mode !== 'dark') return;
      this.current = mode;
      localStorage.setItem(THEME_KEY, mode);
      this.apply();
    },

    toggle() {
      this.set(this.current === 'dark' ? 'light' : 'dark');
    },

    // Alias for backward compatibility
    cycle() {
      this.toggle();
    },

    apply() {
      document.documentElement.setAttribute('data-theme', this.current);
      if (document.body) {
        document.body.setAttribute('data-theme', this.current);
      }
      this.updateToggles();
    },

    updateToggles() {
      const isDark = this.current === 'dark';
      const sunSvg = `<svg class="icon-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
      const moonSvg = `<svg class="icon-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      
      document.querySelectorAll('.theme-toggle-btn, .theme-toggle, #theme-toggle, #theme-toggle-sidebar').forEach(btn => {
        btn.classList.add('theme-toggle');
        btn.innerHTML = isDark ? sunSvg : moonSvg;
        btn.setAttribute('aria-label', 'Switch to ' + (isDark ? 'light' : 'dark') + ' theme');
        btn.title = 'Switch to ' + (isDark ? 'light' : 'dark') + ' theme';
      });
    }
  };

  // Run immediately to prevent FOUC
  ThemeManager.init();

  // Export to window
  window.ThemeManager = ThemeManager;

  // Run updateToggles and attach delegated click listener when DOM is ready
  function setupThemeListeners() {
    ThemeManager.apply();
    if (!document.dataset || !document.dataset.themeBound) {
      if (document.dataset) document.dataset.themeBound = 'true';
      document.addEventListener('click', (e) => {
        const toggleBtn = e.target.closest('.theme-toggle-btn, #theme-toggle, #theme-toggle-sidebar');
        if (toggleBtn) {
          e.preventDefault();
          ThemeManager.toggle();
        }
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupThemeListeners);
  } else {
    setupThemeListeners();
  }
})();
