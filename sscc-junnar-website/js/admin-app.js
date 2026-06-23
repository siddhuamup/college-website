(function () {
  const msg = (t, err) => {
    const el = document.getElementById('dash-msg');
    el.textContent = t || '';
    el.className = 'small mt-3' + (err ? ' alert error' : t ? ' alert success' : '');
  };

  function showModalAlert(message, title = 'Notification') {
    const titleEl = document.getElementById('modal-alert-title');
    const msgEl = document.getElementById('modal-alert-message');
    const modal = document.getElementById('modal-alert');
    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (modal) modal.style.display = 'flex';
  }

  function showGate() {
    const gate = document.getElementById('admin-gate');
    const shell = document.getElementById('admin-shell');
    if (gate) gate.style.display = '';
    if (shell) shell.style.display = 'none';
    const k = document.getElementById('admin-access-key');
    if (k) k.value = '';
  }

  function showShell() {
    const gate = document.getElementById('admin-gate');
    const shell = document.getElementById('admin-shell');
    if (gate) gate.style.display = 'none';
    if (shell) shell.style.display = '';
  }

  function setupGateForm() {
    const form = document.getElementById('admin-gate-form');
    const msgEl = document.getElementById('admin-gate-msg');
    if (!form || form.dataset.bound) return;
    form.dataset.bound = '1';
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      msgEl.textContent = '';
      msgEl.className = 'small mt-3';
      const accessKey = document.getElementById('admin-access-key').value;
      try {
        const data = await SSC_API.post('/auth/admin-access', { accessKey });
        SSC_API.setToken(data.token);
        location.reload();
      } catch (err) {
        const detail = err.data && err.data.error ? err.data.error : err.message;
        msgEl.textContent = detail || 'Access denied';
        msgEl.className = 'small mt-3 alert error';
      }
    });
  }

  /* ── Search index cache ──────────────────────────────────── */
  let searchIndex = { students: [], teachers: [], admissions: [], notices: [], courses: [], departments: [] };
  let searchLoaded = false;

  async function buildSearchIndex() {
    try {
      const [students, teachers, courses, departments] = await Promise.all([
        SSC_API.get('/admin/students').catch(() => []),
        SSC_API.get('/admin/teachers').catch(() => []),
        SSC_API.get('/admin/courses').catch(() => []),
        SSC_API.get('/admin/departments').catch(() => []),
      ]);
      searchIndex = { students, teachers, admissions: [], notices: [], courses, departments };
      searchLoaded = true;
      loadNotifications();
    } catch { /* silent */ }
  }

  let activeNotifications = [];
  let dbReadNotifications = [];

  async function loadNotifications() {
    try {
      const [admissions, leaves, attAnalytics, placements, dbReads] = await Promise.all([
        SSC_API.get('/admin/admissions').catch(() => []),
        SSC_API.get('/admin/leave').catch(() => []),
        SSC_API.get('/admin/attendance/analytics').catch(() => null),
        SSC_API.get('/admin/placement/applications').catch(() => []),
        SSC_API.get('/admin/notifications/read').catch(() => []),
      ]);

      dbReadNotifications = Array.isArray(dbReads) ? dbReads : [];
      const list = [];

      // 1. Pending Admissions
      admissions.forEach(a => {
        if (String(a.status || '').toLowerCase() === 'pending') {
          list.push({
            id: 'adm-' + (a._id || a.id),
            category: 'Pending Admissions',
            text: `New admission application from ${a.fullName} for ${a.courseApplied}`,
            panel: 'admissions',
            date: a.createdAt ? new Date(a.createdAt) : new Date()
          });
        }
      });

      // 2. Teacher Leave Requests
      leaves.forEach(l => {
        if (String(l.status || '').toLowerCase() === 'pending') {
          list.push({
            id: 'leave-' + (l._id || l.id),
            category: 'Teacher Leave Requests',
            text: `Leave request from ${l.teacher?.name || 'Teacher'} (${l.leaveType})`,
            panel: 'leaves',
            date: l.createdAt ? new Date(l.createdAt) : new Date()
          });
        }
      });

      // 3. Low Attendance Alerts
      if (attAnalytics && attAnalytics.lowAttendanceList) {
        attAnalytics.lowAttendanceList.forEach(s => {
          list.push({
            id: 'att-' + s.rollNumber,
            category: 'Low Attendance Alerts',
            text: `Low attendance alert for ${s.name} (${s.className}): ${s.percentage}%`,
            panel: 'attendance-analytics',
            date: new Date()
          });
        });
      }

      // 4. Placement Updates
      placements.forEach(p => {
        if (String(p.applicationStatus || '').toLowerCase() === 'applied') {
          list.push({
            id: 'place-' + (p._id || p.id),
            category: 'Placement Updates',
            text: `New placement application: ${p.studentName} applied for ${p.companyName} (${p.driveTitle})`,
            panel: 'placement',
            date: p.appliedAt ? new Date(p.appliedAt) : new Date()
          });
        }
      });

      // 5. System Alerts
      list.push({
        id: 'sys-status',
        category: 'System Alerts',
        text: 'SSC College Junnar ERP system is online and database is healthy.',
        panel: 'overview',
        date: new Date()
      });

      activeNotifications = list;
      renderNotifications();
    } catch (err) {
      console.error('Error loading notifications:', err);
    }
  }

  function renderNotifications() {
    const readIds = dbReadNotifications;
    const unread = activeNotifications.filter(n => !readIds.includes(n.id));

    // Update badge
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (unread.length > 0) {
        badge.textContent = unread.length;
        badge.style.display = 'block';
      } else {
        badge.style.display = 'none';
      }
    }

    const notifList = document.getElementById('notif-list');
    if (!notifList) return;

    if (activeNotifications.length === 0) {
      notifList.innerHTML = '<div class="notif-empty" style="padding: 1rem; text-align: center; color: var(--muted); font-size: 0.82rem;">No new notifications</div>';
      return;
    }

    notifList.innerHTML = '';
    activeNotifications.forEach(n => {
      const isRead = readIds.includes(n.id);
      const div = document.createElement('div');
      div.className = `notif-item ${isRead ? 'read' : 'unread'}`;
      div.style.padding = '0.6rem 1rem';
      div.style.borderBottom = '1px solid var(--card-border)';
      div.style.cursor = 'pointer';
      div.style.background = isRead ? 'transparent' : 'var(--primary-muted)';
      div.style.display = 'flex';
      div.style.flexDirection = 'column';
      div.style.gap = '0.15rem';

      const timeStr = n.date ? new Date(n.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

      div.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.72rem; font-weight: 600; color: var(--primary);">
          <span>${esc(n.category)}</span>
          ${isRead ? '' : '<span style="width: 6px; height: 6px; border-radius: 50%; background: var(--primary);"></span>'}
        </div>
        <div style="font-size: 0.8rem; color: var(--text); line-height: 1.25;">${esc(n.text)}</div>
        <div style="font-size: 0.68rem; color: var(--muted); text-align: right; margin-top: 0.1rem;">${timeStr}</div>
      `;

      div.addEventListener('click', () => {
        markNotifRead(n.id);
        navigateToPanel(n.panel);
        document.getElementById('notif-dropdown').style.display = 'none';
      });

      notifList.appendChild(div);
    });
  }

  async function markNotifRead(id) {
    if (!dbReadNotifications.includes(id)) {
      dbReadNotifications.push(id);
      renderNotifications();
      try {
        await SSC_API.post('/admin/notifications/read', { id });
      } catch (err) {
        console.error('Failed to sync notification read status:', err);
      }
    }
  }

  async function markAllNotifsRead() {
    const idsToMark = [];
    activeNotifications.forEach(n => {
      if (!dbReadNotifications.includes(n.id)) {
        dbReadNotifications.push(n.id);
        idsToMark.push(n.id);
      }
    });
    renderNotifications();
    if (idsToMark.length > 0) {
      try {
        await SSC_API.post('/admin/notifications/read', { ids: idsToMark });
      } catch (err) {
        console.error('Failed to sync bulk notification read status:', err);
      }
    }
  }

  function navigateToPanel(panelId) {
    const allBtns = document.querySelectorAll('.dash-nav button[data-panel]');
    allBtns.forEach(b => {
      b.classList.remove('active');
      b.removeAttribute('aria-current');
    });
    const target = document.querySelector(`.dash-nav button[data-panel="${panelId}"]`);
    if (target) {
      target.classList.add('active');
      target.setAttribute('aria-current', 'page');
    }
    document.querySelectorAll('.dash-panel').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-panel') === panelId);
    });
    const titleEl = document.getElementById('dash-title');
    if (target && titleEl) titleEl.textContent = target.textContent.trim();
    loadPanel(panelId);
  }

  function setupGlobalSearch() {
    const input = document.getElementById('global-search');
    const resultsEl = document.getElementById('search-results');
    if (!input || !resultsEl) return;

    let debounce = null;
    input.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => runSearch(input.value.trim()), 200);
    });
    input.addEventListener('focus', () => { if (input.value.trim()) runSearch(input.value.trim()); });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#global-search-wrap')) resultsEl.classList.remove('visible');
    });

    function runSearch(q) {
      if (!q || q.length < 2) { resultsEl.classList.remove('visible'); return; }
      if (!searchLoaded) { resultsEl.innerHTML = '<div class="search-results-empty">Loading data...</div>'; resultsEl.classList.add('visible'); return; }
      const lq = q.toLowerCase();
      const results = [];

      // Search students
      searchIndex.students.filter(s => (s.name || '').toLowerCase().includes(lq) || (s.email || '').toLowerCase().includes(lq))
        .slice(0, 4).forEach(s => results.push({ group: 'Students', panel: 'students', id: s._id || s.id, label: s.name, sub: s.email }));

      // Search teachers
      searchIndex.teachers.filter(t => (t.name || '').toLowerCase().includes(lq) || (t.email || '').toLowerCase().includes(lq))
        .slice(0, 4).forEach(t => results.push({ group: 'Faculty', panel: 'teachers', id: t._id || t.id, label: t.name, sub: t.email }));

      // Search admissions
      searchIndex.admissions.filter(a => (a.fullName || a.name || '').toLowerCase().includes(lq) || (a.coursePref || '').toLowerCase().includes(lq))
        .slice(0, 3).forEach(a => results.push({ group: 'Admissions', panel: 'admissions', label: a.fullName || a.name || 'Application', sub: a.coursePref || a.status || '' }));

      // Search notices
      searchIndex.notices.filter(n => (n.title || '').toLowerCase().includes(lq) || (n.body || '').toLowerCase().includes(lq))
        .slice(0, 3).forEach(n => results.push({ group: 'Notices', panel: 'notices', label: n.title, sub: '' }));

      // Search courses
      searchIndex.courses.filter(c => (c.name || '').toLowerCase().includes(lq) || (c.code || '').toLowerCase().includes(lq))
        .slice(0, 3).forEach(c => results.push({ group: 'Courses', panel: 'courses', label: c.name, sub: c.code || '' }));

      // Search departments
      searchIndex.departments.filter(d => (d.name || '').toLowerCase().includes(lq))
        .slice(0, 3).forEach(d => results.push({ group: 'Departments', panel: 'departments', label: d.name, sub: '' }));

      if (results.length === 0) {
        resultsEl.innerHTML = '<div class="search-results-empty">No results found</div>';
      } else {
        const grouped = {};
        results.forEach(r => { (grouped[r.group] = grouped[r.group] || []).push(r); });
        let html = '';
        for (const [group, items] of Object.entries(grouped)) {
          html += `<div class="search-result-group"><div class="search-result-group-label">${esc(group)}</div>`;
          items.forEach(item => {
            html += `<div class="search-result-item" data-panel="${item.panel}" data-id="${item.id || ''}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span>${esc(item.label)}${item.sub ? ' <span style="color:var(--muted);font-size:0.78rem;">— ' + esc(item.sub) + '</span>' : ''}</span>
            </div>`;
          });
          html += '</div>';
        }
        resultsEl.innerHTML = html;
        resultsEl.querySelectorAll('.search-result-item').forEach(el => {
          el.addEventListener('click', () => {
            const panel = el.dataset.panel;
            const id = el.dataset.id;
            if (panel === 'students' && id) {
              openStudentProfile(id);
            } else if (panel === 'teachers' && id) {
              openTeacherProfile(id);
            } else {
              navigateToPanel(panel);
            }
            resultsEl.classList.remove('visible');
            input.value = '';
          });
        });
      }
      resultsEl.classList.add('visible');
    }
  }

  async function boot() {
    setupGateForm();
    initStudentProfileTabs();
    initTeacherProfileTabs();
    if (!SSC_API.token()) {
      showGate();
      return;
    }
    try {
      const { user } = await SSC_API.get('/auth/me');
      if (String(user.role || '').toLowerCase() !== 'admin') {
        SSC_API.setToken(null);
        showGate();
        return;
      }
      showShell();
      // Update topbar profile
      const nameEl = document.getElementById('admin-user');
      if (nameEl) nameEl.textContent = user.name || 'Admin';
      const avatarEl = document.getElementById('admin-avatar');
      if (avatarEl) avatarEl.textContent = (user.name || 'A').charAt(0).toUpperCase();

      loadNotifications();
    } catch {
      SSC_API.setToken(null);
      showGate();
      return;
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
      SSC_API.setToken(null);
      showGate();
    });

    const notifBtn = document.getElementById('topbar-notif-btn');
    const notifDropdown = document.getElementById('notif-dropdown');
    if (notifBtn && notifDropdown) {
      notifBtn.setAttribute('aria-expanded', 'false');
      notifBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = notifDropdown.style.display === 'none' ? 'block' : 'none';
        notifDropdown.style.display = isShown;
        notifBtn.setAttribute('aria-expanded', isShown === 'block' ? 'true' : 'false');
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('.topbar-notif-wrap')) {
          notifDropdown.style.display = 'none';
          notifBtn.setAttribute('aria-expanded', 'false');
        }
      });
    }

    const clearBtn = document.getElementById('notif-clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        markAllNotifsRead();
      });
    }

    // Sidebar navigation — support multiple .dash-nav groups
    document.querySelectorAll('.dash-nav button[data-panel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dash-nav button[data-panel]').forEach((b) => {
          b.classList.remove('active');
          b.removeAttribute('aria-current');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-current', 'page');
        const id = btn.getAttribute('data-panel');
        document.querySelectorAll('.dash-panel').forEach((p) => {
          p.classList.toggle('active', p.getAttribute('data-panel') === id);
        });
        document.getElementById('dash-title').textContent = btn.textContent.trim();
        loadPanel(id);
      });
    });

    // Quick actions navigation
    document.querySelectorAll('.quick-action-btn[data-goto]').forEach(btn => {
      btn.addEventListener('click', () => navigateToPanel(btn.dataset.goto));
    });

    // Mobile menu toggle
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.dash-side');
    if (mobileBtn && sidebar) {
      if (window.innerWidth <= 900) mobileBtn.style.display = '';
      window.addEventListener('resize', () => { mobileBtn.style.display = window.innerWidth <= 900 ? '' : 'none'; });
      mobileBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
      // Close sidebar when clicking a nav button on mobile
      document.querySelectorAll('.dash-nav button[data-panel]').forEach(btn => {
        btn.addEventListener('click', () => { if (window.innerWidth <= 900) sidebar.classList.remove('open'); });
      });
    }

    // Global search
    setupGlobalSearch();

    loadPanel('overview');

    // Build search index in background
    buildSearchIndex();

    document.getElementById('btn-export-csv').addEventListener('click', exportCSV);
    document.getElementById('btn-export-excel').addEventListener('click', exportExcel);
    document.getElementById('btn-print-att').addEventListener('click', printReport);
  }

  async function loadPanel(id) {
    msg('');
    try {
      if (id === 'overview') await loadStats();
      if (id === 'students') await loadStudents();
      if (id === 'teachers') await loadTeachers();
      if (id === 'admissions') await loadAdmissions();
      if (id === 'notices') await loadNotices();
      if (id === 'departments') await loadDepartments();
      if (id === 'courses') await loadCourses();
      if (id === 'gallery') await loadGalleryAdmin();
      if (id === 'feedback') await loadFeedback();
      if (id === 'study-materials') await loadStudyMaterials();
      if (id === 'attendance-analytics') await loadAttendanceAnalytics();
      if (id === 'placement') await loadPlacementPanel();
      if (id === 'timetable') await loadTimetablePanel();
      if (id === 'library') await loadLibraryPanel();
      if (id === 'exams') await loadExamsPanel();
      if (id === 'leaves') await loadLeavesPanel();
      if (id === 'settings') await loadSettings();
    } catch (e) {
      msg(e.message || 'Load failed', true);
    }
  }

  async function loadStats() {
    const s = await SSC_API.get('/admin/dashboard/stats');
    const grid = document.getElementById('stat-grid');
    const accepted = s.totalAdmissions - s.pendingAdmissions;
    const acceptRate = s.totalAdmissions > 0 ? Math.round((accepted / s.totalAdmissions) * 100) : 0;

    grid.innerHTML = `
      <div class="stat-card">
        <div class="stat-card-header">
          <div><span class="small">Total Students</span><strong>${s.students}</strong></div>
          <div class="stat-card-icon indigo">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div><span class="small">Faculty Members</span><strong>${s.teachers}</strong></div>
          <div class="stat-card-icon green">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div><span class="small">Total Admissions</span><strong>${s.totalAdmissions}</strong></div>
          <div class="stat-card-icon indigo">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div><span class="small">Pending</span><strong>${s.pendingAdmissions}</strong></div>
          <div class="stat-card-icon ${s.pendingAdmissions > 0 ? 'amber' : 'green'}">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div><span class="small">Published Notices</span><strong>${s.noticesCount}</strong></div>
          <div class="stat-card-icon indigo">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          </div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-card-header">
          <div><span class="small">Feedback</span><strong>${s.feedbackCount}</strong></div>
          <div class="stat-card-icon green">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
        </div>
      </div>
    `;

    // ── Load dashboard widgets with real data ──────────────
    loadAdmissionsTrend(s);
    loadCourseDistribution();
    loadRecentNotices();
    loadRecentAdmissions();
    loadAttendanceSummary();
  }

  /* ── Dashboard Widget: Admissions Overview ─────────────── */
  async function loadAdmissionsTrend(stats) {
    const el = document.getElementById('admissions-trend-content');
    if (!el) return;
    try {
      const admissions = await SSC_API.get('/admin/admissions');
      const total = admissions.length;
      const pending = admissions.filter(a => String(a.status || '').toLowerCase() === 'pending').length;
      const approved = admissions.filter(a => String(a.status || '').toLowerCase() === 'approved').length;
      const rejected = admissions.filter(a => String(a.status || '').toLowerCase() === 'rejected').length;
      const pendingPct = total ? Math.round((pending / total) * 100) : 0;
      const approvedPct = total ? Math.round((approved / total) * 100) : 0;
      const rejectedPct = total ? Math.round((rejected / total) * 100) : 0;

      el.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:0.75rem;">
          <div><span class="small">Approved</span><div style="font-size:1.15rem;font-weight:700;color:var(--accent);">${approved}</div></div>
          <div><span class="small">Pending</span><div style="font-size:1.15rem;font-weight:700;color:var(--warning);">${pending}</div></div>
          <div><span class="small">Rejected</span><div style="font-size:1.15rem;font-weight:700;color:var(--danger);">${rejected}</div></div>
        </div>
        <div class="analytics-bar">
          <div class="analytics-bar-fill" style="width:${approvedPct}%;background:var(--accent);"></div>
          <div class="analytics-bar-fill" style="width:${pendingPct}%;background:var(--warning);"></div>
          <div class="analytics-bar-fill" style="width:${rejectedPct}%;background:var(--danger);"></div>
        </div>
        <div style="display:flex;gap:1rem;margin-top:0.65rem;">
          <span class="small" style="display:flex;align-items:center;gap:0.3rem;"><span style="width:8px;height:8px;border-radius:50%;background:var(--accent);"></span> ${approvedPct}% Approved</span>
          <span class="small" style="display:flex;align-items:center;gap:0.3rem;"><span style="width:8px;height:8px;border-radius:50%;background:var(--warning);"></span> ${pendingPct}% Pending</span>
          <span class="small" style="display:flex;align-items:center;gap:0.3rem;"><span style="width:8px;height:8px;border-radius:50%;background:var(--danger);"></span> ${rejectedPct}% Rejected</span>
        </div>
      `;
    } catch { el.innerHTML = '<p class="small">Unable to load admissions data</p>'; }
  }

  /* ── Dashboard Widget: Course Distribution ─────────────── */
  async function loadCourseDistribution() {
    const el = document.getElementById('course-dist-content');
    if (!el) return;
    try {
      const students = await SSC_API.get('/admin/students');
      const courseMap = {};
      students.forEach(s => {
        const course = (s.studentProfile && s.studentProfile.courseName) || 'Unassigned';
        courseMap[course] = (courseMap[course] || 0) + 1;
      });
      const sorted = Object.entries(courseMap).sort((a, b) => b[1] - a[1]);
      const total = students.length || 1;
      const colors = ['var(--primary)', 'var(--accent)', 'var(--warning)', '#8b5cf6', '#ec4899', '#06b6d4'];

      if (sorted.length === 0) {
        el.innerHTML = '<p class="small">No course data available</p>';
        return;
      }

      let html = '';
      sorted.slice(0, 6).forEach(([name, count], i) => {
        const pct = Math.round((count / total) * 100);
        const color = colors[i % colors.length];
        html += `
          <div style="margin-bottom:0.65rem;">
            <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
              <span class="small" style="font-weight:500;color:var(--text);">${esc(name)}</span>
              <span class="small">${count} students (${pct}%)</span>
            </div>
            <div class="analytics-bar"><div class="analytics-bar-fill" style="width:${pct}%;background:${color};"></div></div>
          </div>
        `;
      });
      el.innerHTML = html;
    } catch { el.innerHTML = '<p class="small">Unable to load course data</p>'; }
  }

  /* ── Dashboard Widget: Recent Notices ──────────────────── */
  async function loadRecentNotices() {
    const el = document.getElementById('recent-notices-content');
    if (!el) return;
    try {
      const notices = await SSC_API.get('/admin/notices');
      const recent = notices.slice(0, 5);
      if (recent.length === 0) {
        el.innerHTML = '<p class="small">No notices published yet</p>';
        return;
      }
      let html = '';
      recent.forEach(n => {
        const date = n.createdAt ? new Date(n.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
        html += `
          <div class="notice-feed-item">
            <span class="notice-feed-dot"></span>
            <div class="notice-feed-content">
              <p class="notice-feed-title">${esc(n.title)}</p>
              <span class="notice-feed-meta">${date}</span>
            </div>
          </div>
        `;
      });
      el.innerHTML = html;
    } catch { el.innerHTML = '<p class="small">Unable to load notices</p>'; }
  }

  /* ── Dashboard Widget: Recent Admissions Table ─────────── */
  async function loadRecentAdmissions() {
    const el = document.getElementById('recent-admissions-content');
    if (!el) return;
    try {
      const admissions = await SSC_API.get('/admin/admissions');
      const recent = admissions.slice(0, 5);
      if (recent.length === 0) {
        el.innerHTML = '<p class="small">No admission applications yet</p>';
        return;
      }
      let html = '<table class="table small"><thead><tr><th>Name</th><th>Course</th><th>Status</th></tr></thead><tbody>';
      recent.forEach(a => {
        const status = String(a.status || 'pending').toLowerCase();
        const statusColor = status === 'approved' ? 'var(--accent)' : status === 'rejected' ? 'var(--danger)' : 'var(--warning)';
        html += `<tr>
          <td>${esc(a.fullName || a.name || '—')}</td>
          <td>${esc(a.coursePref || '—')}</td>
          <td><span style="color:${statusColor};font-weight:600;text-transform:capitalize;">${status}</span></td>
        </tr>`;
      });
      html += '</tbody></table>';
      el.innerHTML = html;
    } catch { el.innerHTML = '<p class="small">Unable to load admissions</p>'; }
  }

  /* ── Dashboard Widget: Attendance Summary ──────────────── */
  async function loadAttendanceSummary() {
    const el = document.getElementById('attendance-summary-content');
    if (!el) return;
    try {
      const [analytics, settings] = await Promise.all([
        SSC_API.get('/admin/attendance/analytics'),
        SSC_API.get('/public/settings').catch(() => ({}))
      ]);
      const threshold = settings && settings.attendanceThreshold !== undefined ? Number(settings.attendanceThreshold) : 75;
      
      const lowAttendance = analytics && analytics.lowAttendanceList ? analytics.lowAttendanceList : [];

      if (lowAttendance.length === 0) {
        el.innerHTML = `
          <div style="text-align:center;padding:1rem 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <p class="small mt-2" style="color:var(--accent);font-weight:600;">All students above ${threshold}% attendance</p>
            <p class="small">No low attendance alerts at this time.</p>
          </div>
        `;
        return;
      }

      let html = '<table class="table small"><thead><tr><th>Student</th><th>Class</th><th>Attendance</th></tr></thead><tbody>';
      lowAttendance.slice(0, 5).forEach(s => {
        const att = Number(s.percentage);
        const color = att < threshold ? 'var(--danger)' : 'var(--warning)';
        html += `<tr>
          <td>${esc(s.name)}</td>
          <td>${esc(s.className || '—')}</td>
          <td><span style="color:${color};font-weight:600;">${att}%</span></td>
        </tr>`;
      });
      html += '</tbody></table>';
      el.innerHTML = html;
    } catch { el.innerHTML = '<p class="small">Attendance data not available</p>'; }
  }

  const randPass = () => 'SSC' + Math.random().toString(36).slice(2, 8).toUpperCase() + '!';

  // ── Student Modals & Bindings ─────────────────────────────
  async function loadStudents() {
    const rows = await SSC_API.get('/admin/students');
    const tb = document.querySelector('#tbl-students tbody');
    tb.innerHTML = '';
    rows.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Name"><a href="#" class="student-name-click text-primary" style="font-weight:600;" data-sid="${u._id || u.id}">${esc(u.name)}</a></td>
        <td data-label="Email">${esc(u.email)}</td>
        <td data-label="Class">${esc(u.studentProfile?.className || '')}</td>
        <td data-label="Actions">
          <button class="btn small" data-edit-student="${u._id || u.id}">Edit</button>
          <button class="btn small danger" data-del-student="${u._id || u.id}">Delete</button>
        </td>`;
      tb.appendChild(tr);
    });

    tb.querySelectorAll('.student-name-click').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openStudentProfile(a.getAttribute('data-sid'));
      });
    });

    tb.querySelectorAll('[data-edit-student]').forEach((b) =>
      b.addEventListener('click', () => {
        openStudentProfile(b.getAttribute('data-edit-student'));
      })
    );

    tb.querySelectorAll('[data-del-student]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this student?')) return;
        try {
          await SSC_API.delete('/admin/students/' + b.getAttribute('data-del-student'));
          msg('Student deleted successfully');
          await loadStudents();
          await buildSearchIndex();
        } catch (err) {
          showModalAlert(err.message || 'Delete failed', 'Error');
        }
      })
    );
  }

  function initStudentProfileTabs() {
    const modal = document.getElementById('modal-student-profile');
    if (!modal) return;
    const tabs = modal.querySelectorAll('.id-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-prof-tab');
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelectorAll('.prof-tab-content').forEach((sect) => {
          sect.style.display = 'none';
        });
        const sect = document.getElementById(`prof-sect-${tabName}`);
        if (sect) {
          sect.style.display = 'block';
        }
      });
    });
  }

  function initTeacherProfileTabs() {
    const modal = document.getElementById('modal-teacher-profile');
    if (!modal) return;
    const tabs = modal.querySelectorAll('.id-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-teach-prof-tab');
        tabs.forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        modal.querySelectorAll('.teach-prof-tab-content').forEach((sect) => {
          sect.style.display = 'none';
        });
        const sect = document.getElementById(`teach-prof-sect-${tabName}`);
        if (sect) {
          sect.style.display = 'block';
        }
      });
    });
  }

  async function openStudentProfile(id) {
    const modal = document.getElementById('modal-student-profile');
    if (!modal) return;
    
    // Switch to details tab initially
    const tabs = modal.querySelectorAll('.id-tab');
    tabs.forEach(t => {
      if (t.getAttribute('data-prof-tab') === 'details') {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    modal.querySelectorAll('.prof-tab-content').forEach(sect => {
      sect.style.display = sect.id === 'prof-sect-details' ? 'block' : 'none';
    });
    
    // Show placeholder loading states
    document.getElementById('prof-details-name').textContent = 'Loading...';
    document.getElementById('prof-details-erp-id').textContent = 'Loading...';
    document.getElementById('prof-details-roll').textContent = 'Loading...';
    document.getElementById('prof-details-course').textContent = 'Loading...';
    document.getElementById('prof-details-class').textContent = 'Loading...';
    document.getElementById('prof-details-email').textContent = 'Loading...';
    document.getElementById('prof-details-phone').textContent = 'Loading...';
    document.getElementById('prof-details-bio').textContent = 'Loading...';
    
    document.getElementById('prof-details-avatar-placeholder').style.display = 'grid';
    document.getElementById('prof-details-avatar-img').style.display = 'none';
    
    // Clear lists
    document.querySelector('#tbl-prof-attendance tbody').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading attendance...</td></tr>';
    document.querySelector('#tbl-prof-marks tbody').innerHTML = '<tr><td colspan="5" class="text-center text-muted">Loading marks...</td></tr>';
    document.querySelector('#tbl-prof-placements tbody').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading placement history...</td></tr>';
    
    modal.style.display = 'flex';
    
    try {
      const data = await SSC_API.get(`/admin/students/${id}/history`);
      const s = data.student;
      const sp = s.studentProfile || {};
      
      // Populate Details tab
      document.getElementById('prof-details-name').textContent = s.name || '—';
      document.getElementById('prof-details-erp-id').textContent = sp.studentId || s.id || '—';
      document.getElementById('prof-details-roll').textContent = sp.rollNumber || '—';
      document.getElementById('prof-details-course').textContent = sp.courseName || sp.course || '—';
      document.getElementById('prof-details-class').textContent = sp.className || '—';
      document.getElementById('prof-details-email').textContent = s.email || '—';
      document.getElementById('prof-details-phone').textContent = s.phone || '—';
      document.getElementById('prof-details-bio').textContent = s.bio || '—';
      
      const avatarPlaceholder = document.getElementById('prof-details-avatar-placeholder');
      const avatarImg = document.getElementById('prof-details-avatar-img');
      if (s.avatarUrl) {
        avatarImg.src = s.avatarUrl;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        avatarPlaceholder.style.display = 'grid';
        avatarPlaceholder.textContent = (s.name || 'S').charAt(0).toUpperCase();
      }
      
      // Populate Attendance tab
      const att = data.attendance || [];
      const totalDays = att.length;
      const presentDays = att.filter(a => a.status === 'present').length;
      const attRate = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;
      
      document.getElementById('prof-att-total').textContent = totalDays;
      document.getElementById('prof-att-present').textContent = presentDays;
      document.getElementById('prof-att-rate').textContent = `${attRate}%`;
      
      const attTbody = document.querySelector('#tbl-prof-attendance tbody');
      if (totalDays === 0) {
        attTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No attendance log recorded.</td></tr>';
      } else {
        attTbody.innerHTML = att.map(a => `
          <tr>
            <td data-label="Date">${new Date(a.date).toLocaleDateString()}</td>
            <td data-label="Status"><span class="badge ${a.status === 'present' ? 'success' : 'danger'}">${a.status}</span></td>
            <td data-label="Subject">${esc(a.subject || '—')}</td>
            <td data-label="Marked By">${esc(a.markedByTeacherName || 'Teacher')}</td>
          </tr>
        `).join('');
      }
      
      // Populate Marks tab
      const marks = data.marks || [];
      const marksTbody = document.querySelector('#tbl-prof-marks tbody');
      if (marks.length === 0) {
        marksTbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No marks recorded.</td></tr>';
      } else {
        marksTbody.innerHTML = marks.map(m => {
          const pct = m.maxMarks > 0 ? Math.round((m.marksObtained / m.maxMarks) * 100) : 0;
          return `
            <tr>
              <td data-label="Subject">${esc(m.subject)}</td>
              <td data-label="Exam Name">${esc(m.examName)}</td>
              <td data-label="Marks Obtained">${m.marksObtained}</td>
              <td data-label="Max Marks">${m.maxMarks}</td>
              <td data-label="Percentage">${pct}%</td>
            </tr>
          `;
        }).join('');
      }
      
      // Populate Placement tab
      const placements = data.placementApplications || [];
      const plTbody = document.querySelector('#tbl-prof-placements tbody');
      if (placements.length === 0) {
        plTbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No placement drive applications.</td></tr>';
      } else {
        plTbody.innerHTML = placements.map(p => `
          <tr>
            <td data-label="Company">${esc(p.drive?.companyName || '—')}</td>
            <td data-label="Role">${esc(p.drive?.roleName || '—')}</td>
            <td data-label="Date">${new Date(p.appliedAt).toLocaleDateString()}</td>
            <td data-label="Status"><span class="badge ${p.applicationStatus === 'selected' ? 'success' : p.applicationStatus === 'rejected' ? 'danger' : 'info'}">${p.applicationStatus}</span></td>
          </tr>
        `).join('');
      }
      
      const editBtn = document.getElementById('btn-prof-edit-student');
      if (editBtn) {
        editBtn.onclick = () => {
          modal.style.display = 'none';
          const editFormModal = document.getElementById('modal-edit-student');
          if (editFormModal) {
            document.getElementById('edit-student-id').value = s._id || s.id;
            document.getElementById('edit-student-name').value = s.name || '';
            document.getElementById('edit-student-erp-id').value = sp.studentId || '';
            document.getElementById('edit-student-email').value = s.email || '';
            document.getElementById('edit-student-personal-email').value = sp.personalEmail || '';
            document.getElementById('edit-student-phone').value = s.phone || '';
            document.getElementById('edit-student-class').value = sp.className || '';
            document.getElementById('edit-student-roll').value = sp.rollNumber || '';
            document.getElementById('edit-student-course').value = sp.courseName || '';
            document.getElementById('edit-student-year').value = sp.year || '';
            document.getElementById('edit-student-division').value = sp.division || '';
            document.getElementById('edit-student-password').value = '';
            editFormModal.style.display = 'flex';
          }
        };
      }
    } catch (err) {
      document.getElementById('prof-details-name').textContent = 'Error';
      msg('Failed to fetch student details: ' + err.message, true);
    }
  }

  async function openTeacherProfile(id) {
    const modal = document.getElementById('modal-teacher-profile');
    if (!modal) return;
    
    // Switch to details tab initially
    const tabs = modal.querySelectorAll('.id-tab');
    tabs.forEach(t => {
      if (t.getAttribute('data-teach-prof-tab') === 'details') {
        t.classList.add('active');
      } else {
        t.classList.remove('active');
      }
    });
    modal.querySelectorAll('.teach-prof-tab-content').forEach(sect => {
      sect.style.display = sect.id === 'teach-prof-sect-details' ? 'block' : 'none';
    });
    
    // Show placeholder loading states
    document.getElementById('teach-prof-name').textContent = 'Loading...';
    document.getElementById('teach-prof-erp-id').textContent = 'Loading...';
    document.getElementById('teach-prof-dept').textContent = 'Loading...';
    document.getElementById('teach-prof-desg').textContent = 'Loading...';
    document.getElementById('teach-prof-qual').textContent = 'Loading...';
    document.getElementById('teach-prof-email').textContent = 'Loading...';
    document.getElementById('teach-prof-phone').textContent = 'Loading...';
    document.getElementById('teach-prof-bio').textContent = 'Loading...';
    
    document.getElementById('teach-prof-avatar-placeholder').style.display = 'grid';
    document.getElementById('teach-prof-avatar-img').style.display = 'none';
    
    // Clear lists
    document.querySelector('#tbl-teach-prof-subjects tbody').innerHTML = '<tr><td colspan="2" class="text-center text-muted">Loading subjects...</td></tr>';
    document.querySelector('#tbl-teach-prof-attendance tbody').innerHTML = '<tr><td colspan="3" class="text-center text-muted">Loading attendance...</td></tr>';
    document.querySelector('#tbl-teach-prof-leaves tbody').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading leaves...</td></tr>';
    document.querySelector('#tbl-teach-prof-materials tbody').innerHTML = '<tr><td colspan="4" class="text-center text-muted">Loading study materials...</td></tr>';
    
    modal.style.display = 'flex';
    
    try {
      const data = await SSC_API.get(`/admin/teachers/${id}/history`);
      const t = data.teacher;
      const tp = t.teacherProfile || {};
      
      // Populate Details tab
      document.getElementById('teach-prof-name').textContent = t.name || '—';
      document.getElementById('teach-prof-erp-id').textContent = tp.employeeId || tp.teacherId || t.id || '—';
      document.getElementById('teach-prof-dept').textContent = tp.department || '—';
      document.getElementById('teach-prof-desg').textContent = tp.designation || 'Faculty Member';
      document.getElementById('teach-prof-qual').textContent = tp.qualifications || '—';
      document.getElementById('teach-prof-email').textContent = t.email || '—';
      document.getElementById('teach-prof-phone').textContent = tp.mobile || t.phone || '—';
      document.getElementById('teach-prof-bio').textContent = t.bio || '—';
      
      const avatarPlaceholder = document.getElementById('teach-prof-avatar-placeholder');
      const avatarImg = document.getElementById('teach-prof-avatar-img');
      if (t.avatarUrl) {
        avatarImg.src = t.avatarUrl;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
      } else {
        avatarImg.style.display = 'none';
        avatarPlaceholder.style.display = 'grid';
        avatarPlaceholder.textContent = (t.name || 'T').charAt(0).toUpperCase();
      }
      
      // Populate Subjects tab
      const subjects = tp.assignments || [];
      const tblSubjects = document.querySelector('#tbl-teach-prof-subjects tbody');
      if (tblSubjects) {
        tblSubjects.innerHTML = '';
        if (!subjects.length) {
          tblSubjects.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No assigned subjects.</td></tr>';
        } else {
          subjects.forEach(a => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td><strong>${esc(a.subject)}</strong></td><td>${esc(a.className)}</td>`;
            tblSubjects.appendChild(tr);
          });
        }
      }
      
      // Populate Attendance tab
      const attendance = data.attendance || [];
      const tblAttendance = document.querySelector('#tbl-teach-prof-attendance tbody');
      if (tblAttendance) {
        tblAttendance.innerHTML = '';
        if (!attendance.length) {
          tblAttendance.innerHTML = '<tr><td colspan="3" class="text-center text-muted">No attendance logs.</td></tr>';
        } else {
          attendance.forEach(a => {
            const tr = document.createElement('tr');
            const dtStr = new Date(a.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
            const count = Array.isArray(a.entries) ? a.entries.length : 0;
            tr.innerHTML = `<td>${dtStr}</td><td><strong>${esc(a.subject)}</strong></td><td>${count} Students</td>`;
            tblAttendance.appendChild(tr);
          });
        }
      }
      
      // Populate Leaves tab
      const leaves = data.leaves || [];
      const tblLeaves = document.querySelector('#tbl-teach-prof-leaves tbody');
      if (tblLeaves) {
        tblLeaves.innerHTML = '';
        if (!leaves.length) {
          tblLeaves.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No leave requests.</td></tr>';
        } else {
          leaves.forEach(l => {
            const tr = document.createElement('tr');
            const startStr = new Date(l.startDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
            const endStr = new Date(l.endDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
            const stColor = l.status === 'approved' ? 'success' : (l.status === 'rejected' ? 'danger' : 'warning');
            tr.innerHTML = `<td>${startStr}</td><td>${endStr}</td><td>${esc(l.type)}</td><td><span class="badge ${stColor}">${esc(l.status)}</span></td>`;
            tblLeaves.appendChild(tr);
          });
        }
      }
      
      // Populate Materials tab
      const materials = data.studyMaterials || [];
      const tblMaterials = document.querySelector('#tbl-teach-prof-materials tbody');
      if (tblMaterials) {
        tblMaterials.innerHTML = '';
        if (!materials.length) {
          tblMaterials.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No uploaded study materials.</td></tr>';
        } else {
          materials.forEach(m => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td><strong>${esc(m.title)}</strong></td>
              <td>${esc(m.subject)}</td>
              <td>${esc(m.className)}</td>
              <td>${m.fileUrl ? `<a class="btn small secondary" href="${esc(m.fileUrl)}" target="_blank" style="color:var(--text); padding:0.2rem 0.5rem; font-size:0.75rem;">Download</a>` : '—'}</td>
            `;
            tblMaterials.appendChild(tr);
          });
        }
      }
      
      // Bind Edit button click to open edit modal
      const editBtn = document.getElementById('btn-prof-edit-teacher');
      if (editBtn) {
        editBtn.onclick = () => {
          modal.style.display = 'none'; // Close read-only
          
          // Trigger the teacher edit form populator
          const editFormModal = document.getElementById('modal-edit-teacher');
          if (editFormModal) {
            document.getElementById('edit-teacher-id').value = t._id || t.id;
            document.getElementById('edit-teacher-name').value = t.name || '';
            document.getElementById('edit-teacher-email').value = t.email || '';
            document.getElementById('edit-teacher-phone').value = tp.mobile || t.phone || '';
            document.getElementById('edit-teacher-dept').value = tp.department || '';
            document.getElementById('edit-teacher-designation').value = tp.designation || '';
            document.getElementById('edit-teacher-qual').value = tp.qualifications || '';
            document.getElementById('edit-teacher-exp').value = tp.experience || '';
            document.getElementById('edit-teacher-spec').value = tp.specialization || '';
            document.getElementById('edit-teacher-bio').value = t.bio || '';
            document.getElementById('edit-teacher-password').value = '';
            document.getElementById('edit-teacher-avatar').value = '';
            document.getElementById('edit-teacher-remove-avatar-flag').value = 'false';
            
            const prevImg = document.getElementById('edit-teacher-avatar-img');
            const prevPlaceholder = document.getElementById('edit-teacher-avatar-placeholder');
            const removePhotoBtn = document.getElementById('btn-edit-teacher-remove-photo');
            if (t.avatarUrl) {
              prevImg.src = t.avatarUrl;
              prevImg.style.display = 'block';
              prevPlaceholder.style.display = 'none';
              if (removePhotoBtn) removePhotoBtn.style.display = 'inline-block';
            } else {
              prevImg.src = '';
              prevImg.style.display = 'none';
              prevPlaceholder.style.display = 'grid';
              prevPlaceholder.textContent = (t.name || 'T').charAt(0).toUpperCase();
              if (removePhotoBtn) removePhotoBtn.style.display = 'none';
            }
            
            // Populate assignments list
            const asgnList = document.getElementById('edit-teacher-assignments-list');
            if (asgnList) {
              asgnList.innerHTML = '';
              const list = tp.assignments || [];
              list.forEach(a => addAssignmentRow(a.subject, a.className));
            }
            
            editFormModal.style.display = 'flex';
          }
        };
      }
    } catch (err) {
      console.error(err);
      showModalAlert('Failed to load teacher history details: ' + err.message, 'Error');
    }
  }

  // Student form bindings
  document.getElementById('form-student').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const body = {
      email: f.email.value.trim(),
      password: f.password.value,
      name: f.name.value.trim(),
      phone: f.phone.value.trim(),
      rollNumber: f.rollNumber.value.trim(),
      className: f.className.value.trim(),
      courseName: f.courseName.value.trim(),
      year: f.year.value.trim(),
    };
    try {
      await SSC_API.post('/admin/students', body);
      f.reset();
      msg('Student created');
      await loadStudents();
      await buildSearchIndex();
    } catch (err) {
      showModalAlert(err.message || 'Creation failed', 'Error');
    }
  });

  // Admissions Decision Form Submit
  const decisionForm = document.getElementById('form-admission-decision');
  if (decisionForm) {
    decisionForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('decision-app-id').value;
      const rollNumber = document.getElementById('decision-student-id').value;
      const className = document.getElementById('decision-class-name').value.trim();
      const tempPassword = document.getElementById('decision-temp-password').value;

      try {
        const data = await SSC_API.post('/admin/admissions/' + id + '/decision', {
          status: 'approved',
          createAccount: true,
          rollNumber,
          className,
          defaultPassword: tempPassword,
        });

        document.getElementById('modal-admission-decision').style.display = 'none';
        decisionForm.reset();

        if (data.studentAccount) {
          // Open credentials display modal immediately!
          document.getElementById('creds-student-id').value = data.studentAccount.studentId;
          document.getElementById('creds-college-email').value = data.studentAccount.email;
          document.getElementById('creds-temp-password').value = data.studentAccount.temporaryPassword;
          document.getElementById('creds-roll-number').value = data.studentAccount.rollNumber || '';
          document.getElementById('creds-user-id').value = data.studentAccount.userId;
          document.getElementById('modal-credentials-display').style.display = 'flex';
          msg('Admission Approved. Credentials generated.');
        } else {
          msg('Admission Approved');
        }
        await loadAdmissions();
        await buildSearchIndex();
      } catch (err) {
        showModalAlert(err.message || 'Approval decision failed', 'Error');
      }
    });
  }

  // Bind Credentials Modal Actions
  const btnCredsCopy = document.getElementById('btn-creds-copy');
  if (btnCredsCopy) {
    btnCredsCopy.addEventListener('click', () => {
      const sid = document.getElementById('creds-student-id').value;
      const email = document.getElementById('creds-college-email').value;
      const pass = document.getElementById('creds-temp-password').value;
      const roll = document.getElementById('creds-roll-number').value;
      const text = `Student ID: ${sid}\nCollege Email: ${email}\nPassword: ${pass}\nRoll Number: ${roll}`;
      navigator.clipboard.writeText(text).then(() => showModalAlert('Credentials copied to clipboard!', 'Success'));
    });
  }

  const btnCredsPrint = document.getElementById('btn-creds-print');
  if (btnCredsPrint) {
    btnCredsPrint.addEventListener('click', () => {
      const sid = document.getElementById('creds-student-id').value;
      const email = document.getElementById('creds-college-email').value;
      const pass = document.getElementById('creds-temp-password').value;
      const roll = document.getElementById('creds-roll-number').value;
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
        <head><title>New Student Credentials</title></head>
        <body style="font-family:sans-serif;padding:2rem;" onload="window.print();window.close();">
          <h2>SSC College Junnar — Student Admission Account Created</h2>
          <hr/>
          <p><strong>Generated Student ID:</strong> ${sid}</p>
          <p><strong>Official Email (Login ID):</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${pass}</p>
          <p><strong>Academic Roll Number:</strong> ${roll}</p>
          <p style="font-size:0.9rem;color:#555;margin-top:2rem;">Keep these credentials secure. Please change your password upon first login.</p>
        </body>
        </html>
      `);
      win.document.close();
    });
  }

  const btnCredsResend = document.getElementById('btn-creds-resend');
  if (btnCredsResend) {
    btnCredsResend.addEventListener('click', async () => {
      const userId = document.getElementById('creds-user-id').value;
      if (!userId) return;
      try {
        await SSC_API.post(`/admin/students/${userId}/resend-credentials`);
        showModalAlert('Credentials email sent successfully!', 'Credentials Sent');
      } catch (err) {
        showModalAlert(err.message || 'Failed to resend credentials', 'Error');
      }
    });
  }

  // Admissions Reject Form Submit
  const rejectForm = document.getElementById('form-admission-reject');
  if (rejectForm) {
    rejectForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('reject-app-id').value;
      const notes = document.getElementById('reject-notes').value.trim();

      try {
        await SSC_API.post('/admin/admissions/' + id + '/decision', {
          status: 'rejected',
          notes,
        });

        document.getElementById('modal-admission-reject').style.display = 'none';
        rejectForm.reset();
        msg('Admission Rejected successfully');
        await loadAdmissions();
        await buildSearchIndex();
      } catch (err) {
        showModalAlert(err.message || 'Rejection decision failed', 'Error');
      }
    });
  }

  // Edit Student Form Submit
  const editStudentForm = document.getElementById('form-edit-student');
  if (editStudentForm) {
    editStudentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-student-id').value;
      const email = document.getElementById('edit-student-email').value.trim();
      const name = document.getElementById('edit-student-name').value.trim();
      const phone = document.getElementById('edit-student-phone').value.trim();
      const personalEmail = document.getElementById('edit-student-personal-email').value.trim();
      const className = document.getElementById('edit-student-class').value.trim();
      const rollNumber = document.getElementById('edit-student-roll').value.trim();
      const courseName = document.getElementById('edit-student-course').value.trim();
      const year = document.getElementById('edit-student-year').value.trim();
      const division = document.getElementById('edit-student-division').value.trim();
      const password = document.getElementById('edit-student-password').value;

      const payload = {
        name,
        email,
        phone,
        studentProfile: {
          personalEmail,
          className,
          rollNumber,
          courseName,
          year,
          division
        }
      };
      if (password) payload.password = password;

      try {
        await SSC_API.patch('/admin/students/' + id, payload);
        msg('Student updated successfully');
        document.getElementById('modal-edit-student').style.display = 'none';
        editStudentForm.reset();
        await loadStudents();
        await buildSearchIndex();
      } catch (err) {
        showModalAlert(err.message || 'Update failed', 'Error');
      }
    });

    document.getElementById('btn-student-gen-pass').addEventListener('click', () => {
      document.getElementById('edit-student-password').value = randPass();
    });

    document.getElementById('btn-student-copy-creds').addEventListener('click', () => {
      const email = document.getElementById('edit-student-email').value;
      const name = document.getElementById('edit-student-name').value;
      const erpId = document.getElementById('edit-student-erp-id').value;
      const roll = document.getElementById('edit-student-roll').value;
      const pass = document.getElementById('edit-student-password').value || '(Keep existing)';
      const text = `Name: ${name}\nStudent ID: ${erpId}\nEmail: ${email}\nPassword: ${pass}\nRoll Number: ${roll}`;
      navigator.clipboard.writeText(text).then(() => showModalAlert('Credentials copied to clipboard!', 'Success'));
    });

    document.getElementById('btn-student-print-creds').addEventListener('click', () => {
      const email = document.getElementById('edit-student-email').value;
      const name = document.getElementById('edit-student-name').value;
      const erpId = document.getElementById('edit-student-erp-id').value;
      const roll = document.getElementById('edit-student-roll').value;
      const pass = document.getElementById('edit-student-password').value || '(Keep existing)';
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
        <head><title>Student Credentials</title></head>
        <body style="font-family:sans-serif;padding:2rem;" onload="window.print();window.close();">
          <h2>SSC College Junnar — Student Credentials</h2>
          <hr/>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Student ID (ERP ID):</strong> ${erpId}</p>
          <p><strong>Official Email (Login ID):</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${pass}</p>
          <p><strong>Academic Roll Number:</strong> ${roll}</p>
          <p style="font-size:0.9rem;color:#555;margin-top:2rem;">Note: Keep these credentials secure. Please change your password upon first login.</p>
        </body>
        </html>
      `);
      win.document.close();
    });

    const resendBtn = document.getElementById('btn-student-resend-creds');
    if (resendBtn) {
      resendBtn.addEventListener('click', async () => {
        const id = document.getElementById('edit-student-id').value;
        if (!id) return;
        try {
          await SSC_API.post(`/admin/students/${id}/resend-credentials`);
          showModalAlert('Credentials email sent successfully!', 'Credentials Sent');
        } catch (err) {
          showModalAlert(err.message || 'Failed to resend credentials', 'Error');
        }
      });
    }
  }

  // ── Faculty Modals & Bindings ─────────────────────────────
  function addAssignmentRow(subject = '', className = '') {
    const list = document.getElementById('edit-teacher-assignments-list');
    const row = document.createElement('div');
    row.className = 'assignment-edit-row';
    row.style.display = 'flex';
    row.style.gap = '0.5rem';
    row.style.alignItems = 'center';
    row.innerHTML = `
      <input class="input small assignment-subject" placeholder="Subject" value="${esc(subject)}" style="flex: 1;" required/>
      <input class="input small assignment-class" placeholder="Class" value="${esc(className)}" style="flex: 1;" required/>
      <button type="button" class="btn small danger remove-asgn-btn" style="padding: 0.4rem 0.6rem; margin: 0;">&times;</button>
    `;
    row.querySelector('.remove-asgn-btn').addEventListener('click', () => row.remove());
    list.appendChild(row);
  }

  const addAsgnBtn = document.getElementById('edit-teacher-add-assignment-btn');
  if (addAsgnBtn) {
    addAsgnBtn.addEventListener('click', () => addAssignmentRow('', ''));
  }

  async function loadTeachers() {
    const rows = await SSC_API.get('/admin/teachers');
    const tb = document.querySelector('#tbl-teachers tbody');
    tb.innerHTML = '';
    rows.forEach((u) => {
      const tr = document.createElement('tr');
      const assignments = u.teacherProfile?.assignments || [];
      const badges = Array.isArray(assignments)
        ? assignments.map(a => `<span class="assignment-badge">${esc(a.subject)} • ${esc(a.className)}</span>`).join(' ')
        : '';
      tr.innerHTML = `
        <td data-label="Name"><a href="#" class="teacher-name-click text-primary" style="font-weight:600;" data-tid="${u._id || u.id}">${esc(u.name)}</a></td>
        <td data-label="Email">${esc(u.email)}</td>
        <td data-label="Department">${esc(u.teacherProfile?.department || '')}</td>
        <td data-label="Assigned Classes"><div style="display:flex;flex-wrap:wrap;gap:0.25rem;">${badges}</div></td>
        <td data-label="Actions">
          <button class="btn small" data-edit-teacher="${u._id || u.id}">Edit</button>
          <button class="btn small danger" data-del-teacher="${u._id || u.id}">Delete</button>
        </td>`;
      tb.appendChild(tr);
    });

    tb.querySelectorAll('.teacher-name-click').forEach((a) => {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        openTeacherProfile(a.getAttribute('data-tid'));
      });
    });

    tb.querySelectorAll('[data-edit-teacher]').forEach((b) =>
      b.addEventListener('click', () => {
        openTeacherProfile(b.getAttribute('data-edit-teacher'));
      })
    );

    tb.querySelectorAll('[data-del-teacher]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this teacher?')) return;
        try {
          await SSC_API.delete('/admin/teachers/' + b.getAttribute('data-del-teacher'));
          msg('Teacher removed');
          await loadTeachers();
          await buildSearchIndex();
        } catch (err) {
          showModalAlert(err.message || 'Delete failed', 'Error');
        }
      })
    );
  }

  // Teacher Creation Submit
  document.getElementById('form-teacher').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    let assignments = [];
    try {
      assignments = f.assignments.value.trim() ? JSON.parse(f.assignments.value) : [];
    } catch {
      msg('Assignments must be valid JSON array', true);
      return;
    }
    
    const fd = new FormData();
    fd.append('email', f.email.value.trim());
    fd.append('password', f.password.value);
    fd.append('name', f.name.value.trim());
    fd.append('employeeId', f.employeeId.value.trim());
    fd.append('department', f.department.value.trim());
    fd.append('designation', f.designation.value.trim());
    fd.append('qualifications', f.qualifications.value.trim());
    fd.append('experience', f.experience.value.trim());
    fd.append('specialization', f.specialization.value.trim());
    fd.append('bio', f.bio.value.trim());
    fd.append('assignments', JSON.stringify(assignments));
    
    if (f.avatar.files && f.avatar.files[0]) {
      fd.append('avatar', f.avatar.files[0]);
    }

    try {
      await SSC_API.upload('/admin/teachers', fd, 'POST');
      f.reset();
      msg('Teacher created successfully');
      await loadTeachers();
      await buildSearchIndex();
    } catch (err) {
      showModalAlert(err.message || 'Creation failed', 'Error');
    }
  });

  // Edit Teacher Form Submit
  const editTeacherForm = document.getElementById('form-edit-teacher');
  if (editTeacherForm) {
    editTeacherForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-teacher-id').value;
      const email = document.getElementById('edit-teacher-email').value.trim();
      const name = document.getElementById('edit-teacher-name').value.trim();
      const phone = document.getElementById('edit-teacher-phone').value.trim();
      const department = document.getElementById('edit-teacher-dept').value.trim();
      const designation = document.getElementById('edit-teacher-designation').value.trim();
      const qualifications = document.getElementById('edit-teacher-qual').value.trim();
      const experience = document.getElementById('edit-teacher-exp').value.trim();
      const specialization = document.getElementById('edit-teacher-spec').value.trim();
      const bio = document.getElementById('edit-teacher-bio').value.trim();
      const password = document.getElementById('edit-teacher-password').value;

      const assignments = [];
      document.querySelectorAll('.assignment-edit-row').forEach(row => {
        const sub = row.querySelector('.assignment-subject').value.trim();
        const cls = row.querySelector('.assignment-class').value.trim();
        if (sub && cls) {
          assignments.push({ subject: sub, className: cls });
        }
      });

      const fd = new FormData();
      fd.append('email', email);
      fd.append('name', name);
      fd.append('phone', phone);
      fd.append('bio', bio);
      if (password) fd.append('password', password);

      const teacherProfile = {
        department,
        designation,
        qualifications,
        experience,
        specialization,
        assignments
      };
      fd.append('teacherProfile', JSON.stringify(teacherProfile));

      const removeAvatar = document.getElementById('edit-teacher-remove-avatar-flag').value === 'true';
      fd.append('removeAvatar', removeAvatar);

      const avatarFile = document.getElementById('edit-teacher-avatar').files[0];
      if (avatarFile) fd.append('avatar', avatarFile);

      try {
        await SSC_API.upload('/admin/teachers/' + id, fd, 'PATCH');
        msg('Faculty updated successfully');
        document.getElementById('modal-edit-teacher').style.display = 'none';
        editTeacherForm.reset();
        await loadTeachers();
        await buildSearchIndex();
      } catch (err) {
        showModalAlert(err.message || 'Update failed', 'Error');
      }
    });

    const removePhotoBtn = document.getElementById('btn-edit-teacher-remove-photo');
    if (removePhotoBtn) {
      removePhotoBtn.addEventListener('click', () => {
        document.getElementById('edit-teacher-remove-avatar-flag').value = 'true';
        document.getElementById('edit-teacher-avatar-img').style.display = 'none';
        document.getElementById('edit-teacher-avatar-placeholder').style.display = 'grid';
        removePhotoBtn.style.display = 'none';
        document.getElementById('edit-teacher-avatar').value = '';
      });
    }

    const avatarInput = document.getElementById('edit-teacher-avatar');
    if (avatarInput) {
      avatarInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          document.getElementById('edit-teacher-remove-avatar-flag').value = 'false';
          const reader = new FileReader();
          reader.onload = (evt) => {
            const prevImg = document.getElementById('edit-teacher-avatar-img');
            prevImg.src = evt.target.result;
            prevImg.style.display = 'block';
            document.getElementById('edit-teacher-avatar-placeholder').style.display = 'none';
            document.getElementById('btn-edit-teacher-remove-photo').style.display = 'inline-block';
          };
          reader.readAsDataURL(file);
        }
      });
    }

    document.getElementById('btn-teacher-gen-pass').addEventListener('click', () => {
      document.getElementById('edit-teacher-password').value = randPass();
    });

    document.getElementById('btn-teacher-copy-creds').addEventListener('click', () => {
      const email = document.getElementById('edit-teacher-email').value;
      const name = document.getElementById('edit-teacher-name').value;
      const pass = document.getElementById('edit-teacher-password').value || '(Keep existing)';
      navigator.clipboard.writeText(text).then(() => showModalAlert('Credentials copied to clipboard!', 'Success'));
    });

    document.getElementById('btn-teacher-print-creds').addEventListener('click', () => {
      const email = document.getElementById('edit-teacher-email').value;
      const name = document.getElementById('edit-teacher-name').value;
      const pass = document.getElementById('edit-teacher-password').value || '(Keep existing)';
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
        <head><title>Faculty Credentials</title></head>
        <body style="font-family:sans-serif;padding:2rem;" onload="window.print();window.close();">
          <h2>SSC College Junnar — Faculty Credentials</h2>
          <hr/>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Login Email:</strong> ${email}</p>
          <p><strong>Temporary Password:</strong> ${pass}</p>
          <p style="font-size:0.9rem;color:#555;margin-top:2rem;">Note: Keep these credentials secure. Please change your password upon first login.</p>
        </body>
        </html>
      `);
      win.document.close();
    });
  }

  // ── Admissions Management ──────────────────────────────
  async function loadAdmissions() {
    const rows = await SSC_API.get('/admin/admissions');
    const tb = document.querySelector('#tbl-admissions tbody');
    tb.innerHTML = '';
    rows.forEach((a) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="App No">${esc(a.applicationNumber)}</td>
        <td data-label="Full Name">${esc(a.fullName)}</td>
        <td data-label="Course">${esc(a.courseApplied)}</td>
        <td data-label="12th Marks">${a.marks12}/${a.maxMarks12}</td>
        <td data-label="Status">${esc(a.status)}</td>
        <td data-label="Actions">
          <button class="btn small" data-verify="${a._id}">Toggle verify</button>
          <button class="btn small" data-approve="${a._id}">Approve+account</button>
          <button class="btn small danger" data-reject="${a._id}">Reject</button>
        </td>`;
      tb.appendChild(tr);
    });

    tb.querySelectorAll('[data-verify]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-verify');
        const cur = rows.find((x) => x._id === id);
        try {
          await SSC_API.patch('/admin/admissions/' + id + '/verify', {
            documentsVerified: !cur.documentsVerified,
          });
          await loadAdmissions();
        } catch (err) {
          alert(err.message || 'Verification failed');
        }
      })
    );

    tb.querySelectorAll('[data-approve]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-approve');
        const cur = rows.find(x => x._id === id);
        if (!cur) return;
        
        // Generate details dynamically
        const yearSuffix = new Date().getFullYear().toString().slice(-2);
        const courseAbbr = (cur.courseApplied || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '') || 'GEN';
        const prefix = `SSC${yearSuffix}${courseAbbr}`;
        
        let matchCount = 0;
        searchIndex.students.forEach(student => {
          const sp = student.studentProfile || {};
          if (sp.studentId && String(sp.studentId).startsWith(prefix)) {
            matchCount++;
          }
        });
        
        const seqNum = String(matchCount + 1).padStart(3, '0');
        const generatedStudentId = `${prefix}${seqNum}`;
        const collegeEmail = `${generatedStudentId.toLowerCase()}@ssccjunnar.edu`;
        
        const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$';
        let pwd = '';
        const lowercase = 'abcdefghijklmnopqrstuvwxyz';
        const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const numbers = '0123456789';
        const specials = '!@#$';
        pwd += lowercase[Math.floor(Math.random() * lowercase.length)];
        pwd += uppercase[Math.floor(Math.random() * uppercase.length)];
        pwd += numbers[Math.floor(Math.random() * numbers.length)];
        pwd += specials[Math.floor(Math.random() * specials.length)];
        for (let i = 0; i < 6; i++) {
          pwd += chars[Math.floor(Math.random() * chars.length)];
        }
        const tempPassword = pwd.split('').sort(() => 0.5 - Math.random()).join('');

        document.getElementById('decision-app-id').value = cur._id || cur.id;
        document.getElementById('decision-student-name').value = cur.fullName || '';
        document.getElementById('decision-student-course').value = cur.courseApplied || '';
        document.getElementById('decision-student-id').value = generatedStudentId;
        document.getElementById('decision-college-email').value = collegeEmail;
        document.getElementById('decision-temp-password').value = tempPassword;
        document.getElementById('decision-class-name').value = `FY-${courseAbbr}-A`;

        document.getElementById('modal-admission-decision').style.display = 'flex';
      })
    );

    tb.querySelectorAll('[data-reject]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-reject');
        const cur = rows.find(x => x._id === id);
        if (!cur) return;
        document.getElementById('reject-app-id').value = cur._id || cur.id;
        document.getElementById('reject-student-name').value = cur.fullName || '';
        document.getElementById('reject-notes').value = '';
        document.getElementById('modal-admission-reject').style.display = 'flex';
      })
    );
  }

  // ── Notices Management ─────────────────────────────────
  async function loadNotices() {
    const items = await SSC_API.get('/admin/notices');
    const box = document.getElementById('notice-list');
    box.innerHTML = '';
    items.forEach((n) => {
      const div = document.createElement('div');
      div.className = 'card mt-2';
      div.innerHTML = `<strong>${esc(n.title)}</strong>
        <span class="small" style="margin-left:0.5rem;color:var(--muted);">[${esc((n.priority || 'NORMAL').toLowerCase())} · ${esc((n.audience || 'ALL_PORTAL').replace(/_/g, ' '))}]</span>
        <p class="small">${esc(n.body || '')}</p>
        <button class="btn small" data-edit-notice="${n._id}">Edit</button>
        <button class="btn small danger mt-2" data-del-notice="${n._id}">Delete</button>`;
      box.appendChild(div);
    });

    box.querySelectorAll('[data-edit-notice]').forEach((b) =>
      b.addEventListener('click', () => {
        const id = b.getAttribute('data-edit-notice');
        const cur = items.find((x) => x._id === id);
        if (!cur) return;
        
        document.getElementById('edit-notice-id').value = cur._id || cur.id;
        document.getElementById('edit-notice-title').value = cur.title || '';
        document.getElementById('edit-notice-body').value = cur.body || '';
        document.getElementById('edit-notice-priority').value = cur.priority || 'NORMAL';
        document.getElementById('edit-notice-audience').value = cur.audience || 'ALL_PORTAL';
        const expiryEl = document.getElementById('edit-notice-expiry');
        if (expiryEl) {
          expiryEl.value = cur.expiryDate ? new Date(cur.expiryDate).toISOString().slice(0, 16) : '';
        }
        document.getElementById('edit-notice-pdf').value = '';
        
        document.getElementById('modal-edit-notice').style.display = 'flex';
      })
    );

    box.querySelectorAll('[data-del-notice]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete this notice?')) return;
        try {
          await SSC_API.delete('/admin/notices/' + b.getAttribute('data-del-notice'));
          msg('Notice deleted');
          await loadNotices();
          await buildSearchIndex();
        } catch (err) {
          showModalAlert(err.message || 'Delete failed', 'Error');
        }
      })
    );
  }

  document.getElementById('form-notice').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = new FormData();
    fd.append('title', f.title.value);
    fd.append('body', f.body.value);
    fd.append('priority', f.priority?.value || 'NORMAL');
    let audience = f.audience?.value || 'ALL_PORTAL';
    const target = (f.audienceTarget?.value || '').trim();
    if (target) {
      if (/^(COURSE|YEAR|CLASS|STUDENT):/i.test(target)) audience = target.toUpperCase();
      else if (/^\d+$/.test(target)) audience = `YEAR:${target}`;
      else if (target.includes(' ')) audience = `CLASS:${target}`;
      else audience = `COURSE:${target}`;
    }
    fd.append('audience', audience);
    if (f.publishDate?.value) fd.append('publishDate', new Date(f.publishDate.value).toISOString());
    if (f.expiryDate?.value) fd.append('expiryDate', new Date(f.expiryDate.value).toISOString());
    const pdf = f.querySelector('[name="pdf"]').files[0];
    if (pdf) fd.append('pdf', pdf);
    try {
      await SSC_API.upload('/admin/notices', fd);
      f.reset();
      msg('Notice published');
      await loadNotices();
      await buildSearchIndex();
    } catch (err) {
      showModalAlert(err.message || 'Publish failed', 'Error');
    }
  });

  // Edit Notice Form Submit
  const editNoticeForm = document.getElementById('form-edit-notice');
  if (editNoticeForm) {
    editNoticeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('edit-notice-id').value;
      const title = document.getElementById('edit-notice-title').value.trim();
      const body = document.getElementById('edit-notice-body').value.trim();
      const priority = document.getElementById('edit-notice-priority')?.value || 'NORMAL';
      const audience = document.getElementById('edit-notice-audience')?.value || 'ALL_PORTAL';
      const expiryRaw = document.getElementById('edit-notice-expiry')?.value;
      const pdf = document.getElementById('edit-notice-pdf').files[0];

      const fd = new FormData();
      fd.append('title', title);
      fd.append('body', body);
      fd.append('priority', priority);
      fd.append('audience', audience);
      if (expiryRaw) fd.append('expiryDate', new Date(expiryRaw).toISOString());
      else fd.append('expiryDate', '');
      if (pdf) fd.append('pdf', pdf);

      try {
        await SSC_API.upload('/admin/notices/' + id, fd, 'PATCH');
        msg('Notice updated successfully');
        document.getElementById('modal-edit-notice').style.display = 'none';
        editNoticeForm.reset();
        await loadNotices();
        await buildSearchIndex();
      } catch (err) {
        showModalAlert(err.message || 'Update failed', 'Error');
      }
    });
  }

  async function loadDepartments() {
    const rows = await SSC_API.get('/admin/departments');
    const tb = document.querySelector('#tbl-dept tbody');
    tb.innerHTML = '';
    rows.forEach((d) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(d.name)}</td><td>${esc(d.stream)}</td>
        <td><button class="btn small danger" data-del-dept="${d._id}">Delete</button></td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-del-dept]').forEach((b) =>
      b.addEventListener('click', async () => {
        await SSC_API.delete('/admin/departments/' + b.getAttribute('data-del-dept'));
        loadDepartments();
      })
    );
  }

  document.getElementById('form-dept').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    await SSC_API.post('/admin/departments', {
      name: f.name.value.trim(),
      stream: f.stream.value,
      hodName: f.hodName.value.trim(),
    });
    f.reset();
    loadDepartments();
  });

  async function loadCourses() {
    const rows = await SSC_API.get('/admin/courses');
    const tb = document.querySelector('#tbl-courses tbody');
    tb.innerHTML = '';
    rows.forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(c.name)}</td><td>${esc(c.level)}</td>
        <td><button class="btn small danger" data-del-course="${c._id}">Delete</button></td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-del-course]').forEach((b) =>
      b.addEventListener('click', async () => {
        await SSC_API.delete('/admin/courses/' + b.getAttribute('data-del-course'));
        loadCourses();
      })
    );
  }

  document.getElementById('form-course').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    await SSC_API.post('/admin/courses', {
      name: f.name.value.trim(),
      level: f.level.value,
      duration: f.duration.value.trim(),
      eligibility: f.eligibility.value.trim(),
      description: f.description.value.trim(),
    });
    f.reset();
    loadCourses();
  });

  async function loadGalleryAdmin() {
    const items = await SSC_API.get('/admin/gallery');
    const grid = document.getElementById('gallery-admin');
    grid.innerHTML = '';
    items.forEach((g) => {
      const wrap = document.createElement('div');
      wrap.className = 'card';
      wrap.innerHTML = g.imageUrl
        ? `<img src="${g.imageUrl}" alt="" style="width:100%;height:140px;object-fit:cover;border-radius:12px"/>
           <p class="small mt-2">${esc(g.caption || '')}</p>
           <button class="btn small danger mt-2" data-del-gal="${g._id}">Delete</button>`
        : '';
      grid.appendChild(wrap);
    });
    grid.querySelectorAll('[data-del-gal]').forEach((b) =>
      b.addEventListener('click', async () => {
        await SSC_API.delete('/admin/gallery/' + b.getAttribute('data-del-gal'));
        loadGalleryAdmin();
      })
    );
  }

  document.getElementById('form-gallery').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = new FormData();
    fd.append('caption', f.caption.value);
    fd.append('image', f.image.files[0]);
    await SSC_API.upload('/admin/gallery', fd);
    f.reset();
    loadGalleryAdmin();
  });

  async function loadFeedback() {
    const items = await SSC_API.get('/admin/feedback');
    const box = document.getElementById('feedback-list');
    box.innerHTML = items
      .map(
        (f) =>
          `<div class="card mt-2"><strong>${esc(f.name)}</strong> <span class="small">${esc(
            f.email || ''
          )}</span><p class="small mt-2">${esc(f.message)}</p><p class="small">${new Date(
            f.createdAt
          ).toLocaleString()}</p></div>`
      )
      .join('');
  }

  async function loadSettings() {
    const s = await SSC_API.get('/admin/settings');
    document.getElementById('set-tag').value = s.siteTagline || '';
    const syllabus = document.getElementById('set-syllabus');
    const prospectus = document.getElementById('set-prospectus');
    if (syllabus) syllabus.value = s.syllabusPdfUrl || '';
    if (prospectus) prospectus.value = s.prospectusPdfUrl || '';
    const threshold = document.getElementById('set-threshold');
    if (threshold) threshold.value = s.attendanceThreshold || 75;
  }

  document.getElementById('form-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    await SSC_API.put('/admin/settings', {
      siteTagline: f.siteTagline.value.trim(),
      syllabusPdfUrl: f.syllabusPdfUrl.value.trim(),
      prospectusPdfUrl: f.prospectusPdfUrl.value.trim(),
      attendanceThreshold: Number(f.attendanceThreshold.value.trim()) || 75,
    });
    msg('Settings saved');
  });

  async function loadStudyMaterials() {
    const list = await SSC_API.get('/admin/study-materials');
    const tb = document.querySelector('#tbl-study-materials tbody');
    tb.innerHTML = '';
    list.forEach((m) => {
      const tr = document.createElement('tr');
      const date = m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '';
      const author = m.teacher ? `${m.teacher.name} (${m.teacher.email})` : 'Unknown';
      tr.innerHTML = `
        <td>${esc(m.title)}</td>
        <td>${esc(m.subject)}</td>
        <td>${esc(m.className)}</td>
        <td>${esc(author)}</td>
        <td>${date}</td>
        <td>
          ${m.fileUrl ? `<a class="btn small secondary" href="${esc(m.fileUrl)}" target="_blank" rel="noopener">Open</a>` : ''}
          <button class="btn small danger" data-del-mat="${m._id}">Delete</button>
        </td>`;
      tb.appendChild(tr);
    });

    tb.querySelectorAll('[data-del-mat]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('Delete this study material?')) return;
        try {
          await SSC_API.delete('/admin/study-materials/' + b.getAttribute('data-del-mat'));
          msg('Material deleted');
          loadStudyMaterials();
        } catch (err) {
          msg(err.message || 'Delete failed', true);
        }
      });
    });
  }

  let lastAnalyticsData = null;

  async function loadAttendanceAnalytics() {
    const data = await SSC_API.get('/admin/attendance/analytics');
    lastAnalyticsData = data;

    const statsGrid = document.getElementById('att-stats-grid');
    statsGrid.innerHTML = `
      <div class="stat-card"><span class="small">Total Students</span><strong>${data.totalStudents}</strong></div>
      <div class="stat-card"><span class="small">Present Today</span><strong>${data.presentToday}</strong></div>
      <div class="stat-card"><span class="small">Absent Today</span><strong>${data.absentToday}</strong></div>
      <div class="stat-card"><span class="small">Global Avg %</span><strong>${data.globalPercentage}%</strong></div>
      <div class="stat-card"><span class="small">Students &lt;${data.threshold}%</span><strong style="color: #ef4444">${data.lowAttendanceCount}</strong></div>
    `;

    const threshLabel = document.getElementById('att-threshold-label');
    if (threshLabel) threshLabel.textContent = data.threshold;

    // Render Low Attendance List
    const tblLow = document.querySelector('#tbl-low-att tbody');
    tblLow.innerHTML = '';
    if (!data.lowAttendanceList.length) {
      tblLow.innerHTML = '<tr><td colspan="6" class="small">No students have low attendance.</td></tr>';
    } else {
      data.lowAttendanceList.forEach((s) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${esc(s.rollNumber)}</td>
          <td>${esc(s.name)}</td>
          <td>${esc(s.className)}</td>
          <td>${s.attended}</td>
          <td>${s.totalClasses}</td>
          <td style="color: #ef4444; font-weight: bold;">${s.percentage}%</td>
        `;
        tblLow.appendChild(tr);
      });
    }

    // Render Watchlist List (Risk List)
    const tblRisk = document.querySelector('#tbl-risk-att tbody');
    if (tblRisk) {
      tblRisk.innerHTML = '';
      if (!data.riskList || !data.riskList.length) {
        tblRisk.innerHTML = '<tr><td colspan="6" class="small">No students in the watchlist.</td></tr>';
      } else {
        data.riskList.forEach((s) => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${esc(s.rollNumber)}</td>
            <td>${esc(s.name)}</td>
            <td>${esc(s.className)}</td>
            <td>${s.attended}</td>
            <td>${s.totalClasses}</td>
            <td style="color: #f59e0b; font-weight: bold;">${s.percentage}%</td>
          `;
          tblRisk.appendChild(tr);
        });
      }
    }

    // Render Class-wise list with monthly comparison columns & trend arrow
    const tblClass = document.querySelector('#tbl-class-att tbody');
    tblClass.innerHTML = '';
    if (!data.classTrends || !data.classTrends.length) {
      tblClass.innerHTML = '<tr><td colspan="5" class="small">No class trend records found.</td></tr>';
    } else {
      data.classTrends.forEach((c) => {
        const tr = document.createElement('tr');
        const color = c.thisMonthPct !== null && c.thisMonthPct < data.threshold ? 'color: #ef4444; font-weight: bold;' : '';
        const trendSymbol = c.direction === 'up' ? '↑ Improving' : c.direction === 'down' ? '↓ Dropping' : '→ Stable';
        const trendColor = c.direction === 'up' ? 'color:#22c55e;' : c.direction === 'down' ? 'color:#ef4444;' : 'color:var(--muted);';
        
        // Find total logs from classSummary
        const summary = data.classSummary.find(x => x.className === c.className);
        const totalLogs = summary ? summary.totalLogs : 0;

        tr.innerHTML = `
          <td>${esc(c.className)}</td>
          <td>${totalLogs}</td>
          <td style="${color}">${c.thisMonthPct !== null ? c.thisMonthPct + '%' : '—'}</td>
          <td>${c.lastMonthPct !== null ? c.lastMonthPct + '%' : '—'}</td>
          <td style="${trendColor} font-weight:600;">${trendSymbol}</td>
        `;
        tblClass.appendChild(tr);
      });
    }

    // Render Subject-wise list with monthly comparison columns & trend arrow
    const tblSubject = document.querySelector('#tbl-subject-att tbody');
    tblSubject.innerHTML = '';
    if (!data.subjectTrends || !data.subjectTrends.length) {
      tblSubject.innerHTML = '<tr><td colspan="5" class="small">No subject trend records found.</td></tr>';
    } else {
      data.subjectTrends.forEach((s) => {
        const tr = document.createElement('tr');
        const color = s.thisMonthPct !== null && s.thisMonthPct < data.threshold ? 'color: #ef4444; font-weight: bold;' : '';
        const trendSymbol = s.direction === 'up' ? '↑ Improving' : s.direction === 'down' ? '↓ Dropping' : '→ Stable';
        const trendColor = s.direction === 'up' ? 'color:#22c55e;' : s.direction === 'down' ? 'color:#ef4444;' : 'color:var(--muted);';
        
        // Find total logs from subjectSummary
        const summary = data.subjectSummary.find(x => x.subject === s.subject);
        const totalLogs = summary ? summary.totalLogs : 0;

        tr.innerHTML = `
          <td>${esc(s.subject)}</td>
          <td>${totalLogs}</td>
          <td style="${color}">${s.thisMonthPct !== null ? s.thisMonthPct + '%' : '—'}</td>
          <td>${s.lastMonthPct !== null ? s.lastMonthPct + '%' : '—'}</td>
          <td style="${trendColor} font-weight:600;">${trendSymbol}</td>
        `;
        tblSubject.appendChild(tr);
      });
    }

    // Render Monthly Summary
    const tblMonthly = document.querySelector('#tbl-monthly-att tbody');
    if (tblMonthly) {
      tblMonthly.innerHTML = '';
      const monthly = data.monthlySummary || [];
      if (!monthly.length) {
        tblMonthly.innerHTML = '<tr><td colspan="4" class="small">No monthly data available yet.</td></tr>';
      } else {
        monthly.forEach((m) => {
          const tr = document.createElement('tr');
          const color = m.percentage < data.threshold ? 'color: #ef4444; font-weight: bold;' : 'color: #22c55e;';
          // Format month label e.g. "2025-11" → "Nov 2025"
          const [yr, mo] = m.month.split('-');
          const label = new Date(Number(yr), Number(mo) - 1, 1)
            .toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
          tr.innerHTML = `
            <td>${esc(label)}</td>
            <td style="color: #22c55e;">${m.present}</td>
            <td style="color: #ef4444;">${m.absent}</td>
            <td style="${color}; font-weight: bold;">${m.percentage}%</td>
          `;
          tblMonthly.appendChild(tr);
        });
      }
    }
  }

  function downloadCSV(csvContent, fileName) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function exportCSV() {
    if (!lastAnalyticsData || !lastAnalyticsData.fullReportList) {
      msg('No analytics data to export', true);
      return;
    }
    let csv = 'Student ID,Roll Number,Student Name,Class,Subject,Attendance Percentage,Present Count,Absent Count\n';
    lastAnalyticsData.fullReportList.forEach(s => {
      csv += `"${s.studentId}","${s.rollNumber}","${s.name}","${s.className}","${s.subject}",${s.percentage}%,${s.present},${s.absent}\n`;
    });
    downloadCSV(csv, 'student_attendance_report.csv');
  }

  function exportExcel() {
    if (!lastAnalyticsData || !lastAnalyticsData.fullReportList) {
      msg('No analytics data to export', true);
      return;
    }
    let xls = 'Student ID\tRoll Number\tStudent Name\tClass\tSubject\tAttendance Percentage\tPresent Count\tAbsent Count\n';
    lastAnalyticsData.fullReportList.forEach(s => {
      xls += `"${s.studentId}"\t"${s.rollNumber}"\t"${s.name}"\t"${s.className}"\t"${s.subject}"\t${s.percentage}%\t${s.present}\t${s.absent}\n`;
    });
    const blob = new Blob([xls], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", 'low_attendance_report.xls');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function printReport() {
    window.print();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PLACEMENT CELL — Admin JS
  // ═══════════════════════════════════════════════════════════════════════════

  let _plCompanies = [];  // cache for drive form company select

  async function loadPlacementPanel() {
    await Promise.all([loadPlAnalytics(), loadPlCompanies(), loadPlDrives(), loadPlApplications()]);
    bindPlacementEvents();
  }

  async function loadPlAnalytics() {
    try {
      const d = await SSC_API.get('/admin/placement/analytics');
      const grid = document.getElementById('placement-stat-grid');
      if (!grid) return;
      const rate = d.successRate || 0;
      grid.innerHTML = `
        <div class="stat-card"><span class="small">Total Companies</span><strong>${d.totalCompanies}</strong></div>
        <div class="stat-card"><span class="small">Active Drives</span><strong>${d.activeDrives}</strong></div>
        <div class="stat-card"><span class="small">Total Applications</span><strong>${d.totalApplications}</strong></div>
        <div class="stat-card"><span class="small">Students Selected</span><strong style="color:#22c55e">${d.selectedStudents}</strong></div>
        <div class="stat-card"><span class="small">Success Rate</span><strong style="color:${rate>=50?'#22c55e':'#f59e0b'}">${rate}%</strong></div>
      `;
      // Company stats table
      const tb = document.querySelector('#tbl-company-stats tbody');
      if (tb) {
        tb.innerHTML = '';
        (d.companyStats || []).forEach((c) => {
          const rate = c.totalApplications ? Math.round((c.selected / c.totalApplications) * 100) : 0;
          const tr = document.createElement('tr');
          tr.innerHTML = `<td><strong>${esc(c.companyName)}</strong></td><td>${esc(c.industry)}</td><td>${c.drives}</td><td>${c.totalApplications}</td><td style="color:#22c55e;font-weight:bold">${c.selected}</td><td>${rate}%</td>`;
          tb.appendChild(tr);
        });
        if (!d.companyStats || !d.companyStats.length) {
          tb.innerHTML = '<tr><td colspan="6" class="small">No data yet.</td></tr>';
        }
      }
    } catch (e) { /* silently fail analytics */ }
  }

  async function loadPlCompanies() {
    const rows = await SSC_API.get('/admin/placement/companies');
    _plCompanies = rows;
    const tb = document.querySelector('#tbl-companies tbody');
    if (!tb) return;
    tb.innerHTML = '';
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="6" class="small">No companies yet. Add one above.</td></tr>'; return; }
    rows.forEach((c) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td data-label="Company"><strong>${esc(c.companyName)}</strong><br><span class="small">${esc(c.website || '')}</span></td>
        <td data-label="Industry">${esc(c.industry)}</td>
        <td data-label="Package">${esc(c.packageOffered)}</td>
        <td data-label="Location">${esc(c.location)}</td>
        <td data-label="Drives">${c.drives || 0}</td>
        <td data-label="Actions">
          <button class="btn small" data-edit-company="${c._id}">Edit</button>
          <button class="btn small danger" data-del-company="${c._id}">Delete</button>
        </td>`;
      tb.appendChild(tr);
    });
    // Populate company select in drive form
    const sel = document.getElementById('drive-company-select');
    if (sel) {
      sel.innerHTML = rows.map((c) => `<option value="${c._id}">${esc(c.companyName)}</option>`).join('');
    }
    // Edit handlers
    tb.querySelectorAll('[data-edit-company]').forEach((b) => {
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-edit-company');
        const cur = rows.find((x) => x._id === id);
        if (!cur) return;
        const companyName = prompt('Company Name', cur.companyName || '');
        if (companyName === null) return;
        const industry = prompt('Industry', cur.industry || '') || '';
        const packageOffered = prompt('Package Offered (e.g. 3.5 LPA)', cur.packageOffered || '') || '';
        const location = prompt('Location', cur.location || '') || '';
        const website = prompt('Website', cur.website || '') || '';
        const eligibilityCriteria = prompt('Eligibility Criteria', cur.eligibilityCriteria || '') || '';
        await SSC_API.patch('/admin/placement/companies/' + id, { companyName: companyName.trim(), industry, packageOffered, location, website, eligibilityCriteria });
        msg('Company updated');
        loadPlCompanies();
        loadPlAnalytics();
      });
    });
    // Delete handlers
    tb.querySelectorAll('[data-del-company]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('Delete this company and all its drives?')) return;
        await SSC_API.delete('/admin/placement/companies/' + b.getAttribute('data-del-company'));
        msg('Company deleted');
        loadPlCompanies();
        loadPlDrives();
        loadPlAnalytics();
      });
    });
  }

  async function loadPlDrives() {
    const rows = await SSC_API.get('/admin/placement/drives');
    const tb = document.querySelector('#tbl-drives tbody');
    if (!tb) return;
    tb.innerHTML = '';
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="7" class="small">No drives yet.</td></tr>'; return; }
    const statusColor = { active: '#22c55e', closed: '#94a3b8', cancelled: '#ef4444' };
    rows.forEach((d) => {
      const tr = document.createElement('tr');
      const driveDate = d.driveDate ? new Date(d.driveDate).toLocaleDateString('en-IN') : '—';
      const deadline = d.applicationDeadline ? new Date(d.applicationDeadline).toLocaleDateString('en-IN') : '—';
      const sColor = statusColor[d.status] || '#94a3b8';
      tr.innerHTML = `
        <td data-label="Company">${esc(d.company?.companyName || '')}</td>
        <td data-label="Title"><strong>${esc(d.title)}</strong></td>
        <td data-label="Date">${driveDate}</td>
        <td data-label="Deadline">${deadline}</td>
        <td data-label="Status"><span style="color:${sColor};font-weight:600">${esc(d.status)}</span></td>
        <td data-label="Applications">${d.applicationCount || 0}</td>
        <td data-label="Actions">
          <button class="btn small" data-close-drive="${d._id}" ${d.status!=='active'?'disabled':''}>Close</button>
          <button class="btn small danger" data-del-drive="${d._id}">Delete</button>
        </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-close-drive]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('Close this drive? Students will no longer be able to apply.')) return;
        await SSC_API.patch('/admin/placement/drives/' + b.getAttribute('data-close-drive'), { status: 'closed' });
        msg('Drive closed');
        loadPlDrives(); loadPlAnalytics();
      });
    });
    tb.querySelectorAll('[data-del-drive]').forEach((b) => {
      b.addEventListener('click', async () => {
        if (!confirm('Delete this drive and all its applications?')) return;
        await SSC_API.delete('/admin/placement/drives/' + b.getAttribute('data-del-drive'));
        msg('Drive deleted');
        loadPlDrives(); loadPlAnalytics();
      });
    });
  }

  async function loadPlApplications(statusFilter) {
    const qs = statusFilter ? `?status=${statusFilter}` : '';
    const rows = await SSC_API.get('/admin/placement/applications' + qs);
    const tb = document.querySelector('#tbl-pl-applications tbody');
    if (!tb) return;
    tb.innerHTML = '';
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="8" class="small">No applications found.</td></tr>'; return; }
    const statusColor = { applied:'#94a3b8', shortlisted:'#f59e0b', interview_scheduled:'#3b82f6', selected:'#22c55e', rejected:'#ef4444' };
    rows.forEach((a) => {
      const tr = document.createElement('tr');
      const dt = a.appliedAt ? new Date(a.appliedAt).toLocaleDateString('en-IN') : '';
      const sColor = statusColor[a.applicationStatus] || '#94a3b8';
      const statusLabel = (a.applicationStatus || '').replace(/_/g, ' ');
      tr.innerHTML = `
        <td><strong>${esc(a.studentName)}</strong><br><span class="small">${esc(a.studentEmail)}</span></td>
        <td>${esc(a.rollNumber)}</td>
        <td>${esc(a.className)}</td>
        <td>${esc(a.companyName)}</td>
        <td>${esc(a.driveTitle)}</td>
        <td><span style="color:${sColor};font-weight:600;text-transform:capitalize">${esc(statusLabel)}</span></td>
        <td>${dt}</td>
        <td>
          <select class="select input" style="padding:0.3rem 0.5rem;font-size:0.8rem;" data-app-id="${a._id}" data-prev-val="${a.applicationStatus}">
            <option value="applied" ${a.applicationStatus==='applied'?'selected':''}>Applied</option>
            <option value="shortlisted" ${a.applicationStatus==='shortlisted'?'selected':''}>Shortlisted</option>
            <option value="interview_scheduled" ${a.applicationStatus==='interview_scheduled'?'selected':''}>Interview</option>
            <option value="selected" ${a.applicationStatus==='selected'?'selected':''}>Selected</option>
            <option value="rejected" ${a.applicationStatus==='rejected'?'selected':''}>Rejected</option>
          </select>
        </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('select[data-app-id]').forEach((sel) => {
      sel.addEventListener('change', async () => {
        const id = sel.getAttribute('data-app-id');
        const prev = sel.getAttribute('data-prev-val');
        try {
          await SSC_API.patch('/admin/placement/applications/' + id + '/status', { applicationStatus: sel.value });
          msg('Application status updated');
          
          // Update the tag immediately in the DOM
          const tr = sel.closest('tr');
          const statusSpan = tr.querySelector('td:nth-child(6) span');
          if (statusSpan) {
            const newColor = statusColor[sel.value] || '#94a3b8';
            statusSpan.style.color = newColor;
            statusSpan.textContent = sel.value.replace(/_/g, ' ');
          }
          
          sel.setAttribute('data-prev-val', sel.value);
          loadPlAnalytics();
        } catch (err) {
          showModalAlert(err.message || 'Status update failed', 'Error');
          sel.value = prev; // Revert select box state
        }
      });
    });
  }

  function bindPlacementEvents() {
    // Add company toggle
    const btnAddCo = document.getElementById('btn-add-company');
    const formCoWrap = document.getElementById('form-company-wrap');
    const btnCancelCo = document.getElementById('btn-cancel-company');
    if (btnAddCo && !btnAddCo.dataset.bound) {
      btnAddCo.dataset.bound = '1';
      btnAddCo.addEventListener('click', () => { formCoWrap.style.display = formCoWrap.style.display === 'none' ? '' : 'none'; });
      btnCancelCo.addEventListener('click', () => { formCoWrap.style.display = 'none'; document.getElementById('form-company').reset(); });
    }
    // Add drive toggle
    const btnAddDr = document.getElementById('btn-add-drive');
    const formDrWrap = document.getElementById('form-drive-wrap');
    const btnCancelDr = document.getElementById('btn-cancel-drive');
    if (btnAddDr && !btnAddDr.dataset.bound) {
      btnAddDr.dataset.bound = '1';
      btnAddDr.addEventListener('click', () => { formDrWrap.style.display = formDrWrap.style.display === 'none' ? '' : 'none'; });
      btnCancelDr.addEventListener('click', () => { formDrWrap.style.display = 'none'; document.getElementById('form-drive').reset(); });
    }
    // Create company form
    const formCo = document.getElementById('form-company');
    if (formCo && !formCo.dataset.bound) {
      formCo.dataset.bound = '1';
      formCo.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await SSC_API.post('/admin/placement/companies', {
          companyName: f.companyName.value.trim(),
          industry: f.industry.value.trim(),
          packageOffered: f.packageOffered.value.trim(),
          location: f.location.value.trim(),
          website: f.website.value.trim(),
          eligibilityCriteria: f.eligibilityCriteria.value.trim(),
          description: f.description.value.trim(),
        });
        f.reset();
        document.getElementById('form-company-wrap').style.display = 'none';
        msg('Company added');
        loadPlCompanies(); loadPlAnalytics();
      });
    }
    // Create drive form
    const formDr = document.getElementById('form-drive');
    if (formDr && !formDr.dataset.bound) {
      formDr.dataset.bound = '1';
      formDr.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        await SSC_API.post('/admin/placement/drives', {
          companyId: f.companyId.value,
          title: f.title.value.trim(),
          description: f.description.value.trim(),
          driveDate: f.driveDate.value || null,
          applicationDeadline: f.applicationDeadline.value || null,
          status: f.status.value,
        });
        f.reset();
        document.getElementById('form-drive-wrap').style.display = 'none';
        msg('Drive created');
        loadPlDrives(); loadPlAnalytics();
      });
    }
    // Filter applications
    const btnFilter = document.getElementById('btn-filter-apps');
    if (btnFilter && !btnFilter.dataset.bound) {
      btnFilter.dataset.bound = '1';
      btnFilter.addEventListener('click', () => {
        const v = document.getElementById('filter-app-status').value;
        loadPlApplications(v || undefined);
      });
    }
    // Export CSV button
    const btnCsv = document.getElementById('btn-pl-export-csv');
    if (btnCsv && !btnCsv.dataset.bound) {
      btnCsv.dataset.bound = '1';
      btnCsv.addEventListener('click', () => { window.location.href = '/api/admin/placement/export/csv'; });
    }
    // Print
    const btnPrint = document.getElementById('btn-pl-print');
    if (btnPrint && !btnPrint.dataset.bound) {
      btnPrint.dataset.bound = '1';
      btnPrint.addEventListener('click', () => window.print());
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TIMETABLE MODULE
  // ═══════════════════════════════════════════════════════════════════════════
  let activeTeachers = [];
  let allTimetablesCache = [];
  let currentTimetableClass = '';
  
  async function loadTimetablePanel() {
    const classSelect = document.getElementById('tt-class-select');
    classSelect.innerHTML = '<option value="">-- Choose Class --</option>';
    
    const classes = await SSC_API.get('/admin/timetable/classes');
    classes.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = c;
      classSelect.appendChild(opt);
    });
    
    activeTeachers = await SSC_API.get('/admin/timetable/teachers');
    allTimetablesCache = await SSC_API.get('/admin/timetable');
    
    const loadBtn = document.getElementById('tt-load-btn');
    if (!loadBtn.dataset.bound) {
      loadBtn.dataset.bound = '1';
      loadBtn.addEventListener('click', () => {
        const val = classSelect.value;
        if (val) {
          currentTimetableClass = val;
          renderTimetableGrid(val);
        }
      });
      
      const saveBtn = document.getElementById('tt-save-btn');
      saveBtn.addEventListener('click', saveTimetable);
      
      const deleteBtn = document.getElementById('tt-delete-btn');
      deleteBtn.addEventListener('click', deleteTimetable);
    }
  }

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const periodTimes = [
    { period: 1, start: '09:00', end: '10:00' },
    { period: 2, start: '10:00', end: '11:00' },
    { period: 3, start: '11:00', end: '12:00' },
    { period: 4, start: '12:00', end: '01:00' },
    { period: 5, start: '01:30', end: '02:30' },
    { period: 6, start: '02:30', end: '03:30' }
  ];

  async function renderTimetableGrid(className) {
    const container = document.getElementById('tt-grid-container');
    const title = document.getElementById('tt-grid-title');
    const body = document.getElementById('tt-grid-body');
    const deleteBtn = document.getElementById('tt-delete-btn');
    
    const tt = await SSC_API.get(`/admin/timetable/${className}`);
    const slots = tt.slots || [];
    
    title.textContent = `Weekly Timetable for ${className}`;
    deleteBtn.style.display = tt.id ? 'inline-block' : 'none';
    body.innerHTML = '';
    
    daysOfWeek.forEach(day => {
      const tr = document.createElement('tr');
      const tdDay = document.createElement('td');
      tdDay.innerHTML = `<strong>${day}</strong>`;
      tr.appendChild(tdDay);
      
      periodTimes.forEach(p => {
        const td = document.createElement('td');
        const slot = slots.find(s => s.day === day && Number(s.period) === p.period) || {};
        
        const subInput = document.createElement('input');
        subInput.className = 'input small';
        subInput.style.marginBottom = '4px';
        subInput.placeholder = 'Subject';
        subInput.value = slot.subject || '';
        subInput.dataset.day = day;
        subInput.dataset.period = p.period;
        subInput.dataset.field = 'subject';
        
        const teachSel = document.createElement('select');
        teachSel.className = 'select input small';
        teachSel.style.marginBottom = '4px';
        teachSel.dataset.day = day;
        teachSel.dataset.period = p.period;
        teachSel.dataset.field = 'teacher';
        
        teachSel.innerHTML = '<option value="">-- Teacher --</option>';
        activeTeachers.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = t.name;
          if (slot.teacherId === t.id) opt.selected = true;
          teachSel.appendChild(opt);
        });
        
        const roomInput = document.createElement('input');
        roomInput.className = 'input small';
        roomInput.placeholder = 'Room';
        roomInput.value = slot.room || '';
        roomInput.dataset.day = day;
        roomInput.dataset.period = p.period;
        roomInput.dataset.field = 'room';
        
        td.appendChild(subInput);
        td.appendChild(teachSel);
        td.appendChild(roomInput);
        
        teachSel.addEventListener('change', () => {
          checkTimetableConflicts();
        });
        
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    
    container.style.display = 'block';
    checkTimetableConflicts();
  }

  function checkTimetableConflicts() {
    const warningDiv = document.getElementById('tt-conflict-warning');
    const warningMsg = document.getElementById('tt-conflict-msg');
    warningDiv.style.display = 'none';
    warningMsg.textContent = '';
    
    const selects = document.querySelectorAll('#tt-grid-body select');
    selects.forEach(s => s.style.border = '');
    
    let hasConflict = false;
    let conflictsList = [];
    
    const currentSlots = [];
    selects.forEach(sel => {
      const day = sel.dataset.day;
      const period = Number(sel.dataset.period);
      const teacherId = sel.value;
      const teacherName = sel.options[sel.selectedIndex]?.text || '';
      
      if (teacherId) {
        currentSlots.push({ day, period, teacherId, teacherName, element: sel });
      }
    });

    currentSlots.forEach(slot => {
      allTimetablesCache.forEach(tt => {
        if (tt.className === currentTimetableClass) return;
        const otherSlots = tt.slots || [];
        otherSlots.forEach(os => {
          if (os.day === slot.day && Number(os.period) === slot.period && os.teacherId === slot.teacherId) {
            hasConflict = true;
            slot.element.style.border = '2px solid #eab308';
            conflictsList.push(`Teacher "${slot.teacherName}" is already assigned to class "${tt.className}" on ${slot.day} during Period ${slot.period}.`);
          }
        });
      });
    });
    
    if (hasConflict) {
      warningDiv.style.display = 'block';
      warningMsg.innerHTML = Array.from(new Set(conflictsList)).map(c => `<div>${c}</div>`).join('');
    }
  }

  async function saveTimetable() {
    if (!currentTimetableClass) return;
    const bodyRows = document.querySelectorAll('#tt-grid-body tr');
    const slots = [];
    
    bodyRows.forEach(row => {
      const cells = row.cells;
      const day = cells[0].textContent.trim();
      
      for (let i = 1; i <= 6; i++) {
        const td = cells[i];
        const subVal = td.querySelector('input[data-field="subject"]').value.trim();
        const teachSel = td.querySelector('select[data-field="teacher"]');
        const teachVal = teachSel.value;
        const teachName = teachSel.options[teachSel.selectedIndex]?.text || '';
        const roomVal = td.querySelector('input[data-field="room"]').value.trim();
        
        if (subVal || teachVal || roomVal) {
          const pTime = periodTimes.find(pt => pt.period === i);
          slots.push({
            day,
            period: i,
            startTime: pTime.start,
            endTime: pTime.end,
            subject: subVal,
            teacherId: teachVal || null,
            teacherName: teachVal ? teachName : '',
            room: roomVal
          });
        }
      }
    });
    
    try {
      await SSC_API.post(`/admin/timetable/${currentTimetableClass}`, { slots });
      msg('Timetable saved successfully');
      allTimetablesCache = await SSC_API.get('/admin/timetable');
      renderTimetableGrid(currentTimetableClass);
    } catch (err) {
      const detail = err.data && err.data.error ? err.data.error : err.message;
      msg(detail || 'Failed to save timetable', true);
    }
  }

  async function deleteTimetable() {
    if (!currentTimetableClass) return;
    if (!confirm(`Are you sure you want to delete the timetable for ${currentTimetableClass}?`)) return;
    
    try {
      await SSC_API.delete(`/admin/timetable/${currentTimetableClass}`);
      msg('Timetable deleted');
      allTimetablesCache = await SSC_API.get('/admin/timetable');
      document.getElementById('tt-grid-container').style.display = 'none';
      document.getElementById('tt-delete-btn').style.display = 'none';
    } catch (err) {
      msg(err.message || 'Failed to delete', true);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LIBRARY MODULE
  // ═══════════════════════════════════════════════════════════════════════════
  async function loadLibraryPanel() {
    setupLibraryTabs();
    await loadLibraryBooks();
  }

  function setupLibraryTabs() {
    const tabs = [
      { tab: 'lib-tab-books', view: 'lib-books-view' },
      { tab: 'lib-tab-issue', view: 'lib-issue-view', action: setupLibraryIssueForm },
      { tab: 'lib-tab-active', view: 'lib-active-view', action: loadLibraryIssues },
      { tab: 'lib-tab-analytics', view: 'lib-analytics-view', action: loadLibraryAnalytics }
    ];
    
    tabs.forEach(t => {
      const btn = document.getElementById(t.tab);
      if (btn && !btn.dataset.bound) {
        btn.dataset.bound = '1';
        btn.addEventListener('click', async () => {
          tabs.forEach(x => {
            document.getElementById(x.tab).classList.remove('active');
            document.getElementById(x.view).style.display = 'none';
          });
          btn.classList.add('active');
          document.getElementById(t.view).style.display = 'block';
          if (t.action) await t.action();
        });
      }
    });

    const addBtn = document.getElementById('lib-add-book-btn');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = '1';
      addBtn.addEventListener('click', () => {
        document.getElementById('lib-book-form-title').textContent = 'Add New Book';
        document.getElementById('lib-book-id').value = '';
        document.getElementById('lib-book-form').reset();
        document.getElementById('lib-book-form-card').style.display = 'block';
      });
      
      document.getElementById('lib-book-cancel-btn').addEventListener('click', () => {
        document.getElementById('lib-book-form-card').style.display = 'none';
      });
      
      document.getElementById('lib-book-form').addEventListener('submit', saveLibraryBook);
    }
  }

  async function loadLibraryBooks() {
    const books = await SSC_API.get('/admin/library/books');
    const tbody = document.querySelector('#tbl-lib-books tbody');
    tbody.innerHTML = '';
    
    books.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(b.title)}</strong></td>
        <td>${esc(b.author)}</td>
        <td>${esc(b.category)}</td>
        <td>${esc(b.isbn)}</td>
        <td>${esc(b.shelfLocation)}</td>
        <td>${b.availableQty} / ${b.totalQty}</td>
        <td>
          <button class="btn secondary small edit-book-btn" data-id="${b.id}" style="color:var(--text)">Edit</button>
          <button class="btn danger small delete-book-btn" data-id="${b.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.edit-book-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const b = books.find(x => x.id === id);
        if (b) {
          document.getElementById('lib-book-form-title').textContent = 'Edit Book';
          document.getElementById('lib-book-id').value = b.id;
          document.getElementById('lib-book-title').value = b.title;
          document.getElementById('lib-book-author').value = b.author;
          document.getElementById('lib-book-isbn').value = b.isbn;
          document.getElementById('lib-book-category').value = b.category;
          document.getElementById('lib-book-qty').value = b.totalQty;
          document.getElementById('lib-book-shelf').value = b.shelfLocation;
          document.getElementById('lib-book-form-card').style.display = 'block';
        }
      });
    });

    tbody.querySelectorAll('.delete-book-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (confirm('Are you sure you want to delete this book?')) {
          await SSC_API.delete(`/admin/library/books/${id}`);
          msg('Book deleted successfully');
          loadLibraryBooks();
        }
      });
    });
  }

  async function saveLibraryBook(e) {
    e.preventDefault();
    const id = document.getElementById('lib-book-id').value;
    const data = {
      title: document.getElementById('lib-book-title').value.trim(),
      author: document.getElementById('lib-book-author').value.trim(),
      isbn: document.getElementById('lib-book-isbn').value.trim(),
      category: document.getElementById('lib-book-category').value.trim(),
      totalQty: Number(document.getElementById('lib-book-qty').value),
      shelfLocation: document.getElementById('lib-book-shelf').value.trim()
    };
    
    try {
      if (id) {
        await SSC_API.patch(`/admin/library/books/${id}`, data);
        msg('Book updated successfully');
      } else {
        await SSC_API.post('/admin/library/books', data);
        msg('Book created successfully');
      }
      document.getElementById('lib-book-form-card').style.display = 'none';
      loadLibraryBooks();
    } catch (err) {
      msg(err.data && err.data.error ? err.data.error : err.message, true);
    }
  }

  async function setupLibraryIssueForm() {
    const studentSelect = document.getElementById('lib-issue-student');
    const bookSelect = document.getElementById('lib-issue-book');
    const msgEl = document.getElementById('lib-issue-msg');
    
    studentSelect.innerHTML = '<option value="">-- Choose Student --</option>';
    bookSelect.innerHTML = '<option value="">-- Choose Book --</option>';
    msgEl.textContent = '';
    msgEl.className = 'small mt-3';

    const dt = new Date();
    dt.setDate(dt.getDate() + 14);
    document.getElementById('lib-issue-duedate').value = dt.toISOString().split('T')[0];

    const [students, books] = await Promise.all([
      SSC_API.get('/admin/students'),
      SSC_API.get('/admin/library/books')
    ]);

    students.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.id;
      const sp = s.studentProfile || {};
      opt.textContent = `${s.name} (${sp.rollNumber || ''} - ${sp.className || ''})`;
      studentSelect.appendChild(opt);
    });

    books.filter(b => b.availableQty > 0).forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = `${b.title} by ${b.author} [ISBN: ${b.isbn || 'N/A'}] (${b.availableQty} available)`;
      bookSelect.appendChild(opt);
    });

    const form = document.getElementById('lib-issue-form');
    if (!form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msgEl.textContent = '';
        msgEl.className = 'small mt-3';
        
        const studentId = studentSelect.value;
        const bookId = bookSelect.value;
        const dueDate = document.getElementById('lib-issue-duedate').value;
        
        try {
          await SSC_API.post('/admin/library/issues', { studentId, bookId, dueDate });
          msgEl.textContent = 'Book issued successfully!';
          msgEl.className = 'small mt-3 alert success';
          form.reset();
          setupLibraryIssueForm();
        } catch (err) {
          msgEl.textContent = err.data && err.data.error ? err.data.error : err.message;
          msgEl.className = 'small mt-3 alert error';
        }
      });
    }
  }

  async function loadLibraryIssues() {
    const issues = await SSC_API.get('/admin/library/issues');
    const tbody = document.querySelector('#tbl-lib-issues tbody');
    tbody.innerHTML = '';
    
    issues.forEach(is => {
      const tr = document.createElement('tr');
      const isOverdue = !is.returnedAt && new Date(is.dueDate) < new Date();
      let statusStr = is.status;
      if (isOverdue) statusStr = '<span class="highlight">Overdue</span>';
      
      tr.innerHTML = `
        <td><strong>${esc(is.student?.name)}</strong><br><small>${esc(is.student?.email)}</small></td>
        <td><strong>${esc(is.book?.title)}</strong></td>
        <td>${new Date(is.issuedAt).toLocaleDateString()}</td>
        <td>${new Date(is.dueDate).toLocaleDateString()}</td>
        <td>${statusStr}</td>
        <td>₹${is.fine || 0}</td>
        <td>
          ${!is.returnedAt ? `<button class="btn small return-book-btn" data-id="${is.id}" style="color:#000;">Return Book</button>` : `Returned on ${new Date(is.returnedAt).toLocaleDateString()}`}
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.return-book-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          const res = await SSC_API.post(`/admin/library/issues/${id}/return`);
          msg(`Book returned successfully. Fine: ₹${res.fine || 0}`);
          loadLibraryIssues();
        } catch (err) {
          msg(err.message || 'Return failed', true);
        }
      });
    });
  }

  async function loadLibraryAnalytics() {
    const a = await SSC_API.get('/admin/library/analytics');
    
    document.getElementById('lib-stat-active').textContent = a.activeIssuesCount;
    document.getElementById('lib-stat-overdue').textContent = a.overdueIssuesCount;
    
    const overdueBody = document.querySelector('#tbl-lib-overdue-list tbody');
    overdueBody.innerHTML = '';
    if (!a.overdueList.length) {
      overdueBody.innerHTML = '<tr><td colspan="4" class="center small">No overdue books</td></tr>';
    } else {
      a.overdueList.forEach(is => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${esc(is.student?.name)}</strong></td>
          <td>${esc(is.book?.title)}</td>
          <td>${new Date(is.dueDate).toLocaleDateString()}</td>
          <td><span class="highlight">₹${is.fine || 0}</span></td>
        `;
        overdueBody.appendChild(tr);
      });
    }
    
    const popBody = document.querySelector('#tbl-lib-popular-books tbody');
    popBody.innerHTML = '';
    if (!a.mostIssued.length) {
      popBody.innerHTML = '<tr><td colspan="4" class="center small">No borrow records yet</td></tr>';
    } else {
      a.mostIssued.forEach(b => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${esc(b.title)}</strong></td>
          <td>${esc(b.author)}</td>
          <td>${esc(b.category)}</td>
          <td><strong>${b.issueCount}</strong> times</td>
        `;
        popBody.appendChild(tr);
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EXAMINATIONS MODULE
  // ═══════════════════════════════════════════════════════════════════════════
  async function loadExamsPanel() {
    setupExamForm();
    await loadExams();
  }

  function setupExamForm() {
    const addBtn = document.getElementById('exam-add-btn');
    if (addBtn && !addBtn.dataset.bound) {
      addBtn.dataset.bound = '1';
      
      addBtn.addEventListener('click', async () => {
        document.getElementById('exam-form-title').textContent = 'Create Exam Schedule';
        document.getElementById('exam-id').value = '';
        document.getElementById('exam-form').reset();
        
        const classSel = document.getElementById('exam-class');
        classSel.innerHTML = '<option value="">-- Choose Class --</option>';
        const classes = await SSC_API.get('/admin/timetable/classes');
        classes.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c;
          opt.textContent = c;
          classSel.appendChild(opt);
        });
        
        document.getElementById('exam-form-card').style.display = 'block';
      });

      document.getElementById('exam-cancel-btn').addEventListener('click', () => {
        document.getElementById('exam-form-card').style.display = 'none';
      });

      document.getElementById('exam-form').addEventListener('submit', saveExamSchedule);
    }
  }

  async function loadExams() {
    const exams = await SSC_API.get('/admin/exams');
    const tbody = document.querySelector('#tbl-exams tbody');
    tbody.innerHTML = '';
    
    exams.forEach(ex => {
      const tr = document.createElement('tr');
      const dateStr = ex.examDate ? new Date(ex.examDate).toLocaleDateString() : 'N/A';
      
      tr.innerHTML = `
        <td><strong>${esc(ex.title)}</strong></td>
        <td><span style="text-transform: capitalize;">${ex.examType}</span></td>
        <td>${esc(ex.className)}</td>
        <td>${esc(ex.subject)}</td>
        <td>${dateStr}</td>
        <td>${ex.maxMarks}</td>
        <td>
          <button class="btn small toggle-pub-btn ${ex.isPublished ? 'secondary' : ''}" data-id="${ex.id}" data-val="${ex.isPublished}" style="color: ${ex.isPublished ? 'var(--text)' : '#000'}">
            ${ex.isPublished ? 'Unpublish' : 'Publish'}
          </button>
        </td>
        <td>
          <button class="btn small toggle-res-btn ${ex.resultsPublished ? 'secondary' : ''}" data-id="${ex.id}" data-val="${ex.resultsPublished}" style="color: ${ex.resultsPublished ? 'var(--text)' : '#000'}">
            ${ex.resultsPublished ? 'Hide Results' : 'Publish Results'}
          </button>
        </td>
        <td>
          <button class="btn secondary small edit-exam-btn" data-id="${ex.id}" style="color:var(--text)">Edit</button>
          <button class="btn danger small delete-exam-btn" data-id="${ex.id}">Delete</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.toggle-pub-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const current = btn.dataset.val === 'true';
        await SSC_API.patch(`/admin/exams/${id}`, { isPublished: !current });
        msg(`Exam schedule ${!current ? 'published' : 'unpublished'}`);
        loadExams();
      });
    });

    tbody.querySelectorAll('.toggle-res-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const current = btn.dataset.val === 'true';
        await SSC_API.patch(`/admin/exams/${id}`, { resultsPublished: !current });
        msg(`Exam results ${!current ? 'published' : 'hidden'}`);
        loadExams();
      });
    });

    tbody.querySelectorAll('.edit-exam-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const ex = exams.find(x => x.id === id);
        if (ex) {
          document.getElementById('exam-form-title').textContent = 'Edit Exam Schedule';
          document.getElementById('exam-id').value = ex.id;
          document.getElementById('exam-title').value = ex.title;
          document.getElementById('exam-type').value = ex.examType;
          document.getElementById('exam-subject').value = ex.subject;
          document.getElementById('exam-date').value = ex.examDate ? ex.examDate.split('T')[0] : '';
          document.getElementById('exam-time').value = ex.startTime;
          document.getElementById('exam-duration').value = ex.duration;
          document.getElementById('exam-venue').value = ex.venue;
          document.getElementById('exam-maxmarks').value = ex.maxMarks;
          
          const classSel = document.getElementById('exam-class');
          classSel.innerHTML = '<option value="">-- Choose Class --</option>';
          const classes = await SSC_API.get('/admin/timetable/classes');
          classes.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            if (c === ex.className) opt.selected = true;
            classSel.appendChild(opt);
          });
          
          document.getElementById('exam-form-card').style.display = 'block';
        }
      });
    });

    tbody.querySelectorAll('.delete-exam-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        if (confirm('Are you sure you want to delete this exam schedule?')) {
          await SSC_API.delete(`/admin/exams/${id}`);
          msg('Exam schedule deleted');
          loadExams();
        }
      });
    });
  }

  async function saveExamSchedule(e) {
    e.preventDefault();
    const id = document.getElementById('exam-id').value;
    const data = {
      title: document.getElementById('exam-title').value.trim(),
      examType: document.getElementById('exam-type').value,
      className: document.getElementById('exam-class').value,
      subject: document.getElementById('exam-subject').value.trim(),
      examDate: document.getElementById('exam-date').value,
      startTime: document.getElementById('exam-time').value.trim(),
      duration: document.getElementById('exam-duration').value.trim(),
      venue: document.getElementById('exam-venue').value.trim(),
      maxMarks: Number(document.getElementById('exam-maxmarks').value)
    };

    try {
      if (id) {
        await SSC_API.patch(`/admin/exams/${id}`, data);
        msg('Exam schedule updated successfully');
      } else {
        await SSC_API.post('/admin/exams', data);
        msg('Exam schedule created successfully');
      }
      document.getElementById('exam-form-card').style.display = 'none';
      loadExams();
    } catch (err) {
      msg(err.message || 'Save failed', true);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEACHER LEAVES MODULE
  // ═══════════════════════════════════════════════════════════════════════════
  async function loadLeavesPanel() {
    const leaves = await SSC_API.get('/admin/leave');
    const tbody = document.querySelector('#tbl-admin-leaves tbody');
    tbody.innerHTML = '';
    
    if (!leaves.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="center small">No leave requests found</td></tr>';
      return;
    }

    leaves.forEach(lv => {
      const tr = document.createElement('tr');
      const start = new Date(lv.fromDate).toLocaleDateString();
      const end = new Date(lv.toDate).toLocaleDateString();
      
      let statusStr = lv.status;
      if (lv.status === 'pending') statusStr = '<span class="highlight">Pending</span>';
      else if (lv.status === 'approved') statusStr = '<span style="color:var(--accent);">Approved</span>';
      else if (lv.status === 'rejected') statusStr = '<span style="color:#ef4444;">Rejected</span>';

      tr.innerHTML = `
        <td><strong>${esc(lv.teacher?.name)}</strong><br><small>${esc(lv.teacher?.email)}</small></td>
        <td><span style="text-transform: capitalize;">${lv.leaveType}</span></td>
        <td>${start} to ${end}</td>
        <td>${esc(lv.reason)}</td>
        <td>${statusStr}</td>
        <td>${esc(lv.adminNote || 'None')}</td>
        <td>
          ${lv.status === 'pending' ? `
            <button class="btn small approve-leave-btn" data-id="${lv.id}" style="color:#000;">Approve</button>
            <button class="btn danger small reject-leave-btn" data-id="${lv.id}">Reject</button>
          ` : 'Processed'}
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.approve-leave-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const note = prompt('Enter approval note (optional):');
        if (note === null) return;
        try {
          await SSC_API.patch(`/admin/leave/${id}`, { status: 'approved', adminNote: note });
          msg('Leave request approved');
          loadLeavesPanel();
        } catch (err) {
          msg(err.message || 'Action failed', true);
        }
      });
    });

    tbody.querySelectorAll('.reject-leave-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const note = prompt('Enter rejection note (optional):');
        if (note === null) return;
        try {
          await SSC_API.patch(`/admin/leave/${id}`, { status: 'rejected', adminNote: note });
          msg('Leave request rejected');
          loadLeavesPanel();
        } catch (err) {
          msg(err.message || 'Action failed', true);
        }
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
