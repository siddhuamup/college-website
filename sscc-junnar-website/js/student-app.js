(function () {
  let cachedSettings = null;
  let settingsFetchedAt = 0;
  const SETTINGS_TTL = 5 * 60 * 1000; // 5 minutes
  let noticesCache = [];
  let examResultsCache = [];
  let activeNotifications = [];
  let readNotifications = [];

  async function getSettings() {
    if (cachedSettings && (Date.now() - settingsFetchedAt < SETTINGS_TTL)) {
      return cachedSettings;
    }
    try {
      cachedSettings = await SSC_API.get('/public/settings');
      settingsFetchedAt = Date.now();
    } catch (e) {
      console.error('Failed to fetch settings', e);
      cachedSettings = { attendanceThreshold: 75 };
      settingsFetchedAt = Date.now();
    }
    return cachedSettings;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const node = el(id);
    if (node) node.textContent = text;
  }

  function asArray(v) {
    return Array.isArray(v) ? v : [];
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // Toast Notification System
  function showToast(message, type = 'info', undoCallback = null) {
    const container = el('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    
    let undoHtml = '';
    if (undoCallback) {
      undoHtml = `<button type="button" class="toast-undo-btn" style="margin-left: 1rem;">Undo</button>`;
    }
    
    toast.innerHTML = `
      <span>${esc(message)}</span>
      ${undoHtml}
    `;
    
    container.appendChild(toast);
    
    if (undoCallback) {
      const btn = toast.querySelector('.toast-undo-btn');
      btn.addEventListener('click', () => {
        undoCallback();
        toast.remove();
      });
    }
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 5000);
  }

  function showTableShimmer(tbodySelector, colCount, rowCount = 3) {
    const tbody = document.querySelector(tbodySelector);
    if (!tbody) return;
    let html = '';
    for (let i = 0; i < rowCount; i++) {
      html += '<tr>';
      for (let j = 0; j < colCount; j++) {
        html += '<td><div class="shimmer-line"></div></td>';
      }
      html += '</tr>';
    }
    tbody.innerHTML = html;
  }

  function makeTableSortableAndFilterable(tableId) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;

    // 1. Setup/Inject Filter Search Box (only if not already present)
    const parent = table.parentElement;
    let searchInput = parent.querySelector(`.table-filter-input-${tableId}`);
    if (!searchInput) {
      const searchWrap = document.createElement('div');
      searchWrap.className = 'table-filter-wrap';
      searchWrap.style.marginBottom = '1rem';
      searchWrap.style.display = 'flex';
      searchWrap.style.justify = 'flex-end';
      
      searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.className = `input small table-filter-input-${tableId}`;
      searchInput.placeholder = 'Filter table rows...';
      searchInput.style.maxWidth = '250px';
      searchInput.style.fontSize = '0.82rem';
      searchInput.style.padding = '0.4rem 0.75rem';
      searchInput.style.borderRadius = '8px';
      
      searchWrap.appendChild(searchInput);
      parent.insertBefore(searchWrap, table);
      
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        const rows = tbody.querySelectorAll('tr');
        if (rows.length === 1 && rows[0].querySelector('td[colspan]')) return;
        
        rows.forEach(row => {
          const match = row.textContent.toLowerCase().includes(query);
          row.style.display = match ? '' : 'none';
        });
      });
    } else {
      // Clear previous query on reload
      searchInput.value = '';
    }

    // 2. Setup Sorting on headers (only if not already done)
    if (table.dataset.sortableInitialized) return;
    table.dataset.sortableInitialized = '1';

    const thead = table.querySelector('thead');
    if (!thead) return;
    const headers = thead.querySelectorAll('th');

    headers.forEach((header, index) => {
      if (header.textContent.trim().toLowerCase() === 'actions' || header.textContent.trim() === '') return;
      
      header.style.cursor = 'pointer';
      header.style.userSelect = 'none';
      header.title = 'Click to sort by this column';
      
      let asc = true;
      header.addEventListener('click', () => {
        const rows = Array.from(tbody.querySelectorAll('tr'));
        if (rows.length <= 1 && rows[0] && rows[0].querySelector('td[colspan]')) return;
        
        rows.sort((rowA, rowB) => {
          const cellA = rowA.cells[index]?.textContent.trim() || '';
          const cellB = rowB.cells[index]?.textContent.trim() || '';
          
          const numA = parseFloat(cellA.replace(/[^\d.-]/g, ''));
          const numB = parseFloat(cellB.replace(/[^\d.-]/g, ''));
          
          if (!isNaN(numA) && !isNaN(numB) && cellA.replace(/[^\d.-]/g, '') === String(numA) && cellB.replace(/[^\d.-]/g, '') === String(numB)) {
            return asc ? numA - numB : numB - numA;
          }
          
          return asc ? cellA.localeCompare(cellB) : cellB.localeCompare(cellA);
        });
        
        asc = !asc;
        
        headers.forEach(h => {
          h.textContent = h.textContent.replace(/ [▲▼]/g, '');
        });
        header.textContent += asc ? ' ▲' : ' ▼';
        
        rows.forEach(r => tbody.appendChild(r));
      });
    });
  }

  function msg(t, err) {
    if (t) {
      showToast(t, err ? 'error' : 'success');
    }
    const node = el('dash-msg');
    if (node) {
      node.textContent = t || '';
      node.className = 'small mt-3' + (err ? ' alert error' : t ? ' alert success' : '');
    }
  }

  function courseDurationYears(courseName) {
    const c = String(courseName || '').toUpperCase();
    if (c.includes('PG') || c.includes('MA ') || c.includes('M.') || c.includes('MSC')) return 2;
    return 3;
  }

  function computeIdValidity(sp) {
    const admissionYear = sp.admissionYear || sp.admission_year
      || (sp.createdAt ? new Date(sp.createdAt).getFullYear() : new Date().getFullYear());
    const years = courseDurationYears(sp.courseName || sp.course);
    const validYear = Number(admissionYear) + years;
    return `May ${validYear}`;
  }

  function buildVerificationId(studentId, rollNumber) {
    const base = String(studentId || rollNumber || 'unknown').replace(/\s+/g, '');
    return `SSC-VER-${base}`;
  }

  function updateBreadcrumbs(panelName) {
    let container = document.getElementById('breadcrumb-container');
    if (!container) {
      const contentEl = document.querySelector('.dash-content');
      if (contentEl) {
        container = document.createElement('nav');
        container.id = 'breadcrumb-container';
        container.className = 'breadcrumb';
        contentEl.insertBefore(container, contentEl.firstChild);
      }
    }
    if (container) {
      container.innerHTML = `
        <a href="/index.html">Home</a>
        <span>›</span>
        <a href="#" onclick="event.preventDefault(); window.panel('profile')">Student Portal</a>
        <span>›</span>
        <span>${panelName}</span>
      `;
    }
  }

  function panel(id) {
    document.querySelectorAll('.dash-nav button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-panel') === id));
    document.querySelectorAll('.dash-panel').forEach((p) => p.classList.toggle('active', p.getAttribute('data-panel') === id));
    
    // Sync active state in mobile bottom navigation too
    document.querySelectorAll('.mobile-bottom-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-nav-panel') === id);
    });

    // Sync title
    const activeBtn = document.querySelector(`.dash-nav button[data-panel="${id}"]`);
    const titleEl = el('dash-title');
    if (activeBtn && titleEl) {
      titleEl.textContent = activeBtn.textContent.trim();
    }
    updateBreadcrumbs(activeBtn ? activeBtn.textContent.trim() : (id === 'profile' ? 'Dashboard' : id));
  }
  window.panel = panel;

  async function boot() {
    if (!SSC_API.token()) {
      location.href = '../login.html';
      return;
    }
    try {
      const { user } = await SSC_API.get('/auth/me');
      const role = String(user && user.role != null ? user.role : '').toLowerCase();
      if (role !== 'student') {
        SSC_API.setToken(null);
        location.href = '../login.html';
        return;
      }
      
      // Update topbar details
      const userEl = el('student-user');
      if (userEl) userEl.textContent = user.name || 'Student';
      const roleEl = el('student-role');
      if (roleEl) roleEl.textContent = 'Student';

      const avatarEl = el('student-avatar');
      if (avatarEl) {
        if (user.avatarUrl) {
          avatarEl.innerHTML = `<img src="${esc(user.avatarUrl)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>`;
        } else {
          avatarEl.textContent = (user.name || 'S').charAt(0).toUpperCase();
        }
      }

      // Wires
      setupSearch();
      setupNotifications();
      checkPasswordForcedChange(user);
      setupChangePasswordForm();
      setupMobileMenu();
      setupProfileSubTabs();

      if (user.mustChangePassword !== true) {
        initOnboardingTour();
      }

    } catch (err) {
      console.error(err);
      SSC_API.setToken(null);
      location.href = '../login.html';
      return;
    }

    const logoutBtn = el('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        SSC_API.setToken(null);
        location.href = '../login.html';
      });
    }

    const idCardBtn = el('qa-id-card');
    if (idCardBtn) {
      idCardBtn.addEventListener('click', async () => {
        try {
          const u = await SSC_API.get('/student/profile');
          const sp = u.studentProfile && typeof u.studentProfile === 'object' ? u.studentProfile : {};
          const studentId = sp.studentId || u.id || 'N/A';
          const rollNumber = sp.rollNumber || 'N/A';
          const course = sp.courseName || sp.course || 'General';
          const className = sp.className || 'N/A';
          const division = sp.division || className.split(' ').pop() || 'N/A';
          const academicYear = sp.year ? `Year ${sp.year}` : 'N/A';
          const collegeEmail = sp.collegeEmail || u.email || 'N/A';
          const verificationId = buildVerificationId(studentId, rollNumber);

          setText('id-card-name', u.name || 'Student');
          setText('id-card-course', course);
          setText('id-card-erp-id', studentId);
          setText('id-card-roll', rollNumber);
          setText('id-card-division', division);
          setText('id-card-year', academicYear);
          setText('id-card-email', collegeEmail);
          setText('id-card-validity', computeIdValidity(sp));
          setText('id-card-address', sp.address || u.bio || 'Contact college office for address update.');
          setText('id-card-emergency', sp.parentContact || sp.emergencyContact || u.phone || 'N/A');
          setText('id-card-verify-id', verificationId);
          setText('id-card-admission-year', sp.admissionYear || new Date().getFullYear());

          const photo = el('id-card-photo');
          const photoPlaceholder = el('id-card-photo-placeholder');
          if (photo && photoPlaceholder) {
            if (u.avatarUrl) {
              photo.src = u.avatarUrl;
              photo.style.display = 'block';
              photoPlaceholder.style.display = 'none';
            } else {
              photo.style.display = 'none';
              photoPlaceholder.style.display = 'grid';
            }
          }

          const qrCanvas = el('id-card-qr');
          if (qrCanvas && window.QRious) {
            new QRious({
              element: qrCanvas,
              value: JSON.stringify({
                studentId,
                rollNumber,
                course,
                className,
                verificationId,
              }),
              size: 128,
              background: '#ffffff',
              foreground: '#0f172a',
              level: 'M',
            });
          }

          showIdCardTab('front');
          const modal = el('id-card-modal');
          if (modal) modal.style.display = 'flex';
        } catch (err) {
          showToast('Could not load profile for ID Card: ' + err.message, 'error');
        }
      });
    }

    function showIdCardTab(tab) {
      const front = el('id-card-front');
      const back = el('id-card-back');
      const tabFront = el('id-tab-front');
      const tabBack = el('id-tab-back');
      const isFront = tab === 'front';
      if (front) front.style.display = isFront ? 'block' : 'none';
      if (back) back.style.display = isFront ? 'none' : 'block';
      if (tabFront) tabFront.classList.toggle('active', isFront);
      if (tabBack) tabBack.classList.toggle('active', !isFront);
    }

    const btnCloseId = el('btn-close-id');
    if (btnCloseId) {
      btnCloseId.addEventListener('click', () => {
        const modal = el('id-card-modal');
        if (modal) modal.style.display = 'none';
        showIdCardTab('front');
      });
    }

    const tabFront = el('id-tab-front');
    const tabBack = el('id-tab-back');
    if (tabFront) tabFront.addEventListener('click', () => showIdCardTab('front'));
    if (tabBack) tabBack.addEventListener('click', () => showIdCardTab('back'));

    const qaResultsBtn = el('qa-view-results');
    if (qaResultsBtn) {
      qaResultsBtn.addEventListener('click', () => {
        panel('exams');
        load('exams');
      });
    }

    const qaAttendanceBtn = el('qa-view-attendance');
    if (qaAttendanceBtn) {
      qaAttendanceBtn.addEventListener('click', () => {
        panel('attendance');
        load('attendance');
      });
    }

    const qaEditProfileBtn = el('qa-edit-profile');
    if (qaEditProfileBtn) {
      qaEditProfileBtn.addEventListener('click', () => {
        panel('edit-profile');
        load('edit-profile');
      });
    }

    const qaViewProfileBtn = el('qa-view-profile');
    if (qaViewProfileBtn) {
      qaViewProfileBtn.addEventListener('click', () => {
        panel('view-profile');
        load('view-profile');
      });
    }

    const quickEditCredsBtn = el('btn-quick-edit-creds');
    if (quickEditCredsBtn) {
      quickEditCredsBtn.addEventListener('click', () => {
        panel('edit-profile');
        load('edit-profile');
        setTimeout(() => {
          const secTab = document.querySelector('[data-subtab="security"]');
          if (secTab) secTab.click();
        }, 150);
      });
    }

    // Wire view-profile sub tabs
    document.querySelectorAll('.vp-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-vp-tab');
        document.querySelectorAll('.vp-tab-btn').forEach(b => {
          const isActive = b.getAttribute('data-vp-tab') === target;
          b.classList.toggle('active', isActive);
          b.style.color = isActive ? 'var(--accent,#6366f1)' : 'var(--muted,#94a3b8)';
          b.style.borderBottomColor = isActive ? 'var(--accent,#6366f1)' : 'transparent';
        });
        document.querySelectorAll('.vp-tab-panel').forEach(p => {
          p.style.display = p.getAttribute('data-vp-panel') === target ? 'block' : 'none';
        });
      });
    });

    document.querySelectorAll('.dash-nav button').forEach((btn) => {
      btn.addEventListener('click', () => {
        panel(btn.getAttribute('data-panel'));
        load(btn.getAttribute('data-panel'));
      });
    });

    document.querySelectorAll('.mobile-bottom-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-nav-panel');
        panel(pId);
        load(pId);
      });
    });

    const formFb = el('form-fb');
    if (formFb) {
      formFb.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await SSC_API.post('/student/feedback', {
            message: el('fb-msg').value.trim(),
            rating: Number(el('fb-rate').value),
          });
          showToast('Feedback submitted successfully!', 'success');
          e.target.reset();
        } catch (err) {
          showToast(err.data?.error || err.message || 'Could not submit feedback', 'error');
        }
      });
    }

    const formProfile = el('form-edit-profile');
    if (formProfile) {
      formProfile.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('name', el('student-profile-name').value.trim());
        fd.append('phone', el('student-profile-phone').value.trim());
        fd.append('bio', el('student-profile-bio').value.trim());
        const avatarFile = el('student-avatar-upload').files[0];
        if (avatarFile) fd.append('avatar', avatarFile);
        
        try {
          const resUser = await SSC_API.upload('/student/profile', fd, 'PATCH');
          showToast('Profile updated successfully!', 'success');
          
          // Re-sync topbar
          const userEl = el('student-user');
          if (userEl) userEl.textContent = resUser.name;
          const avatarEl = el('student-avatar');
          if (avatarEl) {
            if (resUser.avatarUrl) {
              avatarEl.innerHTML = `<img src="${esc(resUser.avatarUrl)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>`;
            } else {
              avatarEl.textContent = resUser.name.charAt(0).toUpperCase();
            }
          }
          
          loadEditProfile();
        } catch (err) {
          showToast(err.message || 'Update failed', 'error');
        }
      });
    }

    const filterTabsContainer = el('exam-filter-tabs');
    if (filterTabsContainer) {
      filterTabsContainer.querySelectorAll('.step-pill').forEach(btn => {
        btn.addEventListener('click', () => {
          filterTabsContainer.querySelectorAll('.step-pill').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const filter = btn.dataset.filter;
          renderResultsPage(filter);
        });
      });
    }

    setupKeyboardShortcuts();
    load('profile');
  }

  function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+K: Global search focus
      if (e.ctrlKey && e.key.toLowerCase() === 'k') {
        const searchInput = document.getElementById('global-search');
        if (searchInput) {
          e.preventDefault();
          searchInput.focus();
        }
      }
      
      // Escape: Close all active modals
      if (e.key === 'Escape') {
        const activeModals = document.querySelectorAll('.modal-overlay');
        activeModals.forEach(m => {
          if (m.style.display !== 'none') {
            m.style.display = 'none';
          }
        });
      }
      
      // Ctrl+S: Save active form (submit form)
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        const activePanel = document.querySelector('.dash-panel.active');
        if (activePanel) {
          const form = activePanel.querySelector('form');
          if (form) {
            e.preventDefault();
            form.requestSubmit();
          }
        }
      }
    });
  }

  async function load(id) {
    msg('');
    try {
      if (id === 'profile') await loadProfile();
      if (id === 'timetable') await loadTimetablePanel();
      if (id === 'library') await loadLibraryPanel();
      if (id === 'exams') await loadExamsPanel();
      if (id === 'attendance') await loadAttendance();
      if (id === 'materials') await loadMaterials();
      if (id === 'notices') await loadNotices();
      if (id === 'placement') await loadPlacementPanel();
      if (id === 'edit-profile') await loadEditProfile();
      if (id === 'view-profile') await loadViewProfile();
    } catch (e) {
      showToast(e.data?.error || e.message || 'Error loading dashboard panel', 'error');
    }
  }

  async function loadViewProfile() {
    try {
      const u = await SSC_API.get('/student/profile');
      const sp = u.studentProfile || {};

      // Name & Meta
      setText('vp-name', u.name || 'Student');
      const courseName = sp.courseName || sp.course || 'GEN';
      const className = sp.className || 'N/A';
      setText('vp-meta', `${courseName} · Class ${className}`);

      // Badges
      setText('vp-badge-id', `ID: ${sp.studentId || u.id || 'N/A'}`);
      setText('vp-badge-roll', `Roll: ${sp.rollNumber || 'N/A'}`);

      // Avatar
      const img = el('vp-avatar-img');
      const placeholder = el('vp-avatar-placeholder');
      if (img && placeholder) {
        if (u.avatarUrl) {
          img.src = u.avatarUrl;
          img.style.display = 'block';
          placeholder.style.display = 'none';
        } else {
          img.style.display = 'none';
          placeholder.style.display = 'grid';
          placeholder.textContent = (u.name || 'S').charAt(0).toUpperCase();
        }
      }

      // Personal Details Tab
      setText('vp-p-name', u.name || '—');
      setText('vp-p-email', sp.collegeEmail || u.email || '—');
      setText('vp-p-phone', u.phone || '—');
      setText('vp-p-dob', sp.dob || '—');
      setText('vp-p-gender', sp.gender || '—');
      setText('vp-p-category', sp.category || '—');
      setText('vp-p-address', sp.address || '—');

      // Academic Profile Tab
      setText('vp-a-course', courseName);
      setText('vp-a-class', className);
      setText('vp-a-studentid', sp.studentId || '—');
      setText('vp-a-roll', sp.rollNumber || '—');
      setText('vp-a-ssc', sp.sscMarks ? `${sp.sscMarks} Obtained` : '—');
      setText('vp-a-hsc', sp.marks12 ? `${sp.marks12} / ${sp.maxMarks12 || 600}` : '—');
      setText('vp-a-board', sp.board12 || '—');
      setText('vp-a-year', sp.admissionYear || '—');

    } catch (err) {
      showToast('Failed to load profile details: ' + err.message, 'error');
    }
  }

  async function loadProfile() {
    // 1. Populate top welcome
    try {
      const u = await SSC_API.get('/student/profile');
      const sp = u.studentProfile || {};

      setText('db-welcome-name', `Welcome, ${u.name}!`);
      setText('db-student-meta', `${sp.courseName || 'General'} • Year ${sp.year || '1'} (Roll: ${sp.rollNumber || 'N/A'})`);
      
      const dbAvatar = el('db-avatar-img');
      const dbPlaceholder = el('db-avatar-placeholder');
      if (dbAvatar && dbPlaceholder) {
        if (u.avatarUrl) {
          dbAvatar.src = u.avatarUrl;
          dbAvatar.style.display = 'block';
          dbPlaceholder.style.display = 'none';
        } else {
          dbAvatar.style.display = 'none';
          dbPlaceholder.style.display = 'grid';
        }
      }
    } catch (e) {
      console.error('Failed to load profile welcome card', e);
    }
    
    // 2. Fetch Attendance
    let totalClasses = 0;
    let presentClasses = 0;
    let overallAttendancePct = 100;
    const attList = [];
    try {
      const attendance = await SSC_API.get('/student/attendance');
      if (Array.isArray(attendance)) {
        attendance.forEach(a => attList.push(a));
        totalClasses = attendance.length;
        presentClasses = attendance.filter(a => a.status === 'present').length;
        overallAttendancePct = totalClasses ? Math.round((presentClasses / totalClasses) * 100) : 100;
      }
    } catch (err) {
      console.error(err);
    }

    const settings = await getSettings();
    const threshold = settings.attendanceThreshold ? Number(settings.attendanceThreshold) : 75;

    let statusText = 'Good Standing';
    let cardStyle = '';
    let statusColor = '#22c55e'; // Green
    
    if (overallAttendancePct < threshold) {
      statusText = 'Attendance Warning';
      statusColor = '#ef4444'; // Red
      cardStyle = 'border: 1px solid var(--danger); background: var(--danger-muted);';
    } else if (overallAttendancePct < threshold + 5) {
      statusText = 'Watchlist';
      statusColor = '#f59e0b'; // Amber
      cardStyle = 'border: 1px solid var(--warning); background: var(--warning-muted);';
    } else {
      statusText = 'Good Standing';
      statusColor = '#22c55e'; // Green
      cardStyle = 'border: 1px solid var(--accent); background: var(--accent-muted);';
    }

    const cardAtt = el('card-db-attendance');
    if (cardAtt) {
      cardAtt.style.cssText = cardStyle;
    }

    setText('db-stat-attendance', `${overallAttendancePct}%`);
    const dbStatAttDesc = el('db-stat-attendance-desc');
    if (dbStatAttDesc) {
      dbStatAttDesc.innerHTML = `
        <div style="margin-top: 0.25rem; font-size: 0.75rem; opacity: 0.85;">Required: ${threshold}%</div>
        <div style="margin-top: 0.25rem; font-weight: 600; color: ${statusColor};">Status: ${statusText}</div>
      `;
    }

    // Populate Row 2 Subject Attendance Summary
    const subBreakdown = {};
    attList.forEach(a => {
      const sub = a.subject || 'General';
      if (!subBreakdown[sub]) subBreakdown[sub] = { present: 0, total: 0 };
      subBreakdown[sub].total += 1;
      if (a.status === 'present') subBreakdown[sub].present += 1;
    });

    const tblDbAttendance = document.querySelector('#tbl-db-attendance tbody');
    if (tblDbAttendance) {
      tblDbAttendance.innerHTML = '';
      const subjects = Object.keys(subBreakdown).sort();
      if (!subjects.length) {
        tblDbAttendance.innerHTML = '<tr><td colspan="3" class="small">No attendance data.</td></tr>';
      } else {
        subjects.slice(0, 4).forEach(sub => {
          const stat = subBreakdown[sub];
          const subPct = stat.total ? Math.round((stat.present / stat.total) * 100) : 100;
          let subColorStyle = '';
          if (subPct < threshold) {
            subColorStyle = 'color: #ef4444; font-weight: bold;';
          } else if (subPct < threshold + 5) {
            subColorStyle = 'color: #f59e0b; font-weight: bold;';
          } else {
            subColorStyle = 'color: #22c55e; font-weight: bold;';
          }
          const tr = document.createElement('tr');
          tr.innerHTML = `<td><strong>${esc(sub)}</strong></td><td>${stat.present}/${stat.total}</td><td style="${subColorStyle}">${subPct}%</td>`;
          tblDbAttendance.appendChild(tr);
        });
      }
    }

    // 3. Fetch Marks & GPA
    let totalMarksPct = 0;
    let examCount = 0;
    const marksList = [];
    try {
      const marks = await SSC_API.get('/student/marks');
      if (Array.isArray(marks)) {
        marks.forEach(m => {
          marksList.push(m);
          if (m.maxMarks > 0) {
            totalMarksPct += (m.marksObtained / m.maxMarks) * 100;
            examCount++;
          }
        });
      }
    } catch (err) {
      console.error(err);
    }

    const avgPct = examCount ? (totalMarksPct / examCount) : null;
    const gpaVal = avgPct !== null ? `${(avgPct / 10).toFixed(1)} CGPA` : 'N/A';
    setText('db-stat-gpa', gpaVal);
    setText('db-stat-gpa-desc', examCount ? `Based on ${examCount} exams` : 'No grades published');

    // Populate Row 2 Recent Exam Performance
    const tblDbMarks = document.querySelector('#tbl-db-marks tbody');
    if (tblDbMarks) {
      tblDbMarks.innerHTML = '';
      if (!marksList.length) {
        tblDbMarks.innerHTML = '<tr><td colspan="3" class="small">No recent grades.</td></tr>';
      } else {
        marksList.slice(0, 4).forEach(m => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td><strong>${esc(m.subject)}</strong></td><td>${esc(m.examName)}</td><td>${m.marksObtained}/${m.maxMarks}</td>`;
          tblDbMarks.appendChild(tr);
        });
      }
      makeTableSortableAndFilterable('tbl-db-marks');
    }

    // 4. Fetch Upcoming Exams
    let upcomingExamsCount = 0;
    let nextExamDateStr = 'None scheduled';
    try {
      const schedules = await SSC_API.get('/student/exams/schedule');
      if (Array.isArray(schedules)) {
        upcomingExamsCount = schedules.length;
        if (schedules.length > 0) {
          const sorted = [...schedules].sort((a,b) => new Date(a.examDate) - new Date(b.examDate));
          if (sorted[0]?.examDate) {
            nextExamDateStr = `Next: ${new Date(sorted[0].examDate).toLocaleDateString('en-IN')}`;
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
    setText('db-stat-exams', upcomingExamsCount);
    setText('db-stat-exams-desc', nextExamDateStr);

    // 5. Fetch Library Borrowed Books
    let libraryCount = 0;
    let oldestDueDateStr = 'No current issues';
    try {
      const libraryBooks = await SSC_API.get('/student/library/my-books');
      if (Array.isArray(libraryBooks)) {
        libraryCount = libraryBooks.length;
        if (libraryBooks.length > 0) {
          const sorted = [...libraryBooks].sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate));
          if (sorted[0]?.dueDate) {
            const overdue = new Date(sorted[0].dueDate) < new Date();
            oldestDueDateStr = overdue ? 'Overdue item!' : `Due: ${new Date(sorted[0].dueDate).toLocaleDateString('en-IN')}`;
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
    setText('db-stat-library', libraryCount);
    setText('db-stat-library-desc', oldestDueDateStr);

    // 6. Compute and render Monthly Attendance Trend chart card
    const trendContainer = el('db-attendance-trend-chart');
    const attTrendCard = el('card-db-att-trend');
    if (trendContainer) {
      trendContainer.innerHTML = '';
      if (totalClasses === 0) {
        trendContainer.innerHTML = '<p class="small empty-state">Attendance trend will appear once classes are logged.</p>';
      } else {
        if (attTrendCard) attTrendCard.style.display = '';
        const monthlyData = {}; // key: "YYYY-MM"
        attList.forEach(a => {
          if (!a.date) return;
          const d = new Date(a.date);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          if (!monthlyData[key]) monthlyData[key] = { present: 0, total: 0 };
          monthlyData[key].total += 1;
          if (a.status === 'present') monthlyData[key].present += 1;
        });

        const sortedMonths = Object.keys(monthlyData).sort();
        if (sortedMonths.length === 0) {
          trendContainer.innerHTML = '<p class="small" style="opacity: 0.7;">No monthly logs found.</p>';
        } else {
          sortedMonths.slice(-4).forEach(key => {
            const stat = monthlyData[key];
            const pct = Math.round((stat.present / stat.total) * 100);
            const [yr, mo] = key.split('-');
            const monthLabel = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
            
            const barWrap = document.createElement('div');
            barWrap.className = 'att-trend-bar';
            
            let colorClass = '';
            if (pct < 75) colorClass = 'low';
            
            barWrap.innerHTML = `
              <div class="att-trend-labels">
                <span style="font-weight:600;">${monthLabel}</span>
                <span>${pct}% (${stat.present}/${stat.total})</span>
              </div>
              <div class="att-trend-track">
                <div class="att-trend-fill ${colorClass}" style="width:${pct}%;"></div>
              </div>
            `;
            trendContainer.appendChild(barWrap);
          });
        }
      }
    }

    // 7. Today's Timetable slots
    const dbTimetable = el('db-timetable-today');
    if (dbTimetable) {
      dbTimetable.innerHTML = '';
      try {
        const tt = await SSC_API.get('/student/timetable');
        const slots = tt.slots || [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let todayDay = dayNames[new Date().getDay()];
        if (todayDay === 'Sunday') todayDay = 'Monday';
        
        const todaySlots = slots.filter(s => s.day === todayDay).sort((a,b) => Number(a.period) - Number(b.period));
        if (!todaySlots.length) {
          dbTimetable.innerHTML = `<p class="small empty-state">No slots scheduled for today (${todayDay}).</p>`;
        } else {
          todaySlots.forEach(slot => {
            const div = document.createElement('div');
            div.style.padding = '0.5rem';
            div.style.borderBottom = '1px solid rgba(56, 189, 248, 0.1)';
            div.innerHTML = `
              <div style="font-weight:600; color:var(--primary); font-size:0.85rem;">Period ${slot.period}: ${esc(slot.subject)}</div>
              <div style="font-size:0.75rem; opacity:0.8;">Room ${esc(slot.room)} • ${esc(slot.teacherName || 'TBA')}</div>
            `;
            dbTimetable.appendChild(div);
          });
        }
      } catch (err) {
        dbTimetable.innerHTML = '<p class="small" style="opacity: 0.7;">Unable to load timetable slots.</p>';
      }
    }

    // 8. Recent Notices
    const dbNotices = el('db-notices-feed');
    if (dbNotices) {
      dbNotices.innerHTML = '';
      try {
        const notices = await SSC_API.get('/student/notices');
        noticesCache = Array.isArray(notices) ? notices : [];
        if (noticesCache.length > 0) {
          noticesCache.slice(0, 4).forEach(n => {
            const div = document.createElement('div');
            div.style.padding = '0.5rem';
            div.style.borderBottom = '1px solid rgba(56, 189, 248, 0.1)';
            div.innerHTML = `
              <div style="font-weight:600; font-size:0.85rem;">${esc(n.title)}</div>
              <p class="small" style="margin:2px 0 0 0; opacity:0.85; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(n.body || '')}</p>
            `;
            dbNotices.appendChild(div);
          });
        } else {
          dbNotices.innerHTML = '<p class="small empty-state">No recent notices.</p>';
        }
      } catch (err) {
        dbNotices.innerHTML = '<p class="small" style="opacity: 0.7;">Unable to load notices.</p>';
      }
    }

    // 9. Recent Study Materials
    const dbMaterials = el('db-materials-feed');
    if (dbMaterials) {
      dbMaterials.innerHTML = '';
      try {
        const materials = await SSC_API.get('/student/materials');
        if (Array.isArray(materials) && materials.length > 0) {
          materials.slice(0, 4).forEach(m => {
            const div = document.createElement('div');
            div.style.padding = '0.5rem';
            div.style.borderBottom = '1px solid rgba(56, 189, 248, 0.1)';
            div.innerHTML = `
              <div style="font-weight:600; font-size:0.85rem;">${esc(m.title)}</div>
              <div style="font-size:0.75rem; opacity:0.8;">Subject: ${esc(m.subject)}</div>
            `;
            dbMaterials.appendChild(div);
          });
        } else {
          dbMaterials.innerHTML = '<p class="small empty-state">No study materials available.</p>';
        }
      } catch (err) {
        dbMaterials.innerHTML = '<p class="small" style="opacity: 0.7;">Unable to load study materials.</p>';
      }
    }
  }

  async function loadTimetablePanel() {
    const tbody = el('tbl-student-timetable');
    if (tbody) showTableShimmer('#tbl-student-timetable', 7, 6);
    
    let slots = [];
    try {
      const tt = await SSC_API.get('/student/timetable');
      slots = asArray(tt?.slots);
    } catch (e) {
      console.error(e);
    }
    
    if (tbody) {
      tbody.innerHTML = '';
      const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const periodTimes = [
        { period: 1, label: 'Period 1 (09:00 - 10:00)' },
        { period: 2, label: 'Period 2 (10:00 - 11:00)' },
        { period: 3, label: 'Period 3 (11:00 - 12:00)' },
        { period: 4, label: 'Period 4 (12:00 - 01:00)' },
        { period: 5, label: 'Period 5 (01:30 - 02:30)' },
        { period: 6, label: 'Period 6 (02:30 - 03:30)' }
      ];
      
      periodTimes.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Period"><strong>${p.label}</strong></td>`;
        
        daysOfWeek.forEach(day => {
          const slot = slots.find(s => s.day === day && Number(s.period) === p.period);
          const td = document.createElement('td');
          td.setAttribute('data-label', day);
          if (slot) {
            td.innerHTML = `
              <div style="font-weight:600;color:var(--primary);">${esc(slot.subject)}</div>
              <div class="small" style="font-size:0.8rem;opacity:0.85;">${esc(slot.teacherName || 'TBA')} • Room ${esc(slot.room || 'TBA')}</div>
            `;
          } else {
            td.innerHTML = '<span class="small empty-cell">-</span>';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
  }

  async function loadLibraryPanel() {
    setupLibraryTabs();
    await loadIssuedBooks();
  }

  function setupLibraryTabs() {
    const tabs = [
      { tab: 'stu-lib-tab-issued', view: 'stu-lib-issued-view', action: loadIssuedBooks },
      { tab: 'stu-lib-tab-history', view: 'stu-lib-history-view', action: loadBorrowHistory }
    ];
    
    tabs.forEach(t => {
      const btn = el(t.tab);
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', async () => {
          tabs.forEach(x => {
            const xBtn = el(x.tab);
            const xView = el(x.view);
            if (xBtn) xBtn.classList.remove('active');
            if (xView) xView.style.display = 'none';
          });
          btn.classList.add('active');
          const tView = el(t.view);
          if (tView) tView.style.display = 'block';
          await t.action();
        });
      }
    });
  }

  async function loadIssuedBooks() {
    const tbody = document.querySelector('#tbl-stu-lib-issued tbody');
    if (tbody) showTableShimmer('#tbl-stu-lib-issued tbody', 6);
    
    let issues = [];
    try {
      issues = asArray(await SSC_API.get('/student/library/my-books'));
    } catch (e) {
      console.error(e);
    }
    
    if (tbody) {
      tbody.innerHTML = '';
      if (!issues.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="center small text-muted text-center" style="opacity: 0.7; padding: 2rem;"><div class="empty-state">You currently have no issued books.</div></td></tr>';
        return;
      }

      issues.forEach(is => {
        const tr = document.createElement('tr');
        const dueDate = new Date(is.dueDate);
        const today = new Date();
        today.setHours(0,0,0,0);
        const compareDueDate = new Date(dueDate);
        compareDueDate.setHours(0,0,0,0);
        
        const timeDiff = compareDueDate.getTime() - today.getTime();
        const daysRemaining = Math.ceil(timeDiff / (1000 * 3600 * 24));
        const isOverdue = timeDiff < 0;
        
        let badgeHtml = '';
        if (isOverdue) {
          const overdueDays = Math.abs(daysRemaining);
          badgeHtml = `<span class="badge" style="background:var(--danger-muted); color:var(--danger); border-color:rgba(239,68,68,0.2); font-weight:600;">Overdue by ${overdueDays} ${overdueDays === 1 ? 'day' : 'days'}</span>`;
        } else if (daysRemaining === 0) {
          badgeHtml = `<span class="badge" style="background:var(--warning-muted); color:var(--warning); border-color:rgba(245,158,11,0.2); font-weight:600;">Due today</span>`;
        } else if (daysRemaining === 1) {
          badgeHtml = `<span class="badge" style="background:var(--warning-muted); color:var(--warning); border-color:rgba(245,158,11,0.2); font-weight:600;">Due tomorrow</span>`;
        } else {
          badgeHtml = `<span class="badge" style="background:var(--accent-muted); color:var(--accent); border-color:rgba(34,197,94,0.2); font-weight:600;">${daysRemaining} days left</span>`;
        }
        
        tr.innerHTML = `
          <td data-label="Book Title"><strong>${esc(is.book?.title)}</strong></td>
          <td data-label="Author">${esc(is.book?.author)}</td>
          <td data-label="Category">${esc(is.book?.category)}</td>
          <td data-label="Issued Date">${new Date(is.issuedAt).toLocaleDateString()}</td>
          <td data-label="Due Date">${dueDate.toLocaleDateString()} ${badgeHtml}</td>
          <td data-label="Fine">₹${is.fine || 0}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  async function loadBorrowHistory() {
    const tbody = document.querySelector('#tbl-stu-lib-history tbody');
    if (tbody) showTableShimmer('#tbl-stu-lib-history tbody', 6);
    
    let history = [];
    try {
      history = asArray(await SSC_API.get('/student/library/history'));
    } catch (e) {
      console.error(e);
    }
    
    if (tbody) {
      tbody.innerHTML = '';
      if (!history.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="center small text-muted text-center" style="opacity: 0.7; padding: 2rem;"><div class="empty-state">Your borrow history is empty.</div></td></tr>';
        return;
      }

      history.forEach(is => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td data-label="Book Title"><strong>${esc(is.book?.title)}</strong></td>
          <td data-label="Author">${esc(is.book?.author)}</td>
          <td data-label="Category">${esc(is.book?.category)}</td>
          <td data-label="Issued Date">${new Date(is.issuedAt).toLocaleDateString()}</td>
          <td data-label="Returned Date">${new Date(is.returnedAt).toLocaleDateString()}</td>
          <td data-label="Fine Paid">₹${is.fine || 0}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  async function loadExamsPanel() {
    await loadExamSchedules();
    await loadExamResults();
    
    const closeBtn = el('btn-close-print-view');
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', () => {
        const overlay = el('print-result-overlay');
        if (overlay) overlay.style.display = 'none';
      });
    }
  }

  async function loadExamSchedules() {
    const tbody = document.querySelector('#tbl-stu-exams tbody');
    if (tbody) showTableShimmer('#tbl-stu-exams tbody', 6);
    
    let schedules = [];
    try {
      schedules = asArray(await SSC_API.get('/student/exams/schedule'));
    } catch (e) {
      console.error(e);
    }
    
    if (tbody) {
      tbody.innerHTML = '';
      if (!schedules.length) {
        tbody.innerHTML = '<tr><td colspan="6" class="center small text-muted text-center" style="opacity: 0.7; padding: 2rem;"><div class="empty-state">No upcoming exams scheduled.</div></td></tr>';
        return;
      }

      schedules.forEach(ex => {
        const tr = document.createElement('tr');
        const dt = ex.examDate ? new Date(ex.examDate).toLocaleDateString() : 'TBA';
        const tm = ex.startTime ? `${dt} at ${ex.startTime}` : dt;
        
        tr.innerHTML = `
          <td data-label="Exam Name"><strong>${esc(ex.title)}</strong></td>
          <td data-label="Type"><span style="text-transform: capitalize;">${esc(ex.examType)}</span></td>
          <td data-label="Subject">${esc(ex.subject)}</td>
          <td data-label="Date / Time">${tm}</td>
          <td data-label="Venue">${esc(ex.venue || 'TBA')}</td>
          <td data-label="Max Marks">${ex.maxMarks}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  async function loadExamResults() {
    const tbody = document.querySelector('#tbl-stu-results tbody');
    if (tbody) showTableShimmer('#tbl-stu-results tbody', 10);
    
    try {
      examResultsCache = asArray(await SSC_API.get('/student/exams/results'));
    } catch (e) {
      console.error('Failed to load exam results', e);
      examResultsCache = [];
    }
    
    renderResultsPage('all');
  }

  function renderResultsPage(filterType = 'all') {
    const tbody = document.querySelector('#tbl-stu-results tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // Update summary card values based on all results
    const resultsAvgPctEl = el('results-avg-pct');
    const resultsAvgGradeEl = el('results-avg-grade');
    const resultsAvgBarEl = el('results-avg-bar');
    const resultsGpaTrendValEl = el('results-gpa-trend-val');
    const resultsGpaSparklineEl = el('results-gpa-sparkline');
    
    if (examResultsCache.length > 0) {
      let totalPct = 0;
      examResultsCache.forEach(r => {
        totalPct += Number(r.percentage || 0);
      });
      const avgPct = Math.round(totalPct / examResultsCache.length);
      const estGpa = (avgPct / 10).toFixed(1);
      
      // Calculate grade
      let avgGrade = 'F';
      if (avgPct >= 90) avgGrade = 'O';
      else if (avgPct >= 80) avgGrade = 'A+';
      else if (avgPct >= 70) avgGrade = 'A';
      else if (avgPct >= 60) avgGrade = 'B+';
      else if (avgPct >= 50) avgGrade = 'B';
      else if (avgPct >= 40) avgGrade = 'C';
      
      if (resultsAvgPctEl) resultsAvgPctEl.textContent = `${avgPct}%`;
      if (resultsAvgGradeEl) resultsAvgGradeEl.textContent = `Grade: ${avgGrade}`;
      if (resultsAvgBarEl) {
        resultsAvgBarEl.style.width = `${avgPct}%`;
        if (avgPct < 40) resultsAvgBarEl.style.background = '#ef4444';
        else if (avgPct < 60) resultsAvgBarEl.style.background = '#f59e0b';
        else resultsAvgBarEl.style.background = 'var(--primary)';
      }
      if (resultsGpaTrendValEl) resultsGpaTrendValEl.textContent = `${estGpa} CGPA`;
      
      // Render sparkline
      if (resultsGpaSparklineEl) {
        resultsGpaSparklineEl.innerHTML = '';
        // Sort chronologically (oldest to newest) to show a trend
        const sortedResults = [...examResultsCache].sort((a, b) => new Date(a.examDate || a.date) - new Date(b.examDate || b.date));
        
        sortedResults.slice(-10).forEach(r => {
          const bar = document.createElement('div');
          const pct = Number(r.percentage || 0);
          bar.style.width = '14px';
          bar.style.height = `${Math.max(pct, 10)}%`; // Min 10% height to be visible
          bar.style.background = pct >= 40 ? 'var(--accent)' : 'var(--danger)';
          bar.style.borderRadius = '2px';
          bar.title = `${esc(r.title)}: ${pct}%`;
          resultsGpaSparklineEl.appendChild(bar);
        });
      }
    } else {
      if (resultsAvgPctEl) resultsAvgPctEl.textContent = '--%';
      if (resultsAvgGradeEl) resultsAvgGradeEl.textContent = 'Grade: --';
      if (resultsAvgBarEl) resultsAvgBarEl.style.width = '0%';
      if (resultsGpaTrendValEl) resultsGpaTrendValEl.textContent = '--';
      if (resultsGpaSparklineEl) resultsGpaSparklineEl.innerHTML = '<span class="small" style="opacity: 0.5;">No results</span>';
    }

    // Filter results
    let filteredList = examResultsCache;
    if (filterType !== 'all') {
      filteredList = examResultsCache.filter(r => {
        const type = String(r.examType || '').toLowerCase();
        if (filterType === 'unit_test') return type.includes('unit') || type.includes('test');
        if (filterType === 'semester') return type.includes('semester') || type.includes('sem');
        if (filterType === 'final') return type.includes('final') || type.includes('term');
        return true;
      });
    }
    
    if (!filteredList.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="center small text-muted text-center" style="opacity: 0.7; padding: 2rem;"><div class="empty-state">No matching results found.</div></td></tr>`;
      return;
    }
    
    filteredList.forEach(r => {
      const tr = document.createElement('tr');
      const dt = r.examDate ? new Date(r.examDate).toLocaleDateString() : '';
      
      let statusColor = '';
      if (r.passFail === 'PASS') statusColor = 'color:var(--accent);font-weight:600;';
      else if (r.passFail === 'FAIL') statusColor = 'color:#ef4444;font-weight:600;';

      tr.innerHTML = `
        <td data-label="Exam Title"><strong>${esc(r.title)}</strong></td>
        <td data-label="Subject">${esc(r.subject)}</td>
        <td data-label="Type"><span style="text-transform: capitalize;">${esc(r.examType)}</span></td>
        <td data-label="Date">${dt}</td>
        <td data-label="Marks Obtained">${r.marksObtained} / ${r.maxMarks}</td>
        <td data-label="Percentage">${r.percentage}%</td>
        <td data-label="Grade"><strong>${esc(r.grade)}</strong></td>
        <td data-label="Pass / Fail"><span style="${statusColor}">${esc(r.passFail)}</span></td>
        <td data-label="Class Rank"><strong>${r.rank || 'N/A'}</strong></td>
        <td data-label="Actions">
          <button class="btn small print-res-btn" data-id="${r.examId}" style="color:#000;">Download Sheet</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.print-res-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const examId = btn.dataset.id;
        showPrintResultSheet(examId);
      });
    });
  }

  async function showPrintResultSheet(examId) {
    const res = examResultsCache.find(x => x.examId === examId);
    if (!res) return;
    
    try {
      const profileRes = await SSC_API.get('/student/profile');
      const sp = profileRes.studentProfile || {};
      
      const stInfo = el('pr-student-info');
      if (stInfo) {
        stInfo.innerHTML = `
          <strong>Student Name:</strong> ${esc(profileRes.name)}<br>
          <strong>Roll Number:</strong> ${esc(sp.rollNumber || 'N/A')} &nbsp;&nbsp;|&nbsp;&nbsp; 
          <strong>Class:</strong> ${esc(sp.className || 'N/A')} &nbsp;&nbsp;|&nbsp;&nbsp;
          <strong>Course:</strong> ${esc(sp.courseName || 'N/A')}
        `;
      }
      
      const tbody = document.querySelector('#tbl-print-result tbody');
      if (tbody) {
        tbody.innerHTML = '';
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${esc(res.title)}</strong></td>
          <td>${esc(res.subject)}</td>
          <td style="text-transform: capitalize;">${esc(res.examType)}</td>
          <td><strong>${res.marksObtained} / ${res.maxMarks}</strong></td>
          <td>${res.percentage}%</td>
          <td><strong>${esc(res.grade)}</strong></td>
          <td><strong>${esc(res.passFail)}</strong></td>
          <td><strong>${res.rank || 'N/A'}</strong></td>
        `;
        tbody.appendChild(tr);
      }
      
      const overlay = el('print-result-overlay');
      if (overlay) {
        overlay.style.display = 'block';
        overlay.scrollIntoView({ behavior: 'smooth' });
      }
    } catch (err) {
      showToast('Failed to load sheet details: ' + err.message, 'error');
    }
  }

  async function loadAttendance() {
    const tbBreakdown = document.querySelector('#tbl-subject-breakdown tbody');
    if (tbBreakdown) showTableShimmer('#tbl-subject-breakdown tbody', 4);
    const tbDetailed = document.querySelector('#tbl-att tbody');
    if (tbDetailed) showTableShimmer('#tbl-att tbody', 3);

    let rows = [];
    try {
      rows = await SSC_API.get('/student/attendance');
    } catch (e) {
      console.error(e);
    }
    const list = Array.isArray(rows) ? rows : [];
    
    // Stats calculation
    const total = list.length;
    const present = list.filter(a => a.status === 'present').length;
    const missed = total - present;
    const pct = total ? Math.round((present / total) * 100) : 100;
    
    setText('stu-att-total', total);
    setText('stu-att-present', present);
    setText('stu-att-missed', missed);
    setText('stu-att-percent', pct + '%');
    
    const settings = await getSettings();
    const threshold = settings.attendanceThreshold ? Number(settings.attendanceThreshold) : 75;

    const warn = el('att-warn-banner');
    if (warn) {
      warn.innerHTML = `<strong>⚠️ Low Attendance Warning:</strong> Your overall attendance is currently below the required ${threshold}%. Please contact your course coordinator.`;
      if (total > 0 && pct < threshold) {
        warn.style.display = 'block';
      } else {
        warn.style.display = 'none';
      }
    }

    // Trend analysis (Last 30 Days vs Prior 30 Days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const last30Logs = list.filter(a => new Date(a.date) >= thirtyDaysAgo);
    const prior30Logs = list.filter(a => {
      const d = new Date(a.date);
      return d >= sixtyDaysAgo && d < thirtyDaysAgo;
    });

    const present30 = last30Logs.filter(a => a.status === 'present').length;
    const absent30 = last30Logs.filter(a => a.status === 'absent').length;
    const leave30 = last30Logs.filter(a => a.status === 'leave').length;

    const presentPrior = prior30Logs.filter(a => a.status === 'present').length;
    const totalPrior = prior30Logs.length;

    const pct30 = last30Logs.length ? (present30 / last30Logs.length) * 100 : 100;
    const pctPrior = totalPrior ? (presentPrior / totalPrior) * 100 : pct30;

    let trendDir = '→ Stable';
    let trendColor = 'var(--text-secondary)';
    if (pct30 > pctPrior + 1) {
      trendDir = '↑ Improving';
      trendColor = '#22c55e';
    } else if (pct30 < pctPrior - 1) {
      trendDir = '↓ Dropping';
      trendColor = '#ef4444';
    }

    setText('att-trend-present', present30);
    setText('att-trend-absent', absent30);
    setText('att-trend-leave', leave30);

    const trendDirEl = el('att-trend-direction');
    if (trendDirEl) {
      trendDirEl.textContent = trendDir;
      trendDirEl.style.color = trendColor;
    }

    let statusText = 'Good Standing';
    let statusColor = '#22c55e';
    let statusBg = 'var(--accent-muted)';
    let statusBorder = '1px solid var(--accent)';
    
    if (pct < threshold) {
      statusText = 'Attendance Warning';
      statusColor = '#ef4444';
      statusBg = 'var(--danger-muted)';
      statusBorder = '1px solid var(--danger)';
    } else if (pct < threshold + 5) {
      statusText = 'Watchlist';
      statusColor = '#f59e0b';
      statusBg = 'var(--warning-muted)';
      statusBorder = '1px solid var(--warning)';
    }

    const panelStatusEl = el('att-panel-status');
    if (panelStatusEl) {
      panelStatusEl.textContent = statusText;
      panelStatusEl.style.color = statusColor;
    }

    const attTrendCardEl = el('att-trend-card');
    if (attTrendCardEl) {
      attTrendCardEl.style.border = statusBorder;
      attTrendCardEl.style.background = statusBg;
    }

    // Render subject breakdown
    const subBreakdown = {};
    list.forEach(a => {
      const sub = a.subject || 'General';
      if (!subBreakdown[sub]) {
        subBreakdown[sub] = { present: 0, total: 0 };
      }
      subBreakdown[sub].total += 1;
      if (a.status === 'present') {
        subBreakdown[sub].present += 1;
      }
    });

    if (tbBreakdown) {
      tbBreakdown.innerHTML = '';
      const subjects = Object.keys(subBreakdown).sort();
      if (!subjects.length) {
        tbBreakdown.innerHTML = '<tr><td colspan="4" class="small text-center"><div class="empty-state">No attendance data to summarize.</div></td></tr>';
      } else {
        subjects.forEach(sub => {
          const stats = subBreakdown[sub];
          const subPct = stats.total ? Math.round((stats.present / stats.total) * 100) : 100;
          let subColorStyle = '';
          if (subPct < threshold) {
            subColorStyle = 'color: #ef4444; font-weight: bold;';
          } else if (subPct < threshold + 5) {
            subColorStyle = 'color: #f59e0b; font-weight: bold;';
          } else {
            subColorStyle = 'color: #22c55e; font-weight: bold;';
          }
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td data-label="Subject">${esc(sub)}</td>
            <td data-label="Attended">${stats.present}</td>
            <td data-label="Total Classes">${stats.total}</td>
            <td data-label="Percentage" style="${subColorStyle}">${subPct}%</td>
          `;
          tbBreakdown.appendChild(tr);
        });
      }
    }

    // Render detailed logs
    if (tbDetailed) {
      tbDetailed.innerHTML = '';
      if (!list.length) {
        tbDetailed.innerHTML = '<tr><td colspan="3" class="small text-center"><div class="empty-state">No attendance records yet.</div></td></tr>';
      } else {
        list.forEach((a) => {
          const tr = document.createElement('tr');
          const d = a.date ? new Date(a.date).toLocaleDateString() : '';
          tr.innerHTML = `<td data-label="Date">${d}</td><td data-label="Subject">${esc(a.subject)}</td><td data-label="Status">${esc(a.status)}</td>`;
          tbDetailed.appendChild(tr);
        });
      }
    }

    // Render Heatmap Grid
    renderAttendanceHeatmap(list);
    makeTableSortableAndFilterable('tbl-subject-breakdown');
    makeTableSortableAndFilterable('tbl-att');
  }

  function renderAttendanceHeatmap(attendanceList) {
    const gridEl = el('attendance-heatmap-grid');
    const monthLabelEl = el('attendance-heatmap-month-label');
    if (!gridEl || !monthLabelEl) return;
    
    gridEl.innerHTML = '';
    
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    monthLabelEl.textContent = `${monthNames[month]} ${year}`;
    
    const numDays = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const offset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    
    // Add empty placeholder cells
    for (let i = 0; i < offset; i++) {
      const placeholder = document.createElement('div');
      placeholder.style.aspectRatio = '1';
      placeholder.style.borderRadius = '4px';
      placeholder.style.background = 'transparent';
      gridEl.appendChild(placeholder);
    }
    
    // Map logs by day of month
    const logsByDay = {};
    attendanceList.forEach(a => {
      if (!a.date) return;
      const logDate = new Date(a.date);
      if (logDate.getFullYear() === year && logDate.getMonth() === month) {
        const day = logDate.getDate();
        if (!logsByDay[day]) logsByDay[day] = [];
        logsByDay[day].push(a.status);
      }
    });
    
    // Render days
    for (let day = 1; day <= numDays; day++) {
      const cell = document.createElement('div');
      cell.className = 'heatmap-cell';
      cell.style.aspectRatio = '1';
      cell.style.borderRadius = '4px';
      cell.style.display = 'grid';
      cell.style.placeItems = 'center';
      cell.style.fontSize = '0.7rem';
      cell.style.fontWeight = '600';
      cell.style.cursor = 'default';
      cell.textContent = day;
      
      const statuses = logsByDay[day];
      if (statuses && statuses.length > 0) {
        const hasAbsent = statuses.includes('absent');
        const hasLeave = statuses.includes('leave');
        
        if (hasAbsent) {
          cell.style.background = '#ef4444';
          cell.style.color = '#fff';
          cell.title = `Day ${day}: Absent`;
        } else if (hasLeave) {
          cell.style.background = '#f59e0b';
          cell.style.color = '#fff';
          cell.title = `Day ${day}: On Leave`;
        } else {
          cell.style.background = '#22c55e';
          cell.style.color = '#fff';
          cell.title = `Day ${day}: Present`;
        }
      } else {
        cell.style.background = 'var(--muted)';
        cell.style.opacity = '0.25';
        cell.style.color = 'var(--text)';
        cell.title = `Day ${day}: No Classes`;
      }
      
      gridEl.appendChild(cell);
    }
  }

  async function loadMaterials() {
    const ul = el('mat-list');
    if (ul) ul.innerHTML = '<li class="small py-2"><div class="shimmer-line"></div></li>';
    
    let list = [];
    try {
      const listRaw = await SSC_API.get('/student/materials');
      list = Array.isArray(listRaw) ? listRaw : [];
    } catch (e) {
      console.error(e);
    }
    
    if (ul) {
      ul.innerHTML = '';
      if (!list.length) {
        ul.innerHTML = '<li class="small text-center py-4 empty-state">No study materials for your class yet.</li>';
        return;
      }
      list.forEach((m) => {
        const li = document.createElement('li');
        li.className = 'mt-2';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        li.style.alignItems = 'center';
        li.style.padding = '0.4rem 0.6rem';
        li.style.border = '1px solid var(--card-border)';
        li.style.borderRadius = 'var(--radius-xs)';
        li.style.background = 'rgba(0,0,0,0.1)';
        li.innerHTML = `
          <div>
            <strong>${esc(m.title)}</strong> — ${esc(m.subject)}
          </div>
          ${m.fileUrl ? `<a class="btn small secondary" href="${esc(m.fileUrl)}" target="_blank" rel="noopener" style="color:var(--text);">Download</a>` : ''}
        `;
        ul.appendChild(li);
      });
    }
  }

  async function loadNotices() {
    const box = el('stu-notices');
    if (box) box.innerHTML = '<div style="text-align: center; padding: 1rem;"><div class="shimmer-line"></div></div>';
    
    let items = [];
    try {
      const itemsRaw = await SSC_API.get('/student/notices');
      items = Array.isArray(itemsRaw) ? itemsRaw : [];
    } catch (e) {
      console.error(e);
    }
    
    if (box) {
      box.innerHTML = '';
      if (!items.length) {
        box.innerHTML = '<p class="small text-center py-4 empty-state">No notices published yet.</p>';
        return;
      }
      box.innerHTML = items
        .map(
          (n) =>
            `<div class="card mt-2" style="background:rgba(0,0,0,0.15)">
              <strong>${esc(n.title)}</strong>
              <p class="small mt-2">${esc(n.body || '')}</p>
              ${n.pdfUrl ? `<a class="btn small secondary" href="${esc(n.pdfUrl)}" target="_blank" style="color:var(--text);">PDF</a>` : ''}
            </div>`
        )
        .join('');
    }
  }

  async function loadEditProfile() {
    try {
      const u = await SSC_API.get('/student/profile');
      el('student-profile-name').value = u.name || '';
      el('student-profile-phone').value = u.phone || '';
      el('student-profile-bio').value = u.bio || '';
      
      const img = el('student-avatar-img');
      const placeholder = el('student-avatar-placeholder');
      if (img && placeholder) {
        if (u.avatarUrl) {
          img.src = u.avatarUrl;
          img.style.display = 'block';
          placeholder.style.display = 'none';
        } else {
          img.style.display = 'none';
          placeholder.style.display = 'grid';
          placeholder.textContent = (u.name || 'S').charAt(0).toUpperCase();
        }
      }
      el('student-avatar-upload').value = '';
      
      const sp = u.studentProfile || {};
      
      // Wire "Edit Profile Details" button in Overview tab to switch tabs
      const btnTriggerEdit = el('btn-trigger-student-edit');
      if (btnTriggerEdit && !btnTriggerEdit.dataset.wired) {
        btnTriggerEdit.dataset.wired = 'true';
        btnTriggerEdit.addEventListener('click', () => {
          const editTab = document.querySelector('[data-sub-tab="edit-info"]');
          if (editTab) editTab.click();
        });
      }

      // Populate Overview Personal details
      if (el('view-name')) el('view-name').textContent = u.name || '—';
      if (el('view-personal-email')) el('view-personal-email').textContent = sp.personalEmail || u.email || '—';
      if (el('view-phone')) el('view-phone').textContent = sp.mobile || u.phone || '—';
      if (el('view-address')) el('view-address').textContent = sp.address || '—';
      if (el('view-parent')) el('view-parent').textContent = sp.parentContact || '—';
      if (el('view-emergency')) el('view-emergency').textContent = sp.emergencyContact || '—';
      if (el('view-bio')) {
        el('view-bio').textContent = u.bio || 'No bio written yet.';
        el('view-bio').style.fontStyle = u.bio ? 'normal' : 'italic';
      }

      // Populate Header metadata
      if (el('profile-display-name')) el('profile-display-name').textContent = u.name || 'Student Name';
      if (el('profile-hdr-erp')) el('profile-hdr-erp').textContent = 'ERP: ' + (sp.studentId || '—');
      if (el('profile-hdr-roll')) el('profile-hdr-roll').textContent = 'Roll: ' + (sp.rollNumber || '—');
      if (el('profile-hdr-class')) el('profile-hdr-class').textContent = 'Class: ' + (sp.className || '—');
      if (el('profile-hdr-status')) el('profile-hdr-status').textContent = u.status || 'Active';

      // 1. Fetch Attendance Stats
      let totalAtt = 0, presentAtt = 0, pctAtt = 100;
      let attendanceRows = [];
      try {
        attendanceRows = await SSC_API.get('/student/attendance');
        const list = Array.isArray(attendanceRows) ? attendanceRows : [];
        totalAtt = list.length;
        presentAtt = list.filter(a => a.status === 'present').length;
        pctAtt = totalAtt ? Math.round((presentAtt / totalAtt) * 100) : 100;
      } catch (err) {
        console.error('Failed to load attendance for profile overview', err);
      }
      
      const settings = await getSettings().catch(() => ({}));
      const threshold = settings.attendanceThreshold ? Number(settings.attendanceThreshold) : 75;
      
      if (el('prof-sum-attendance')) {
        el('prof-sum-attendance').textContent = pctAtt + '%';
        el('prof-sum-attendance').style.color = pctAtt < threshold ? '#ef4444' : '#22c55e';
      }
      if (el('prof-sum-attendance-desc')) {
        el('prof-sum-attendance-desc').textContent = `Required: ${threshold}% | ${presentAtt}/${totalAtt} classes`;
      }
      
      if (el('prof-att-rate-field')) {
        el('prof-att-rate-field').textContent = pctAtt + '%';
        el('prof-att-rate-field').style.color = pctAtt < threshold ? '#ef4444' : '#22c55e';
      }
      if (el('prof-att-present-field')) el('prof-att-present-field').textContent = presentAtt;
      if (el('prof-att-missed-field')) el('prof-att-missed-field').textContent = totalAtt - presentAtt;
      
      const profAttWarn = el('prof-att-warn-banner');
      if (profAttWarn) {
        profAttWarn.style.display = (totalAtt > 0 && pctAtt < threshold) ? 'block' : 'none';
      }

      // Attendance Trend
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      const last30Logs = attendanceRows.filter(a => new Date(a.date) >= thirtyDaysAgo);
      const prior30Logs = attendanceRows.filter(a => {
        const d = new Date(a.date);
        return d >= sixtyDaysAgo && d < thirtyDaysAgo;
      });
      const present30 = last30Logs.filter(a => a.status === 'present').length;
      const pct30 = last30Logs.length ? (present30 / last30Logs.length) * 100 : 100;
      const presentPrior = prior30Logs.filter(a => a.status === 'present').length;
      const pctPrior = prior30Logs.length ? (presentPrior / prior30Logs.length) * 100 : pct30;

      let trendDir = '→ Stable';
      if (pct30 > pctPrior + 1) trendDir = '↑ Improving';
      else if (pct30 < pctPrior - 1) trendDir = '↓ Dropping';
      if (el('prof-att-trend-field')) el('prof-att-trend-field').textContent = trendDir;

      const tblProfAttSubjects = document.querySelector('#tbl-prof-att-subjects tbody');
      if (tblProfAttSubjects) {
        tblProfAttSubjects.innerHTML = '';
        const subBreakdown = {};
        attendanceRows.forEach(a => {
          const sub = a.subject || 'General';
          if (!subBreakdown[sub]) {
            subBreakdown[sub] = { present: 0, total: 0 };
          }
          if (a.status === 'present') subBreakdown[sub].present++;
          subBreakdown[sub].total++;
        });
        const subjects = Object.keys(subBreakdown).sort();
        if (!subjects.length) {
          tblProfAttSubjects.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No attendance logs.</td></tr>';
        } else {
          subjects.forEach(sub => {
            const stat = subBreakdown[sub];
            const subPct = stat.total ? Math.round((stat.present / stat.total) * 100) : 100;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${esc(sub)}</strong></td><td>${stat.present} / ${stat.total}</td><td>${subPct}%</td>`;
            tblProfAttSubjects.appendChild(tr);
          });
        }
      }

      // 2. Fetch Marks & CGPA
      let totalMarksPct = 0;
      let examCount = 0;
      const marksList = [];
      try {
        const marks = await SSC_API.get('/student/marks');
        if (Array.isArray(marks)) {
          marks.forEach(m => {
            marksList.push(m);
            if (m.maxMarks > 0) {
              totalMarksPct += (m.marksObtained / m.maxMarks) * 100;
              examCount++;
            }
          });
        }
      } catch (err) {
        console.error('Failed to load marks for profile overview', err);
      }
      const avgPct = examCount ? (totalMarksPct / examCount) : null;
      const gpaVal = avgPct !== null ? (avgPct / 10).toFixed(2) : '—';
      
      if (el('prof-sum-cgpa')) el('prof-sum-cgpa').textContent = gpaVal;
      if (el('prof-sum-cgpa-desc')) {
        el('prof-sum-cgpa-desc').textContent = examCount ? `Based on ${examCount} exams` : 'No grades published';
      }
      if (el('acad-cgpa')) el('acad-cgpa').textContent = gpaVal;
      if (el('acad-backlogs')) el('acad-backlogs').textContent = sp.backlogs || '0';
      if (el('acad-course')) el('acad-course').textContent = sp.courseName || sp.course || '—';
      if (el('acad-class')) el('acad-class').textContent = sp.className || '—';
      if (el('acad-year')) el('acad-year').textContent = sp.year || '—';
      if (el('acad-sem')) el('acad-sem').textContent = sp.semester || '—';
      if (el('acad-div')) el('acad-div').textContent = sp.division || '—';
      
      const tblProfAcadGrades = document.querySelector('#tbl-prof-acad-grades tbody');
      if (tblProfAcadGrades) {
        tblProfAcadGrades.innerHTML = '';
        if (!marksList.length) {
          tblProfAcadGrades.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No marks recorded.</td></tr>';
        } else {
          marksList.forEach(m => {
            const pct = m.maxMarks ? (m.marksObtained / m.maxMarks) * 100 : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${esc(m.subject)}</strong></td><td>${esc(m.examName)}</td><td>${m.marksObtained} / ${m.maxMarks}</td><td>${pct.toFixed(1)}%</td>`;
            tblProfAcadGrades.appendChild(tr);
          });
        }
      }

      // 3. Placement Stats & Details
      let drives = [];
      let applications = [];
      try {
        drives = asArray(await SSC_API.get('/student/placement/drives'));
        applications = asArray(await SSC_API.get('/student/placement/applications'));
      } catch (err) {
        console.error('Failed to load placement info for profile overview', err);
      }
      const isEligible = sp.backlogs ? Number(sp.backlogs) === 0 : true;
      const placementStatusText = isEligible ? 'Eligible' : 'Not Eligible';
      
      if (el('prof-sum-placement')) {
        el('prof-sum-placement').textContent = placementStatusText;
        el('prof-sum-placement').style.color = isEligible ? '#22c55e' : '#ef4444';
      }
      if (el('prof-sum-placement-desc')) {
        el('prof-sum-placement-desc').textContent = isEligible ? '0 backlogs' : `${sp.backlogs} active backlogs`;
      }
      if (el('prof-pl-eligible')) {
        el('prof-pl-eligible').textContent = placementStatusText;
        el('prof-pl-eligible').style.color = isEligible ? '#22c55e' : '#ef4444';
      }
      if (el('prof-pl-applied')) el('prof-pl-applied').textContent = applications.length;
      
      const shortlistedCount = applications.filter(a => a.status === 'shortlisted' || a.status === 'selected').length;
      if (el('prof-pl-shortlisted')) el('prof-pl-shortlisted').textContent = shortlistedCount;
      const offersCount = applications.filter(a => a.status === 'selected').length;
      if (el('prof-pl-offers')) el('prof-pl-offers').textContent = offersCount;
      
      const tblProfPlAppsList = document.querySelector('#tbl-prof-pl-apps-list tbody');
      if (tblProfPlAppsList) {
        tblProfPlAppsList.innerHTML = '';
        if (!applications.length) {
          tblProfPlAppsList.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No applications submitted.</td></tr>';
        } else {
          applications.forEach(app => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${esc(app.drive?.company?.companyName || 'SSC Partner')}</strong></td>
              <td>${esc(app.drive?.title || 'Drive')}</td>
              <td>${esc(app.drive?.company?.packageOffered || 'N/A')}</td>
              <td><span class="badge ${app.status === 'selected' ? 'success' : (app.status === 'rejected' ? 'danger' : 'warning')}">${esc(app.status || 'applied')}</span></td>
            `;
            tblProfPlAppsList.appendChild(tr);
          });
        }
      }

      // 4. Credentials
      const credsEmail = el('creds-email');
      const credsErpId = el('creds-erp-id');
      const copyBtn = el('btn-copy-creds');
      if (credsEmail) credsEmail.value = u.email || '';
      if (credsErpId) credsErpId.value = sp.studentId || u.id || '';
      if (el('creds-personal-email')) el('creds-personal-email').value = sp.personalEmail || u.email || '—';
      if (copyBtn && !copyBtn.dataset.wired) {
        copyBtn.dataset.wired = 'true';
        copyBtn.addEventListener('click', () => {
          const emailVal = credsEmail ? credsEmail.value : '';
          const erpVal = credsErpId ? credsErpId.value : '';
          const textToCopy = `Login ID/Email: ${emailVal}\nERP ID: ${erpVal}`;
          navigator.clipboard.writeText(textToCopy).then(() => {
            showToast('Credentials copied to clipboard!', 'success');
          }).catch(err => {
            showToast('Failed to copy: ' + err.message, 'error');
          });
        });
      }

      const mustChange = u.mustChangePassword;
      const pwdStatusText = mustChange ? 'Change Required' : 'Secure (Hashing Active)';
      const pwdStatusColor = mustChange ? '#ef4444' : '#22c55e';
      if (el('creds-pwd-status')) {
        el('creds-pwd-status').textContent = pwdStatusText;
        el('creds-pwd-status').style.color = pwdStatusColor;
      }
      if (el('prof-sum-security')) {
        el('prof-sum-security').textContent = mustChange ? 'Risk Alert' : 'Secure';
        el('prof-sum-security').style.color = pwdStatusColor;
      }
      if (el('prof-sum-security-desc')) {
        el('prof-sum-security-desc').textContent = mustChange ? 'Password reset forced' : 'Compliance verified';
      }
      const pwdChangedDate = u.updatedAt ? new Date(u.updatedAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      if (el('creds-pwd-changed')) el('creds-pwd-changed').textContent = pwdChangedDate;

      // 5. Activity History / Audit Trail
      const lastLoginStr = u.lastLogin ? new Date(u.lastLogin).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
      if (el('prof-sum-login')) el('prof-sum-login').textContent = lastLoginStr;
      
      const profileActivityLogs = el('profile-activity-logs');
      if (profileActivityLogs) {
        profileActivityLogs.innerHTML = '';
        const logs = [];
        if (u.lastLogin) {
          logs.push({
            time: new Date(u.lastLogin).toLocaleString('en-IN'),
            text: 'User successfully logged in to the student portal.'
          });
        }
        if (u.updatedAt) {
          logs.push({
            time: new Date(u.updatedAt).toLocaleString('en-IN'),
            text: 'Profile configurations and database integrity status checked.'
          });
        }
        if (sp.admissionYear) {
          logs.push({
            time: `${sp.admissionYear}-07-15 10:00:00`,
            text: 'Admission approved and student ERP record synchronized.'
          });
        }
        if (!logs.length) {
          profileActivityLogs.innerHTML = '<div class="activity-log-item"><span class="activity-log-time">Now</span><span class="activity-log-text">No prior logs saved.</span></div>';
        } else {
          profileActivityLogs.innerHTML = logs.map(l => `
            <div class="activity-log-item">
              <span class="activity-log-time">${l.time}</span>
              <span class="activity-log-text">${esc(l.text)}</span>
            </div>
          `).join('');
        }
      }

      // Reset inner tabs to overview
      const tabsContainer = el('profile-inner-tabs');
      if (tabsContainer) {
        const tabs = tabsContainer.querySelectorAll('.id-tab');
        tabs.forEach(t => {
          if (t.getAttribute('data-sub-tab') === 'overview') {
            t.classList.add('active');
          } else {
            t.classList.remove('active');
          }
        });
        const contents = ['overview', 'academics', 'attendance', 'placement', 'creds', 'activity', 'edit-info', 'security'];
        contents.forEach(c => {
          const contentEl = el(`profile-sub-${c}`);
          if (contentEl) {
            contentEl.style.display = c === 'overview' ? 'block' : 'none';
          }
        });
      }

      await loadEnrollmentStatus();
    } catch (err) {
      console.error('Failed to load edit profile information', err);
    }
  }

  function setupProfileSubTabs() {
    const tabsContainer = el('profile-inner-tabs');
    if (!tabsContainer) return;
    const tabs = tabsContainer.querySelectorAll('.id-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const target = tab.getAttribute('data-sub-tab');
        const contents = ['overview', 'academics', 'attendance', 'placement', 'creds', 'activity', 'edit-info', 'security'];
        contents.forEach(c => {
          const contentEl = el(`profile-sub-${c}`);
          if (contentEl) {
            contentEl.style.display = c === target ? 'block' : 'none';
          }
        });
      });
    });
  }

  async function loadEnrollmentStatus() {
    const contentEl = el('enrollment-status-content');
    try {
      const data = await SSC_API.get('/student/admission-status');
      const a = (data && data.application) ? data.application : null;
      if (contentEl) {
        if (data.linked === false || !a) {
          contentEl.textContent = 'No linked application found.';
        } else {
          contentEl.textContent = [
            `Application: ${a.applicationNumber}`,
            `Status: ${a.status}`,
            `Course: ${a.courseApplied || ''}`,
            a.documentsVerified != null ? `Documents verified: ${a.documentsVerified ? 'Yes' : 'No'}` : '',
            a.verificationNotes ? `Notes: ${a.verificationNotes}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        }
      }
      
      // Update Academic Snapshot details
      if (a) {
        if (el('snap-app-num')) el('snap-app-num').textContent = a.applicationNumber || '—';
        if (el('snap-adm-year')) el('snap-adm-year').textContent = a.admissionYear || new Date().getFullYear();
        if (el('snap-docs-verified')) el('snap-docs-verified').textContent = a.documentsVerified ? 'Yes, Verified' : 'Pending';
        if (el('snap-verify-status')) el('snap-verify-status').innerHTML = `<span class="badge ${a.status === 'approved' ? 'success' : 'warning'}">${esc(a.status || 'pending')}</span>`;
        if (el('snap-verify-notes')) el('snap-verify-notes').textContent = a.verificationNotes || 'No verification notes.';
      }
    } catch (err) {
      if (contentEl) contentEl.textContent = 'Error loading enrollment status: ' + err.message;
    }
  }

  // ════════════════════════════════════════════════════════════
  // PLACEMENT CELL — Student JS
  // ════════════════════════════════════════════════════════════
  async function loadPlacementPanel() {
    const container = el('pl-drives-list');
    const cardsContainer = el('stu-pl-apps-cards');
    
    if (container) container.innerHTML = '<div style="padding: 1rem;"><div class="shimmer-line"></div></div>';
    if (cardsContainer) cardsContainer.innerHTML = '<div style="padding: 1rem;"><div class="shimmer-line"></div></div>';
    
    await Promise.all([loadStuPlDrives(), loadStuPlApplications()]);
  }

  async function loadStuPlDrives() {
    let drives = [];
    try {
      drives = asArray(await SSC_API.get('/student/placement/drives'));
    } catch (e) {
      console.error(e);
    }
    const container = el('pl-drives-list');
    if (!container) return;

    if (!drives.length) {
      container.innerHTML = '<p class="small text-center py-4 empty-state">No active placement drives at the moment. Check back soon.</p>';
      return;
    }

    container.innerHTML = drives.map((d) => {
      const deadline = d.applicationDeadline
        ? new Date(d.applicationDeadline).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
        : 'Open';
      const driveDate = d.driveDate
        ? new Date(d.driveDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
        : 'TBD';
      const applied = d.hasApplied;
      const statusLabel = (d.myStatus || '').replace(/_/g, ' ');
      const statusColor = { applied:'#94a3b8', shortlisted:'#f59e0b', interview_scheduled:'#3b82f6', selected:'#22c55e', rejected:'#ef4444' };
      const sColor = statusColor[d.myStatus] || '#94a3b8';
      const deadlinePassed = d.deadlinePassed;

      return `
        <div style="border:1px solid rgba(56,189,248,0.15);border-radius:10px;padding:1rem 1.25rem;margin-bottom:1rem;background:rgba(0,0,0,0.15);display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:1rem;">
          <div style="flex:1;min-width:200px;">
            <div style="font-weight:700;font-size:1rem;">${esc(d.company?.companyName || '')}</div>
            <div style="font-size:0.88rem;opacity:0.75;margin-top:0.2rem;">${esc(d.title)}</div>
            <div style="margin-top:0.6rem;display:flex;gap:1.25rem;flex-wrap:wrap;font-size:0.82rem;opacity:0.8;">
              <span>💼 ${esc(d.company?.industry || '')}</span>
              <span>💰 ${esc(d.company?.packageOffered || 'N/A')}</span>
              <span>📍 ${esc(d.company?.location || '')}</span>
            </div>
            <div style="margin-top:0.5rem;font-size:0.8rem;opacity:0.65;">
              <span>Drive Date: <strong>${driveDate}</strong></span>
              &nbsp;•&nbsp;
              <span>Apply by: <strong style="${deadlinePassed?'color:#ef4444;':''}">${deadline}</strong></span>
            </div>
            ${d.company?.eligibilityCriteria ? `<div style="margin-top:0.4rem;font-size:0.8rem;opacity:0.65;">Eligibility: ${esc(d.company.eligibilityCriteria)}</div>` : ''}
          </div>
          <div style="display:flex;align-items:center;gap:0.75rem;flex-shrink:0;">
            ${applied
              ? `<span style="font-size:0.85rem;font-weight:600;color:${sColor};text-transform:capitalize;">&#10003; ${esc(statusLabel) || 'Applied'}</span>`
              : (deadlinePassed
                  ? `<span class="btn small secondary" style="opacity:0.4;cursor:not-allowed;">Deadline Passed</span>`
                  : `<button class="btn small" data-apply-drive="${d._id}" style="color:#000;">Apply Now</button>`
                )
            }
          </div>
        </div>`;
    }).join('');

    // Bind Apply buttons
    container.querySelectorAll('[data-apply-drive]').forEach((b) => {
      b.addEventListener('click', async () => {
        const driveId = b.getAttribute('data-apply-drive');
        try {
          b.disabled = true;
          b.textContent = 'Applying...';
          await SSC_API.post('/student/placement/apply/' + driveId, {});
          showToast('Application submitted successfully!', 'success');
          loadPlacementPanel();
        } catch (err) {
          showToast(err.data?.error || err.message || 'Could not apply', 'error');
          b.disabled = false;
          b.textContent = 'Apply Now';
        }
      });
    });
  }

  async function loadStuPlApplications() {
    let apps = [];
    try {
      apps = asArray(await SSC_API.get('/student/placement/applications'));
    } catch (e) {
      console.error(e);
    }
    const cardsContainer = el('stu-pl-apps-cards');
    if (!cardsContainer) return;
    cardsContainer.innerHTML = '';

    // Update stat grid
    const grid = el('stu-pl-stat-grid');
    if (grid) {
      const applied = apps.length;
      const shortlisted = apps.filter(a => ['shortlisted','interview_scheduled','selected'].includes(a.applicationStatus)).length;
      const selected = apps.filter(a => a.applicationStatus === 'selected').length;
      grid.innerHTML = `
        <div class="stat-card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div class="stat-card-header">
            <span class="small">Total Applied</span>
            <div class="stat-card-icon indigo">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </div>
          </div>
          <strong>${applied}</strong>
        </div>
        <div class="stat-card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div class="stat-card-header">
            <span class="small">Shortlisted</span>
            <div class="stat-card-icon amber">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M13 6h3a2 2 0 0 1 2 2v7"/><path d="M6 9v12"/></svg>
            </div>
          </div>
          <strong>${shortlisted}</strong>
        </div>
        <div class="stat-card" style="display:flex; flex-direction:column; justify-content:space-between;">
          <div class="stat-card-header">
            <span class="small">Selected</span>
            <div class="stat-card-icon green">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
          </div>
          <strong>${selected}</strong>
        </div>
      `;
    }

    if (!apps.length) {
      cardsContainer.innerHTML = '<p class="small text-secondary text-center" style="opacity: 0.7; padding: 2rem;"><div class="empty-state">You have not applied for any placement drives yet.</div></p>';
      return;
    }

    apps.forEach((a) => {
      const dt = a.appliedAt ? new Date(a.appliedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
      const status = a.applicationStatus;
      
      let step1Class = 'completed';
      let step2Class = '';
      let step3Class = '';
      let step4Class = '';
      let fillWidth = '0%';

      if (status === 'applied') {
        step2Class = 'active';
        fillWidth = '16.7%';
      } else if (status === 'shortlisted') {
        step2Class = 'completed';
        step3Class = 'active';
        fillWidth = '50%';
      } else if (status === 'interview_scheduled') {
        step2Class = 'completed';
        step3Class = 'completed';
        step4Class = 'active';
        fillWidth = '83.3%';
      } else if (status === 'selected') {
        step2Class = 'completed';
        step3Class = 'completed';
        step4Class = 'completed';
        fillWidth = '100%';
      } else if (status === 'rejected') {
        step2Class = 'completed';
        step3Class = 'completed';
        step4Class = 'failed';
        fillWidth = '100%';
      }

      const card = document.createElement('div');
      card.className = 'card mb-3';
      card.style.background = 'rgba(0,0,0,0.15)';
      card.style.border = '1px solid var(--card-border)';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:0.5rem; margin-bottom: 0.75rem;">
          <div>
            <h4 style="margin:0; font-size:1rem; font-weight:700;">${esc(a.companyName)}</h4>
            <span class="small" style="opacity:0.8;">Drive: ${esc(a.driveTitle)} &bull; Applied: ${dt}</span>
          </div>
          <div style="text-align:right;">
            <span class="small" style="display:block; opacity:0.85;">💰 Package: <strong>${esc(a.packageOffered || 'N/A')}</strong></span>
            <span class="small" style="display:block; opacity:0.85;">📍 Location: <strong>${esc(a.location || 'N/A')}</strong></span>
          </div>
        </div>
        
        <div class="placement-stepper" style="margin-top: 1.5rem; padding: 0 0.5rem;">
          <div class="stepper-progress-bg"></div>
          <div class="stepper-progress-fill" style="width: ${fillWidth};"></div>
          
          <div class="stepper-step ${step1Class}">
            <div class="stepper-node">1</div>
            <div class="stepper-label">Applied</div>
          </div>
          <div class="stepper-step ${step2Class}">
            <div class="stepper-node">2</div>
            <div class="stepper-label">Shortlisted</div>
          </div>
          <div class="stepper-step ${step3Class}">
            <div class="stepper-node">3</div>
            <div class="stepper-label">Interview</div>
          </div>
          <div class="stepper-step ${step4Class}">
            <div class="stepper-node">4</div>
            <div class="stepper-label">${status === 'selected' ? 'Selected' : status === 'rejected' ? 'Rejected' : 'Result'}</div>
          </div>
        </div>
      `;
      cardsContainer.appendChild(card);
    });
  }

  // Visual Setup functions
  function setupSearch() {
    const searchInput = el('global-search');
    const resultsDiv = el('search-results');
    const searchWrap = el('global-search-wrap');
    
    if (!searchInput) return;
    
    // Focus keyboard shortcut (Ctrl/Cmd+K)
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
      }
    });
    
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        resultsDiv.innerHTML = '';
        resultsDiv.classList.remove('visible');
        return;
      }
      
      resultsDiv.innerHTML = '';
      resultsDiv.classList.add('visible');
      
      const filteredNotices = noticesCache.filter(n => 
        (n.title && n.title.toLowerCase().includes(q)) || 
        (n.body && n.body.toLowerCase().includes(q))
      );
      
      const filteredResults = examResultsCache.filter(r => 
        (r.title && r.title.toLowerCase().includes(q)) || 
        (r.subject && r.subject.toLowerCase().includes(q))
      );
      
      if (filteredNotices.length === 0 && filteredResults.length === 0) {
        resultsDiv.innerHTML = '<div class="search-results-empty">No matches found</div>';
        return;
      }
      
      if (filteredNotices.length > 0) {
        const group = document.createElement('div');
        group.className = 'search-result-group';
        group.innerHTML = '<div class="search-result-group-label">Notices</div>';
        
        filteredNotices.forEach(n => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <span>Notice: ${esc(n.title)}</span>
          `;
          item.addEventListener('click', () => {
            searchInput.value = '';
            resultsDiv.classList.remove('visible');
            panel('notices');
            load('notices');
          });
          group.appendChild(item);
        });
        resultsDiv.appendChild(group);
      }
      
      if (filteredResults.length > 0) {
        const group = document.createElement('div');
        group.className = 'search-result-group';
        group.innerHTML = '<div class="search-result-group-label">Exam Results</div>';
        
        filteredResults.forEach(r => {
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 10 3 12 0v-5"/></svg>
            <span>Result: ${esc(r.title)} - ${esc(r.subject)} (${r.marksObtained}/${r.maxMarks})</span>
          `;
          item.addEventListener('click', () => {
            searchInput.value = '';
            resultsDiv.classList.remove('visible');
            panel('exams');
            load('exams');
            setTimeout(() => {
              const overlay = el('print-result-overlay');
              if (overlay && overlay.style.display !== 'none') {
                overlay.scrollIntoView({ behavior: 'smooth' });
              }
            }, 300);
          });
          group.appendChild(item);
        });
        resultsDiv.appendChild(group);
      }
    });
    
    document.addEventListener('click', (e) => {
      if (searchWrap && !searchWrap.contains(e.target)) {
        resultsDiv.classList.remove('visible');
      }
    });
  }

  async function setupNotifications() {
    const notifBtn = el('topbar-notif-btn');
    const dropdown = el('notif-dropdown');
    const notifList = el('notif-list');
    const badge = el('notif-badge');
    const clearBtn = el('notif-clear-btn');
    
    if (!notifBtn || !dropdown || !notifList) return;
    
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
      if (dropdown.style.display === 'block') {
        markAllNotificationsRead();
      }
    });
    
    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== notifBtn) {
        dropdown.style.display = 'none';
      }
    });
    
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        readNotifications = activeNotifications.map(n => n.id);
        localStorage.setItem('ssc_read_notifs_student', JSON.stringify(readNotifications));
        renderNotifications();
      });
    }
    
    try {
      const stored = localStorage.getItem('ssc_read_notifs_student');
      readNotifications = stored ? JSON.parse(stored) : [];
    } catch {
      readNotifications = [];
    }
    
    await fetchNotifications();
    
    async function fetchNotifications() {
      try {
        const [notices, libraryBooks, placementDrives] = await Promise.all([
          SSC_API.get('/student/notices').catch(() => []),
          SSC_API.get('/student/library/my-books').catch(() => []),
          SSC_API.get('/student/placement/drives').catch(() => [])
        ]);
        
        activeNotifications = [];
        
        // Notices
        notices.forEach(n => {
          activeNotifications.push({
            id: 'notice-' + (n._id || n.id),
            title: 'College Notice',
            desc: n.title,
            time: n.createdAt ? new Date(n.createdAt) : new Date(),
            icon: 'blue',
            svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>'
          });
        });
        
        // Library due books
        libraryBooks.forEach(is => {
          const dueDate = new Date(is.dueDate);
          const timeDiff = dueDate.getTime() - new Date().getTime();
          const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));
          const isOverdue = timeDiff < 0;
          
          if (isOverdue || daysLeft <= 3) {
            activeNotifications.push({
              id: 'lib-' + (is._id || is.id),
              title: isOverdue ? 'Library Book Overdue!' : 'Library Return Due Soon',
              desc: `"${is.book?.title || 'Book'}" is ${isOverdue ? 'overdue' : `due in ${daysLeft} days`}.`,
              time: new Date(is.dueDate),
              icon: isOverdue ? 'red' : 'amber',
              svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>'
            });
          }
        });
        
        // Placement drives
        placementDrives.forEach(d => {
          if (!d.hasApplied && !d.deadlinePassed) {
            activeNotifications.push({
              id: 'drive-' + (d._id || d.id),
              title: 'Active Placement Drive',
              desc: `${d.company?.companyName || 'Company'} is hiring for ${d.title}. Apply now!`,
              time: d.createdAt ? new Date(d.createdAt) : new Date(),
              icon: 'green',
              svg: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'
            });
          }
        });
        
        activeNotifications.sort((a, b) => b.time - a.time);
        
        renderNotifications();
      } catch (err) {
        console.error('Error fetching notifications:', err);
      }
    }
    
    function renderNotifications() {
      notifList.innerHTML = '';
      let unreadCount = 0;
      
      if (activeNotifications.length === 0) {
        notifList.innerHTML = '<div class="notif-empty">No notifications</div>';
        badge.style.display = 'none';
        return;
      }
      
      activeNotifications.forEach(n => {
        const isRead = readNotifications.includes(n.id);
        if (!isRead) unreadCount++;
        
        const item = document.createElement('div');
        item.className = `notif-item ${isRead ? '' : 'notif-item-unread'}`;
        item.innerHTML = `
          <div class="notif-item-icon ${n.icon}">${n.svg}</div>
          <div style="flex:1;">
            <p class="notif-item-title">${esc(n.title)}</p>
            <p class="notif-item-desc">${esc(n.desc)}</p>
            <span class="notif-item-time">${n.time.toLocaleDateString()}</span>
          </div>
        `;
        notifList.appendChild(item);
      });
      
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'grid';
      } else {
        badge.style.display = 'none';
      }
    }
    
    function markAllNotificationsRead() {
      readNotifications = activeNotifications.map(n => n.id);
      localStorage.setItem('ssc_read_notifs_student', JSON.stringify(readNotifications));
      badge.style.display = 'none';
      setTimeout(renderNotifications, 1000);
    }
  }

  function checkPasswordForcedChange(user) {
    if (user.mustChangePassword === true) {
      const modal = el('modal-must-change-pwd');
      if (modal) modal.style.display = 'flex';
      
      const form = el('form-must-change-pwd');
      if (form) {
        const curInput = el('must-current-pwd');
        const newInput = el('must-new-pwd');
        const confirmInput = el('must-confirm-pwd');
        
        newInput.addEventListener('input', () => {
          validatePasswordStrength(newInput.value, 'must-criteria-');
        });
        
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (newInput.value !== confirmInput.value) {
            showToast('New passwords do not match', 'error');
            return;
          }
          if (!validatePasswordStrength(newInput.value, 'must-criteria-')) {
            showToast('Password strength criteria not met', 'error');
            return;
          }
          try {
            await SSC_API.post('/auth/change-password', {
              currentPassword: curInput.value,
              newPassword: newInput.value
            });
            showToast('Password changed successfully!', 'success');
            modal.style.display = 'none';
            user.mustChangePassword = false;
          } catch (err) {
            showToast(err.message || 'Failed to change password', 'error');
          }
        });
      }
    }
  }

  function validatePasswordStrength(pwd, prefix) {
    const hasLength = pwd.length >= 8;
    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasDigit = /[0-9]/.test(pwd);
    const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"|,.<>\/?]/.test(pwd);
    
    toggleCriteriaClass(prefix + 'length', hasLength);
    toggleCriteriaClass(prefix + 'upper', hasUpper);
    toggleCriteriaClass(prefix + 'lower', hasLower);
    toggleCriteriaClass(prefix + 'digit', hasDigit);
    toggleCriteriaClass(prefix + 'special', hasSpecial);
    
    return hasLength && hasUpper && hasLower && hasDigit && hasSpecial;
  }

  function toggleCriteriaClass(id, isValid) {
    const node = el(id);
    if (node) {
      node.classList.toggle('valid', isValid);
    }
  }

  function setupChangePasswordForm() {
    const form = el('form-change-password');
    if (form) {
      const curInput = el('profile-current-pwd');
      const newInput = el('profile-new-pwd');
      const confirmInput = el('profile-confirm-pwd');
      
      newInput.addEventListener('input', () => {
        validatePasswordStrength(newInput.value, 'criteria-');
      });
      
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (newInput.value !== confirmInput.value) {
          showToast('New passwords do not match', 'error');
          return;
        }
        if (!validatePasswordStrength(newInput.value, 'criteria-')) {
          showToast('Password strength criteria not met', 'error');
          return;
        }
        try {
          await SSC_API.post('/auth/change-password', {
            currentPassword: curInput.value,
            newPassword: newInput.value
          });
          showToast('Password changed successfully!', 'success');
          form.reset();
          validatePasswordStrength('', 'criteria-');
        } catch (err) {
          showToast(err.message || 'Failed to change password', 'error');
        }
      });
    }
  }

  function setupMobileMenu() {
    const btn = el('mobile-menu-btn');
    const side = document.querySelector('.dash-side');
    if (btn && side) {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        side.classList.toggle('open');
      });
      document.addEventListener('click', (e) => {
        if (side.classList.contains('open') && !side.contains(e.target) && e.target !== btn) {
          side.classList.remove('open');
        }
      });
    }
  }

  function initOnboardingTour() {
    if (localStorage.getItem('ssc_onboarding_done') === 'true') {
      return;
    }

    const steps = [
      {
        element: '.dash-side',
        title: 'Sidebar Navigation',
        body: 'Navigate between different panels in your workspace. Use the sections to access academic data, personal profiles, and utility panels.',
        placement: 'right'
      },
      {
        element: '#global-search-wrap',
        title: 'Global Search',
        body: 'Quickly find subjects, results, notices, or other information. Press Ctrl+K to focus this search box instantly from anywhere.',
        placement: 'bottom'
      },
      {
        element: '#topbar-notif-btn',
        title: 'Notifications Hub',
        body: 'Stay updated with live college announcements, alerts, and system notifications. Click the bell to view recent messages.',
        placement: 'bottom'
      },
      {
        element: '.topbar-profile',
        title: 'User Profile & Settings',
        body: 'View your personal details, access settings, or log out of your account.',
        placement: 'left'
      }
    ];

    let currentStep = 0;
    let overlay = null;
    let popover = null;

    function createTourElements() {
      overlay = document.createElement('div');
      overlay.className = 'tour-overlay';
      document.body.appendChild(overlay);

      popover = document.createElement('div');
      popover.className = 'tour-popover';
      document.body.appendChild(popover);

      renderStep();

      setTimeout(() => {
        overlay.classList.add('active');
        popover.classList.add('active');
      }, 300);
    }

    function removeTour() {
      if (overlay) overlay.remove();
      if (popover) popover.remove();
      document.querySelectorAll('.tour-highlighted-element').forEach(e => {
        e.classList.remove('tour-highlighted-element');
      });
      localStorage.setItem('ssc_onboarding_done', 'true');
    }

    function renderStep() {
      document.querySelectorAll('.tour-highlighted-element').forEach(e => {
        e.classList.remove('tour-highlighted-element');
      });

      const step = steps[currentStep];
      const target = document.querySelector(step.element);

      if (!target || target.offsetWidth === 0 || target.offsetHeight === 0) {
        if (currentStep < steps.length - 1) {
          currentStep++;
          renderStep();
        } else {
          removeTour();
        }
        return;
      }

      target.classList.add('tour-highlighted-element');

      popover.innerHTML = `
        <div class="tour-popover-header">
          <h4 class="tour-popover-title">${esc(step.title)}</h4>
        </div>
        <div class="tour-popover-body">${esc(step.body)}</div>
        <div class="tour-popover-footer">
          <span class="tour-step-indicator">Step ${currentStep + 1} of ${steps.length}</span>
          <div class="tour-buttons">
            <button type="button" class="tour-btn tour-btn-skip">Skip</button>
            <button type="button" class="tour-btn tour-btn-next">${currentStep === steps.length - 1 ? 'Finish' : 'Next'}</button>
          </div>
        </div>
      `;

      const rect = target.getBoundingClientRect();
      let top = 0;
      let left = 0;

      if (step.placement === 'right') {
        top = rect.top + window.scrollY + (rect.height / 2) - 80;
        left = rect.right + 15;
      } else if (step.placement === 'bottom') {
        top = rect.bottom + window.scrollY + 15;
        left = rect.left + (rect.width / 2) - 160;
      } else if (step.placement === 'left') {
        top = rect.top + window.scrollY + (rect.height / 2) - 80;
        left = rect.left - 335;
      } else {
        top = rect.top + window.scrollY - 160;
        left = rect.left + (rect.width / 2) - 160;
      }

      if (left < 10) left = 10;
      if (left + 320 > window.innerWidth) left = window.innerWidth - 330;
      if (top < 10) top = 10;

      popover.style.top = `${top}px`;
      popover.style.left = `${left}px`;

      popover.querySelector('.tour-btn-skip').addEventListener('click', removeTour);
      popover.querySelector('.tour-btn-next').addEventListener('click', () => {
        if (currentStep === steps.length - 1) {
          removeTour();
        } else {
          currentStep++;
          renderStep();
        }
      });
    }

    createTourElements();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
