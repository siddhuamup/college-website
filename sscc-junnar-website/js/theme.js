/**
 * ThemeManager — handles theme switching (light/dark) and persistence
 * Binary toggle: Light | Dark — no emojis, no system mode
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
      this.updateToggles();
    },

    toggle() {
      this.set(this.current === 'dark' ? 'light' : 'dark');
    },

    // Alias for backward compat
    cycle() {
      this.toggle();
    },

    apply() {
      document.documentElement.setAttribute('data-theme', this.current);
      this.updateToggles();
    },

    getLabel() {
      return this.current === 'light' ? 'Dark' : 'Light';
    },

    updateToggles() {
      const label = this.getLabel();
      const toggles = document.querySelectorAll('.theme-toggle-btn');
      toggles.forEach(btn => {
        // Preserve any SVG icon inside the button, only update the text node
        const svg = btn.querySelector('svg');
        if (svg) {
          // Remove all text nodes
          Array.from(btn.childNodes).forEach(n => {
            if (n.nodeType === Node.TEXT_NODE) n.remove();
          });
          // Append new text
          btn.appendChild(document.createTextNode(' ' + label));
        } else {
          btn.textContent = label;
        }
        btn.title = 'Switch to ' + label + ' theme';
      });
    }
  };

  // Run immediately to prevent FOUC
  ThemeManager.init();

  // Export to window
  window.ThemeManager = ThemeManager;

  // Run updateToggles when DOM is ready
  document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.updateToggles();
  });
})();
