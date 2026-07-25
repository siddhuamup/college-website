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
      const label = isDark ? '☀️ Light' : '🌙 Dark';
      document.querySelectorAll('.theme-toggle-btn').forEach(btn => {
        const svg = btn.querySelector('svg');
        if (svg) {
          Array.from(btn.childNodes).forEach(n => {
            if (n.nodeType === Node.TEXT_NODE) n.remove();
          });
          btn.appendChild(document.createTextNode(' ' + label));
        } else {
          btn.textContent = label;
        }
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
