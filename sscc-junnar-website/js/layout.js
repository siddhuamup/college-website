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
