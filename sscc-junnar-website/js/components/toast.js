/**
 * SSCC Component: Toast Notification System
 * Enterprise Toast Notification System with Auto-dismiss & Progress Bar
 */
class ToastSystem {
  constructor() {
    this.container = null;
    this.toasts = new Map();
    if (typeof document !== 'undefined') {
      this.init();
    }
  }

  init() {
    if (this.container) return;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Notifications');
    document.body.appendChild(this.container);
  }

  show(options) {
    if (!this.container) this.init();
    const { title = '', message = '', type = 'info', duration = 5000, dismissible = true } = options;
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const toast = document.createElement('div');

    const icons = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };

    toast.className = `toast toast--${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <span class="toast__icon">${icons[type] || icons.info}</span>
      <div class="toast__content">
        ${title ? `<div class="toast__title">${this.escapeHtml(title)}</div>` : ''}
        <div class="toast__message">${this.escapeHtml(message)}</div>
      </div>
      ${dismissible ? `<button type="button" class="toast__close" aria-label="Dismiss notification"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
      <div class="toast__progress" style="animation-duration: ${duration}ms;"></div>
    `;

    this.container.appendChild(toast);
    this.toasts.set(id, toast);

    let timeoutId;
    if (duration > 0) timeoutId = setTimeout(() => this.dismiss(id), duration);

    if (dismissible) {
      const closeBtn = toast.querySelector('.toast__close');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => { clearTimeout(timeoutId); this.dismiss(id); });
      }
    }

    toast.addEventListener('mouseenter', () => clearTimeout(timeoutId));
    toast.addEventListener('mouseleave', () => {
      if (duration > 0) timeoutId = setTimeout(() => this.dismiss(id), duration);
    });

    return id;
  }

  dismiss(id) {
    const toast = this.toasts.get(id);
    if (!toast) return;
    toast.classList.add('toast--out');
    toast.addEventListener('animationend', () => { toast.remove(); this.toasts.delete(id); });
  }

  success(message, title = 'Success') { return this.show({ type: 'success', title, message }); }
  error(message, title = 'Error') { return this.show({ type: 'error', title, message, duration: 8000 }); }
  warning(message, title = 'Warning') { return this.show({ type: 'warning', title, message }); }
  info(message, title = 'Info') { return this.show({ type: 'info', title, message }); }

  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

export const toast = new ToastSystem();
