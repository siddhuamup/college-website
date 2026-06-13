/* app.js — navigation, mobile menu, active states */
function navLeafPath() {
  const parts = location.pathname.split('/').filter(Boolean);
  let leaf = parts.pop() || 'index.html';
  if (!leaf.includes('.')) leaf = 'index.html';
  return leaf;
}

function closeMobileNav(menuBtn, links) {
  if (!links) return;
  links.classList.remove('open');
  if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
}

function closeAllNavGroups(root) {
  root.querySelectorAll('.nav-group.open').forEach((g) => {
    g.classList.remove('open');
    const t = g.querySelector('.nav-group-toggle');
    if (t) t.setAttribute('aria-expanded', 'false');
  });
}

function initNavAndActive() {
  const menuBtn = document.getElementById('nav-toggle');
  const links = document.querySelector('.navlinks');

  if (menuBtn && links) {
    menuBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const open = !links.classList.contains('open');
      closeAllNavGroups(document);
      links.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });

    links.querySelectorAll('a[href]').forEach((a) => {
      a.addEventListener('click', () => {
        closeMobileNav(menuBtn, links);
        closeAllNavGroups(document);
      });
    });

    links.addEventListener('click', (e) => e.stopPropagation());
  }

  document.addEventListener('click', () => {
    closeMobileNav(menuBtn, links);
    closeAllNavGroups(document);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeMobileNav(menuBtn, links);
      closeAllNavGroups(document);
    }
  });

  document.querySelectorAll('[data-nav-group]').forEach((group) => {
    const toggle = group.querySelector('.nav-group-toggle');
    const panel = group.querySelector('.nav-group-panel');
    if (!toggle || !panel) return;

    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = group.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      document.querySelectorAll('[data-nav-group]').forEach((other) => {
        if (other !== group) {
          other.classList.remove('open');
          const ot = other.querySelector('.nav-group-toggle');
          if (ot) ot.setAttribute('aria-expanded', 'false');
        }
      });
    });

    panel.querySelectorAll('a').forEach((a) => {
      a.addEventListener('click', () => {
        group.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        closeMobileNav(menuBtn, links);
      });
    });
  });

  const leaf = navLeafPath();
  document.querySelectorAll('.navlinks a[href], .nav-group-panel a[href]').forEach((a) => {
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    const path = href.replace(/^\//, '');
    if (path === leaf) a.classList.add('active');
  });

  const slider = document.querySelector('[data-slider]');
  if (slider) {
    const track = slider.querySelector('[data-track]');
    const items = slider.querySelectorAll('.slide');
    if (track && items.length) {
      let i = 0;
      setInterval(() => {
        i = (i + 1) % items.length;
        track.style.transform = `translateX(-${i * 100}%)`;
      }, 3500);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('site-header')) {
    document.addEventListener('layout-loaded', initNavAndActive, { once: true });
  } else {
    initNavAndActive();
  }
});
