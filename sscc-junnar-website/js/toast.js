/**
 * ANTIGRAVITY TOAST NOTIFICATION MODULE
 * Lightweight Toast notification system for Vanilla JS
 */

const Toast = {
  container: null,

  init() {
    if (this.container && document.body.contains(this.container)) return;
    this.container = document.createElement('div');
    this.container.className = 'toast-container';
    document.body.appendChild(this.container);
  },

  show(message, type = 'info', duration = 5000) {
    this.init();
    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    const heading = type.toUpperCase();
    el.innerHTML = `<strong>${heading}</strong><p style="margin:4px 0 0;font-size:14px;line-height:1.4;">${window.escapeText ? window.escapeText(message) : message}</p>`;
    this.container.appendChild(el);

    setTimeout(() => {
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      el.style.transition = 'opacity 300ms, transform 300ms';
      setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 300);
    }, duration);
  },

  success(msg, duration = 5000) {
    this.show(msg, 'success', duration);
  },

  error(msg, duration = 8000) {
    this.show(msg, 'error', duration);
  },

  info(msg, duration = 5000) {
    this.show(msg, 'info', duration);
  }
};

window.Toast = Toast;
if (typeof window.showToast !== 'function') {
  window.showToast = function(msg, type = 'info') {
    Toast.show(msg, type === 'error' ? 'error' : type === 'success' ? 'success' : 'info');
  };
}
