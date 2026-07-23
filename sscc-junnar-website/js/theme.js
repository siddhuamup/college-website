/**
 * ThemeManager — handles theme switching (light/dark) and persistence
 * Binary toggle: Light | Dark with ☀️/🌙 icon switching
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

    getLabel() {
      return this.current === 'light' ? 'Dark' : 'Light';
    },

    getIcon() {
      return this.current === 'light' ? '🌙' : '☀️';
    },

    updateToggles() {
      const label = this.getLabel();
      const icon = this.getIcon();
      const toggles = document.querySelectorAll('.theme-toggle-btn');
      toggles.forEach(btn => {
        const svg = btn.querySelector('svg');
        if (svg) {
          Array.from(btn.childNodes).forEach(n => {
            if (n.nodeType === Node.TEXT_NODE) n.remove();
          });
          btn.appendChild(document.createTextNode(` ${icon} ${label}`));
        } else {
          btn.textContent = `${icon} ${label}`;
        }
        btn.setAttribute('aria-label', `Switch to ${label} theme`);
        btn.title = `Switch to ${label} theme`;
      });
    }
  };

  // Run immediately to prevent FOUC
  ThemeManager.init();

  // Export to window
  window.ThemeManager = ThemeManager;

  // Run updateToggles when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ThemeManager.apply());
  } else {
    ThemeManager.apply();
  }
})();
