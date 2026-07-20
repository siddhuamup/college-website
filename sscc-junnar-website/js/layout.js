document.addEventListener('DOMContentLoaded', async () => {
  const header = document.getElementById('site-header');
  const footer = document.getElementById('site-footer');
  if (!header && !footer) return;
  try {
    if (header) {
      const res = await fetch('/partials/nav.html');
      if (res.ok) {
        header.innerHTML = await res.text();
        if (window.ThemeManager) window.ThemeManager.updateToggles();
      }
    }
    if (footer) {
      const res = await fetch('/partials/footer.html');
      if (res.ok) footer.innerHTML = await res.text();
    }
  } catch {
    /* offline or file:// */
  }
  document.dispatchEvent(new CustomEvent('layout-loaded'));
});

// ── UI/UX Enhancements Helpers ─────────────────────────────

// Toast Notification System
window.showToast = function(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  
  const msgSpan = document.createElement('span');
  msgSpan.textContent = message;
  toast.appendChild(msgSpan);
  
  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.setAttribute('aria-label', 'Dismiss notification');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => toast.remove());
  toast.appendChild(closeBtn);
  
  container.appendChild(toast);
  
  // Auto-dismiss after 4 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// Back to Top button auto-injection & scroll handling
document.addEventListener('DOMContentLoaded', () => {
  let btt = document.getElementById('back-to-top');
  if (!btt) {
    btt = document.createElement('button');
    btt.id = 'back-to-top';
    btt.setAttribute('aria-label', 'Back to Top');
    btt.innerHTML = '↑';
    document.body.appendChild(btt);
  }
  
  window.addEventListener('scroll', () => {
    if (window.scrollY > 300) {
      btt.classList.add('visible');
    } else {
      btt.classList.remove('visible');
    }
  });
  
  btt.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
});

// ── Confirmation Dialog Component ─────────────────────────────
/**
 * Show a confirmation dialog. Returns a Promise that resolves true (confirm) or false (cancel).
 * @param {string} message - The confirmation message
 * @param {string} [title='Are you sure?'] - Dialog title
 * @param {string} [confirmText='Confirm'] - Confirm button label
 * @param {string} [confirmClass='btn danger'] - CSS class for confirm button
 */
window.showConfirm = function(message, title = 'Are you sure?', confirmText = 'Confirm', confirmClass = 'btn danger') {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-dialog-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-label', title);

    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';

    const h3 = document.createElement('h3');
    h3.textContent = title;

    const p = document.createElement('p');
    p.textContent = message;

    const actions = document.createElement('div');
    actions.className = 'confirm-dialog-actions';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn secondary';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => { backdrop.remove(); resolve(false); });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = confirmClass;
    confirmBtn.textContent = confirmText;
    confirmBtn.addEventListener('click', () => { backdrop.remove(); resolve(true); });

    actions.appendChild(cancelBtn);
    actions.appendChild(confirmBtn);
    dialog.appendChild(h3);
    dialog.appendChild(p);
    dialog.appendChild(actions);
    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    // Close on Escape
    const onKey = (e) => {
      if (e.key === 'Escape') { backdrop.remove(); resolve(false); document.removeEventListener('keydown', onKey); }
    };
    document.addEventListener('keydown', onKey);

    // Focus the cancel button for keyboard accessibility
    cancelBtn.focus();
  });
};

// ── Accordion Initializer ────────────────────────────────────
window.initAccordions = function(container = document) {
  container.querySelectorAll('.accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const panel = document.getElementById(trigger.getAttribute('aria-controls'));
      if (!panel) return;
      const isExpanded = trigger.getAttribute('aria-expanded') === 'true';
      trigger.setAttribute('aria-expanded', !isExpanded);
      panel.setAttribute('aria-hidden', isExpanded);
    });
  });
};

// ── Duplicate Submit Guard Helper (Item B6) ───────────────────
window.withSubmitGuard = function(fn) {
  let isSubmitting = false;
  return async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (isSubmitting) return;

    const form = e && e.target && e.target.tagName === 'FORM' ? e.target : null;
    const btn = form ? (form.querySelector('button[type="submit"]') || form.querySelector('button:not([type="button"])')) : null;

    isSubmitting = true;
    if (btn) {
      btn.disabled = true;
      btn.classList.add('loading');
    }

    try {
      await fn(e);
    } finally {
      isSubmitting = false;
      if (btn) {
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    }
  };
};
