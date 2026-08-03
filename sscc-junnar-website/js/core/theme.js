/**
 * SSCC Core: Theme Manager (Dark / Light Mode)
 */
export class ThemeManager {
  static getTheme() {
    if (typeof localStorage === 'undefined') return 'light';
    return localStorage.getItem('theme') || 'light';
  }

  static setTheme(theme) {
    if (typeof document === 'undefined') return;
    document.documentElement.setAttribute('data-theme', theme);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('theme', theme);
    }
  }

  static toggle() {
    const current = this.getTheme();
    const next = current === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
    return next;
  }

  static init() {
    if (typeof document === 'undefined') return;
    const saved = this.getTheme();
    document.documentElement.setAttribute('data-theme', saved);
  }
}

ThemeManager.init();
