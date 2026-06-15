(function () {
  const msg = (t, err) => {
    const el = document.getElementById('dash-msg');
    el.textContent = t || '';
    el.className = 'small mt-3' + (err ? ' alert error' : t ? ' alert success' : '');
  };

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
      const [students, teachers, admissions, notices, courses, departments] = await Promise.all([
        SSC_API.get('/admin/students').catch(() => []),
        SSC_API.get('/admin/teachers').catch(() => []),
        SSC_API.get('/admin/admissions').catch(() => []),
        SSC_API.get('/admin/notices').catch(() => []),
        SSC_API.get('/admin/courses').catch(() => []),
        SSC_API.get('/admin/departments').catch(() => []),
      ]);
      searchIndex = { students, teachers, admissions, notices, courses, departments };
      searchLoaded = true;
      // Update notification badge with pending admissions
      const pending = admissions.filter(a => String(a.status || '').toLowerCase() === 'pending').length;
      const badge = document.getElementById('notif-badge');
      if (badge) {
        if (pending > 0) { badge.textContent = pending; badge.style.display = ''; }
        else { badge.style.display = 'none'; }
      }
    } catch { /* silent */ }
  }

  function navigateToPanel(panelId) {
    const allBtns = document.querySelectorAll('.dash-nav button[data-panel]');
    allBtns.forEach(b => b.classList.remove('active'));
    const target = document.querySelector(`.dash-nav button[data-panel="${panelId}"]`);
    if (target) target.classList.add('active');
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
        .slice(0, 4).forEach(s => results.push({ group: 'Students', panel: 'students', label: s.name, sub: s.email }));

      // Search teachers
      searchIndex.teachers.filter(t => (t.name || '').toLowerCase().includes(lq) || (t.email || '').toLowerCase().includes(lq))
        .slice(0, 4).forEach(t => results.push({ group: 'Faculty', panel: 'teachers', label: t.name, sub: t.email }));

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
            html += `<div class="search-result-item" data-panel="${item.panel}">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span>${esc(item.label)}${item.sub ? ' <span style="color:var(--muted);font-size:0.78rem;">— ' + esc(item.sub) + '</span>' : ''}</span>
            </div>`;
          });
          html += '</div>';
        }
        resultsEl.innerHTML = html;
        resultsEl.querySelectorAll('.search-result-item').forEach(el => {
          el.addEventListener('click', () => {
            navigateToPanel(el.dataset.panel);
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
    } catch {
      SSC_API.setToken(null);
      showGate();
      return;
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
      SSC_API.setToken(null);
      showGate();
    });

    // Sidebar navigation — support multiple .dash-nav groups
    document.querySelectorAll('.dash-nav button[data-panel]').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.dash-nav button[data-panel]').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
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
      const students = await SSC_API.get('/admin/students');
      // Check for students with low attendance data
      const lowAttendance = students.filter(s => {
        const att = s.studentProfile && s.studentProfile.attendancePercentage;
        return att !== undefined && att !== null && Number(att) < 75;
      });

      if (lowAttendance.length === 0) {
        el.innerHTML = `
          <div style="text-align:center;padding:1rem 0;">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <p class="small mt-2" style="color:var(--accent);font-weight:600;">All students above 75% attendance</p>
            <p class="small">No low attendance alerts at this time.</p>
          </div>
        `;
        return;
      }

      let html = '<table class="table small"><thead><tr><th>Student</th><th>Class</th><th>Attendance</th></tr></thead><tbody>';
      lowAttendance.slice(0, 5).forEach(s => {
        const att = Number(s.studentProfile.attendancePercentage);
        const color = att < 50 ? 'var(--danger)' : 'var(--warning)';
        html += `<tr>
          <td>${esc(s.name)}</td>
          <td>${esc(s.studentProfile.className || '—')}</td>
          <td><span style="color:${color};font-weight:600;">${att}%</span></td>
        </tr>`;
      });
      html += '</tbody></table>';
      el.innerHTML = html;
    } catch { el.innerHTML = '<p class="small">Attendance data not available</p>'; }
  }

  async function loadStudents() {
    const rows = await SSC_API.get('/admin/students');
    const tb = document.querySelector('#tbl-students tbody');
    tb.innerHTML = '';
    rows.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.studentProfile?.className || '')}</td>
        <td>
          <button class="btn small" data-edit-student="${u._id}">Edit</button>
          <button class="btn small danger" data-del-student="${u._id}">Delete</button>
        </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-edit-student]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-edit-student');
        const cur = rows.find((x) => x._id === id);
        if (!cur) return;
        const name = prompt('Student name', cur.name || '');
        if (name === null) return;
        const phone = prompt('Phone', cur.phone || '') || '';
        const className = prompt('Class name', cur.studentProfile?.className || '') || '';
        const rollNumber = prompt('Roll number', cur.studentProfile?.rollNumber || '') || '';
        const courseName = prompt('Course name', cur.studentProfile?.courseName || '') || '';
        const year = prompt('Year', cur.studentProfile?.year || '') || '';
        await SSC_API.patch('/admin/students/' + id, {
          name: name.trim(),
          phone: phone.trim(),
          studentProfile: {
            className: className.trim(),
            rollNumber: rollNumber.trim(),
            courseName: courseName.trim(),
            year: year.trim(),
          },
        });
        msg('Student updated');
        loadStudents();
      })
    );
    tb.querySelectorAll('[data-del-student]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Delete this student user?')) return;
        await SSC_API.delete('/admin/students/' + b.getAttribute('data-del-student'));
        loadStudents();
      })
    );
  }

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
    await SSC_API.post('/admin/students', body);
    f.reset();
    msg('Student created');
    loadStudents();
  });

  async function loadTeachers() {
    const rows = await SSC_API.get('/admin/teachers');
    const tb = document.querySelector('#tbl-teachers tbody');
    tb.innerHTML = '';
    rows.forEach((u) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${esc(u.teacherProfile?.department || '')}</td>
        <td>
          <button class="btn small" data-edit-teacher="${u._id}">Edit</button>
          <button class="btn small danger" data-del-teacher="${u._id}">Delete</button>
        </td>`;
      tb.appendChild(tr);
    });
    tb.querySelectorAll('[data-edit-teacher]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-edit-teacher');
        const cur = rows.find((x) => x._id === id);
        if (!cur) return;
        const name = prompt('Teacher name', cur.name || '');
        if (name === null) return;
        const phone = prompt('Phone', cur.phone || '') || '';
        const department = prompt('Department', cur.teacherProfile?.department || '') || '';
        const designation = prompt('Designation', cur.teacherProfile?.designation || '') || '';
        await SSC_API.patch('/admin/teachers/' + id, {
          name: name.trim(),
          phone: phone.trim(),
          teacherProfile: {
            department: department.trim(),
            designation: designation.trim(),
          },
        });
        msg('Teacher updated');
        loadTeachers();
      })
    );
    tb.querySelectorAll('[data-del-teacher]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Delete this teacher user?')) return;
        await SSC_API.delete('/admin/teachers/' + b.getAttribute('data-del-teacher'));
        msg('Teacher removed');
        loadTeachers();
      })
    );
  }

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
    await SSC_API.post('/admin/teachers', {
      email: f.email.value.trim(),
      password: f.password.value,
      name: f.name.value.trim(),
      employeeId: f.employeeId.value.trim(),
      department: f.department.value.trim(),
      assignments,
    });
    f.reset();
    msg('Teacher created');
    loadTeachers();
  });

  async function loadAdmissions() {
    const rows = await SSC_API.get('/admin/admissions');
    const tb = document.querySelector('#tbl-admissions tbody');
    tb.innerHTML = '';
    rows.forEach((a) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(a.applicationNumber)}</td><td>${esc(a.fullName)}</td><td>${esc(a.courseApplied)}</td>
        <td>${a.marks12}/${a.maxMarks12}</td><td>${esc(a.status)}</td>
        <td>
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
        await SSC_API.patch('/admin/admissions/' + id + '/verify', {
          documentsVerified: !cur.documentsVerified,
        });
        loadAdmissions();
      })
    );
    tb.querySelectorAll('[data-approve]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-approve');
        const roll = prompt('Roll number for new student account?', 'BA24001');
        const cls = prompt('Class name (must match teacher assignments)?', 'FY-BA-A');
        const data = await SSC_API.post('/admin/admissions/' + id + '/decision', {
          status: 'approved',
          createAccount: true,
          rollNumber: roll,
          className: cls,
        });
        msg(
          data.studentAccount
            ? 'Approved. Temporary password: ' + data.studentAccount.temporaryPassword
            : 'Approved'
        );
        loadAdmissions();
      })
    );
    tb.querySelectorAll('[data-reject]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-reject');
        const notes = prompt('Reason / notes?', '') || '';
        await SSC_API.post('/admin/admissions/' + id + '/decision', { status: 'rejected', notes });
        loadAdmissions();
      })
    );
  }

  async function loadNotices() {
    const items = await SSC_API.get('/admin/notices');
    const box = document.getElementById('notice-list');
    box.innerHTML = '';
    items.forEach((n) => {
      const div = document.createElement('div');
      div.className = 'card mt-2';
      div.innerHTML = `<strong>${esc(n.title)}</strong>
        <p class="small">${esc(n.body || '')}</p>
        <button class="btn small" data-edit-notice="${n._id}">Edit</button>
        <button class="btn small danger mt-2" data-del-notice="${n._id}">Delete</button>`;
      box.appendChild(div);
    });
    box.querySelectorAll('[data-edit-notice]').forEach((b) =>
      b.addEventListener('click', async () => {
        const id = b.getAttribute('data-edit-notice');
        const cur = items.find((x) => x._id === id);
        if (!cur) return;
        const title = prompt('Notice title', cur.title || '');
        if (title === null) return;
        const body = prompt('Notice body', cur.body || '') || '';
        await SSC_API.patch('/admin/notices/' + id, { title: title.trim(), body });
        msg('Notice updated');
        loadNotices();
      })
    );
    box.querySelectorAll('[data-del-notice]').forEach((b) =>
      b.addEventListener('click', async () => {
        await SSC_API.delete('/admin/notices/' + b.getAttribute('data-del-notice'));
        loadNotices();
      })
    );
  }

  document.getElementById('form-notice').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const fd = new FormData();
    fd.append('title', f.title.value);
    fd.append('body', f.body.value);
    const pdf = f.querySelector('[name="pdf"]').files[0];
    if (pdf) fd.append('pdf', pdf);
    await SSC_API.upload('/admin/notices', fd);
    f.reset();
    msg('Notice published');
    loadNotices();
  });

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
    document.getElementById('set-map').value = s.mapEmbedUrl || '';
    document.getElementById('set-tag').value = s.siteTagline || '';
    const syllabus = document.getElementById('set-syllabus');
    const prospectus = document.getElementById('set-prospectus');
    if (syllabus) syllabus.value = s.syllabusPdfUrl || '';
    if (prospectus) prospectus.value = s.prospectusPdfUrl || '';
  }

  document.getElementById('form-settings').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    await SSC_API.put('/admin/settings', {
      mapEmbedUrl: f.mapEmbedUrl.value.trim(),
      siteTagline: f.siteTagline.value.trim(),
      syllabusPdfUrl: f.syllabusPdfUrl.value.trim(),
      prospectusPdfUrl: f.prospectusPdfUrl.value.trim(),
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
      <div class="stat-card"><span class="small">Students &lt;75%</span><strong style="color: #ef4444">${data.lowAttendanceCount}</strong></div>
    `;

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

    const tblClass = document.querySelector('#tbl-class-att tbody');
    tblClass.innerHTML = '';
    if (!data.classSummary.length) {
      tblClass.innerHTML = '<tr><td colspan="3" class="small">No records found.</td></tr>';
    } else {
      data.classSummary.forEach((c) => {
        const tr = document.createElement('tr');
        const color = c.percentage < 75 ? 'color: #ef4444; font-weight: bold;' : '';
        tr.innerHTML = `
          <td>${esc(c.className)}</td>
          <td>${c.totalLogs}</td>
          <td style="${color}">${c.percentage}%</td>
        `;
        tblClass.appendChild(tr);
      });
    }

    const tblSubject = document.querySelector('#tbl-subject-att tbody');
    tblSubject.innerHTML = '';
    if (!data.subjectSummary.length) {
      tblSubject.innerHTML = '<tr><td colspan="3" class="small">No records found.</td></tr>';
    } else {
      data.subjectSummary.forEach((s) => {
        const tr = document.createElement('tr');
        const color = s.percentage < 75 ? 'color: #ef4444; font-weight: bold;' : '';
        tr.innerHTML = `
          <td>${esc(s.subject)}</td>
          <td>${s.totalLogs}</td>
          <td style="${color}">${s.percentage}%</td>
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
          const color = m.percentage < 75 ? 'color: #ef4444; font-weight: bold;' : 'color: #22c55e;';
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
    if (!lastAnalyticsData) {
      msg('No analytics data to export', true);
      return;
    }
    let csv = 'Roll Number,Name,Class,Attended,Total Classes,Percentage\n';
    lastAnalyticsData.lowAttendanceList.forEach(s => {
      csv += `"${s.rollNumber}","${s.name}","${s.className}",${s.attended},${s.totalClasses},${s.percentage}%\n`;
    });
    downloadCSV(csv, 'low_attendance_report.csv');
  }

  function exportExcel() {
    if (!lastAnalyticsData) {
      msg('No analytics data to export', true);
      return;
    }
    let xls = 'Roll Number\tName\tClass\tAttended\tTotal Classes\tPercentage\n';
    lastAnalyticsData.lowAttendanceList.forEach(s => {
      xls += `"${s.rollNumber}"\t"${s.name}"\t"${s.className}"\t${s.attended}\t${s.totalClasses}\t${s.percentage}%\n`;
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
        <td><strong>${esc(c.companyName)}</strong><br><span class="small">${esc(c.website || '')}</span></td>
        <td>${esc(c.industry)}</td>
        <td>${esc(c.packageOffered)}</td>
        <td>${esc(c.location)}</td>
        <td>${c.drives || 0}</td>
        <td>
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
        <td>${esc(d.company?.companyName || '')}</td>
        <td><strong>${esc(d.title)}</strong></td>
        <td>${driveDate}</td>
        <td>${deadline}</td>
        <td><span style="color:${sColor};font-weight:600">${esc(d.status)}</span></td>
        <td>${d.applicationCount || 0}</td>
        <td>
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
          <select class="select input" style="padding:0.3rem 0.5rem;font-size:0.8rem;" data-app-id="${a._id}">
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
        await SSC_API.patch('/admin/placement/applications/' + id + '/status', { applicationStatus: sel.value });
        msg('Application status updated');
        loadPlAnalytics();
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
