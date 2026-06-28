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
  toast.innerHTML = `
    <span>${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">×</button>
  `;
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

