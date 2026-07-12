(function () {
  let studentsCache = [];
  let teacherExamsCache = [];
  let existingAttendanceList = [];
  let searchLoaded = false;
  let searchIndex = { students: [], subjects: [] };
  let activeNotifications = [];
  let readNotifications = [];

  // Toast Notification System
  function showToast(message, type = 'info', undoCallback = null) {
    const container = document.getElementById('toast-container');
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

  // Shimmer skeleton helper
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
    const el = document.getElementById('dash-msg');
    if (el) {
      el.textContent = t || '';
      el.className = 'small mt-3' + (err ? ' alert error' : t ? ' alert success' : '');
    }
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
        <a href="#" onclick="event.preventDefault(); window.panel('profile')">Teacher Portal</a>
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
    const titleEl = document.getElementById('dash-title');
    if (activeBtn && titleEl) {
      titleEl.textContent = activeBtn.textContent.trim();
    }
    updateBreadcrumbs(activeBtn ? activeBtn.textContent.trim() : (id === 'profile' ? 'Dashboard' : id));
  }
  window.panel = panel; // Exposed globally

  async function boot() {
    if (!SSC_API.token()) {
      location.href = '../login.html';
      return;
    }
    try {
      const { user } = await SSC_API.get('/auth/me');
      if (String(user.role || '').toLowerCase() !== 'teacher') {
        SSC_API.setToken(null);
        location.href = '../login.html';
        return;
      }
      
      // Update topbar profile info
      const nameEl = document.getElementById('teacher-user');
      if (nameEl) nameEl.textContent = user.name || 'Teacher';
      const avatarEl = document.getElementById('teacher-avatar');
      if (avatarEl) {
        if (user.avatarUrl) {
          avatarEl.innerHTML = `<img src="${esc(user.avatarUrl)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>`;
        } else {
          avatarEl.textContent = (user.name || 'T').charAt(0).toUpperCase();
        }
      }
      const roleEl = document.getElementById('teacher-role');
      if (roleEl) {
        const designation = user.teacherProfile?.designation || 'Faculty';
        roleEl.textContent = designation;
      }

      const whoEl = document.getElementById('who');
      if (whoEl) {
        const avatarImg = user.avatarUrl ? `<img src="${esc(user.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:0.5rem;border:1px solid rgba(56,189,248,0.3);"/>` : '';
        whoEl.innerHTML = `${avatarImg}<span>${esc(user.name)}</span>`;
      }

      // Wires
      setupSearch();
      setupNotifications();
      checkPasswordForcedChange(user);
      setupChangePasswordForm();
      setupBulkMarks();
      setupMobileMenu();
      setupTeacherIdCard(user);
      
      const quickEditCredsBtn = document.getElementById('btn-quick-edit-creds');
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

      setupStudentDrawer();
      setupProfileSubTabs();

      if (user.mustChangePassword !== true) {
        initOnboardingTour();
      }

    } catch (e) {
      console.error(e);
      SSC_API.setToken(null);
      location.href = '../login.html';
      return;
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        SSC_API.setToken(null);
        location.href = '../login.html';
      });
    }

    document.querySelectorAll('.dash-nav button').forEach((btn) => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-panel');
        panel(pId);
        load(pId);
      });
    });

    const attDateInput = document.getElementById('att-date');
    if (attDateInput) attDateInput.valueAsDate = new Date();

    const attSaveBtn = document.getElementById('att-save');
    if (attSaveBtn) {
      attSaveBtn.addEventListener('click', async (e) => {
        const btn = e.target;
        if (btn.disabled) return;
        btn.disabled = true;
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        
        const subject = document.getElementById('att-subject').value.trim();
        const date = document.getElementById('att-date').value;
        if (!subject || !date) {
          showToast('Subject and Date are required', 'error');
          btn.disabled = false;
          btn.textContent = originalText;
          return;
        }
        
        if (existingAttendanceList && existingAttendanceList.length > 0) {
          const modal = document.getElementById('modal-att-duplicate');
          if (modal) modal.style.display = 'flex';
          btn.disabled = false;
          btn.textContent = originalText;
          return;
        }

        try {
          await submitAttendance();
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
        }
      });
    }

    async function submitAttendance() {
      const subject = document.getElementById('att-subject').value.trim();
      const date = document.getElementById('att-date').value;
      const entries = [];
      document.querySelectorAll('#att-rows input[type="checkbox"]').forEach((cb) => {
        entries.push({
          studentId: cb.getAttribute('data-sid'),
          status: cb.checked ? 'present' : 'absent',
        });
      });

      // Backup checkboxes state for Undo capability
      const previousCheckboxes = Array.from(document.querySelectorAll('#att-rows input[type="checkbox"]')).map(cb => ({
        sid: cb.getAttribute('data-sid'),
        checked: cb.checked
      }));

      try {
        await SSC_API.post('/teacher/attendance', { subject, date, entries });
        
        showToast('Attendance saved successfully!', 'success', async () => {
          // Undo save
          try {
            const undoEntries = previousCheckboxes.map(pb => ({
              studentId: pb.sid,
              // We'll revert by checking the inverse of the current checkboxes, or load previous log status?
              // Since we saved checks before POST, to undo we should restore what was saved in the checkboxes.
              // Wait, the undo should restore what was stored on the server BEFORE this submit!
              // But we can just write back the checkboxes state that existed prior.
              status: pb.checked ? 'present' : 'absent'
            }));
            await SSC_API.post('/teacher/attendance', { subject, date, entries: undoEntries });
            
            // Re-sync UI checkboxes
            document.querySelectorAll('#att-rows input[type="checkbox"]').forEach(cb => {
              const prev = previousCheckboxes.find(p => p.sid === cb.getAttribute('data-sid'));
              if (prev) cb.checked = prev.checked;
            });
            showToast('Attendance save undone.', 'info');
            await checkExistingAttendance();
          } catch (err) {
            showToast('Failed to undo attendance save: ' + err.message, 'error');
          }
        });
        
        await checkExistingAttendance();
      } catch (err) {
        showToast(err.message || 'Could not save attendance', 'error');
      }
    }

    const btnDuplicateClose = document.getElementById('btn-duplicate-close');
    if (btnDuplicateClose) {
      btnDuplicateClose.addEventListener('click', () => {
        const modal = document.getElementById('modal-att-duplicate');
        if (modal) modal.style.display = 'none';
      });
    }

    const btnDuplicateCancel = document.getElementById('btn-duplicate-cancel');
    if (btnDuplicateCancel) {
      btnDuplicateCancel.addEventListener('click', () => {
        const modal = document.getElementById('modal-att-duplicate');
        if (modal) modal.style.display = 'none';
      });
    }

    const btnDuplicateView = document.getElementById('btn-duplicate-view');
    if (btnDuplicateView) {
      btnDuplicateView.addEventListener('click', () => {
        const modal = document.getElementById('modal-att-duplicate');
        if (modal) modal.style.display = 'none';
        if (existingAttendanceList && existingAttendanceList.length > 0) {
          const map = Object.fromEntries(existingAttendanceList.map(e => [String(e.studentId), e.status]));
          document.querySelectorAll('#att-rows input[type="checkbox"]').forEach(cb => {
            const sid = cb.getAttribute('data-sid');
            cb.checked = map[sid] === 'present';
          });
        }
      });
    }

    const btnDuplicateUpdate = document.getElementById('btn-duplicate-update');
    if (btnDuplicateUpdate) {
      btnDuplicateUpdate.addEventListener('click', async () => {
        const modal = document.getElementById('modal-att-duplicate');
        if (modal) modal.style.display = 'none';
        
        const saveBtn = document.getElementById('att-save');
        if (saveBtn) {
          saveBtn.disabled = true;
          const origText = saveBtn.textContent;
          saveBtn.textContent = 'Saving...';
          try {
            await submitAttendance();
          } finally {
            saveBtn.disabled = false;
            saveBtn.textContent = origText;
          }
        }
      });
    }

    const attSearchInput = document.getElementById('att-student-search');
    if (attSearchInput) {
      attSearchInput.addEventListener('input', () => {
        filterAttendanceStudents();
      });
    }

    let toggleAllState = true;
    const toggleAllBtn = document.getElementById('btn-att-toggle-all');
    if (toggleAllBtn) {
      toggleAllBtn.addEventListener('click', (e) => {
        e.preventDefault();
        const visibleCbs = document.querySelectorAll('#att-rows label:not([style*="display: none"]) input[type="checkbox"]');
        visibleCbs.forEach(cb => cb.checked = toggleAllState);
        e.target.textContent = toggleAllState ? 'Unmark All' : 'Mark All Present';
        toggleAllState = !toggleAllState;
      });
    }

    const attSubSelect = document.getElementById('att-subject');
    if (attSubSelect) attSubSelect.addEventListener('change', checkExistingAttendance);
    
    if (attDateInput) attDateInput.addEventListener('change', checkExistingAttendance);

    const formMat = document.getElementById('form-mat');
    if (formMat) {
      formMat.addEventListener('submit', async (e) => {
        e.preventDefault();
        const f = e.target;
        const fd = new FormData();
        fd.append('title', f.title.value);
        fd.append('subject', f.subject.value);
        fd.append('className', f.className.value);
        fd.append('file', f.file.files[0]);
        try {
          await SSC_API.upload('/teacher/materials', fd);
          f.reset();
          showToast('Material uploaded successfully!', 'success');
          loadMaterials();
        } catch (err) {
          showToast(err.message || 'Could not upload material', 'error');
        }
      });
    }

    const formProfile = document.getElementById('form-edit-profile');
    if (formProfile) {
      formProfile.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.append('name', document.getElementById('teacher-profile-name').value.trim());
        fd.append('phone', document.getElementById('teacher-profile-phone').value.trim());
        fd.append('qualifications', document.getElementById('teacher-profile-qual').value.trim());
        fd.append('bio', document.getElementById('teacher-profile-bio').value.trim());
        const avatarFile = document.getElementById('teacher-avatar-upload').files[0];
        if (avatarFile) fd.append('avatar', avatarFile);
        
        try {
          const resUser = await SSC_API.upload('/teacher/profile', fd, 'PATCH');
          showToast('Profile updated successfully!', 'success');
          const avatarImg = resUser.avatarUrl ? `<img src="${esc(resUser.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:0.5rem;border:1px solid rgba(56,189,248,0.3);"/>` : '';
          const whoEl = document.getElementById('who');
          if (whoEl) whoEl.innerHTML = `${avatarImg}<span>${esc(resUser.name)}</span>`;
          
          // Re-populate sidebar/topbar fields immediately
          const topName = document.getElementById('teacher-user');
          if (topName) topName.textContent = resUser.name;
          const topAvatar = document.getElementById('teacher-avatar');
          if (topAvatar) {
            if (resUser.avatarUrl) topAvatar.innerHTML = `<img src="${esc(resUser.avatarUrl)}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"/>`;
            else topAvatar.textContent = resUser.name.charAt(0).toUpperCase();
          }

          loadEditProfile();
        } catch (err) {
          showToast(err.message || 'Update failed', 'error');
        }
      });
    }

    setupKeyboardShortcuts();
    load('subjects');
  }
  window.load = load;

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
      if (id === 'subjects') await loadSubjects();
      if (id === 'students') await loadStudents();
      if (id === 'timetable') await loadTimetablePanel();
      if (id === 'marks') await loadMarksPanel();
      if (id === 'leave') await loadLeavePanel();
      if (id === 'attendance') await loadAttendancePanel();
      if (id === 'materials') await loadMaterials();
      if (id === 'notices') await loadNotices();
      if (id === 'edit-profile') await loadEditProfile();
    } catch (e) {
      showToast(e.message || 'Error loading data', 'error');
    }
  }

  async function loadSubjects() {
    const userRes = await SSC_API.get('/auth/me');
    const u = userRes.user || userRes;
    const tp = u.teacherProfile || {};

    // Populate top welcome
    const welcomeEl = document.getElementById('db-teach-welcome-name');
    if (welcomeEl) welcomeEl.textContent = `Welcome, ${u.name}!`;
    
    const metaEl = document.getElementById('db-teach-meta');
    if (metaEl) metaEl.textContent = `${tp.designation || 'Assistant Professor'} • ${tp.department || 'Department'}`;
    
    const dbAvatar = document.getElementById('db-teach-avatar-img');
    const dbPlaceholder = document.getElementById('db-teach-avatar-placeholder');
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

    // Fetch Assigned Subjects
    let subjectCount = 0;
    let assignments = [];
    try {
      const res = await SSC_API.get('/teacher/subjects');
      assignments = Array.isArray(res) ? res : [];
      subjectCount = assignments.length;
    } catch { /* fallback */ }

    const statSubjectsEl = document.getElementById('db-teach-stat-subjects');
    if (statSubjectsEl) statSubjectsEl.textContent = subjectCount;
    
    const statSubjectsDescEl = document.getElementById('db-teach-stat-subjects-desc');
    if (statSubjectsDescEl) {
      statSubjectsDescEl.textContent = subjectCount ? `${subjectCount} active courses` : 'No assignments';
    }

    // Populate Row 2 Assigned Subjects Table
    const tblSubjects = document.querySelector('#tbl-db-teach-subjects tbody');
    if (tblSubjects) {
      tblSubjects.innerHTML = '';
      if (!assignments.length) {
        tblSubjects.innerHTML = '<tr><td colspan="2" class="small text-muted text-center" style="opacity: 0.7; padding: 1.5rem;"><div class="empty-state">No subjects assigned.</div></td></tr>';
      } else {
        assignments.forEach(a => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td data-label="Subject"><strong>${esc(a.subject)}</strong></td><td data-label="Class">${esc(a.className)}</td>`;
          tblSubjects.appendChild(tr);
        });
      }
    }

    // Fetch Students Count
    let studentCount = 0;
    try {
      const students = await SSC_API.get('/teacher/students');
      if (Array.isArray(students)) {
        studentsCache = students;
        studentCount = students.length;
      }
    } catch { /* fallback */ }
    
    const statStudentsEl = document.getElementById('db-teach-stat-students');
    if (statStudentsEl) statStudentsEl.textContent = studentCount;
    
    const statStudentsDescEl = document.getElementById('db-teach-stat-students-desc');
    if (statStudentsDescEl) {
      statStudentsDescEl.textContent = studentCount ? `${studentCount} registered students` : 'No students found';
    }

    // Fetch Timetable & Today's Classes
    let todayClassesCount = 0;
    try {
      const slots = await SSC_API.get('/teacher/timetable');
      if (Array.isArray(slots)) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let todayDay = dayNames[new Date().getDay()];
        if (todayDay === 'Sunday') todayDay = 'Monday';
        todayClassesCount = slots.filter(s => s.day === todayDay).length;
      }
    } catch { /* fallback */ }
    
    const statTimetableEl = document.getElementById('db-teach-stat-timetable');
    if (statTimetableEl) statTimetableEl.textContent = todayClassesCount;
    
    const statTimetableDescEl = document.getElementById('db-teach-stat-timetable-desc');
    if (statTimetableDescEl) statTimetableDescEl.textContent = `Classes scheduled today`;

    // Fetch Pending Leaves count
    let pendingLeavesCount = 0;
    let leaveList = [];
    try {
      const leaves = await SSC_API.get('/teacher/leave');
      leaveList = Array.isArray(leaves) ? leaves : [];
      pendingLeavesCount = leaveList.filter(l => l.status === 'pending').length;
    } catch { /* fallback */ }
    
    const statLeavesEl = document.getElementById('db-teach-stat-leaves');
    if (statLeavesEl) statLeavesEl.textContent = pendingLeavesCount;
    
    const statLeavesDescEl = document.getElementById('db-teach-stat-leaves-desc');
    if (statLeavesDescEl) {
      statLeavesDescEl.textContent = pendingLeavesCount ? `${pendingLeavesCount} pending requests` : 'All decisions received';
    }

    // Fetch Scheduled Exams
    const tblExams = document.querySelector('#tbl-db-teach-exams tbody');
    if (tblExams) {
      tblExams.innerHTML = '';
      try {
        const exams = await SSC_API.get('/teacher/exams');
        const examList = Array.isArray(exams) ? exams : [];
        if (examList.length > 0) {
          examList.slice(0, 4).forEach(ex => {
            const tr = document.createElement('tr');
            const dt = ex.examDate ? new Date(ex.examDate).toLocaleDateString() : 'TBA';
            tr.innerHTML = `<td data-label="Exam"><strong>${esc(ex.title)}</strong></td><td data-label="Subject">${esc(ex.subject)}</td><td data-label="Date">${dt}</td>`;
            tblExams.appendChild(tr);
          });
        } else {
          tblExams.innerHTML = '<tr><td colspan="3" class="small text-muted text-center" style="opacity: 0.7; padding: 1.5rem;"><div class="empty-state">No scheduled exams.</div></td></tr>';
        }
      } catch {
        tblExams.innerHTML = '<tr><td colspan="3" class="small text-muted text-center" style="opacity: 0.7; padding: 1.5rem;">Unable to load exams.</td></tr>';
      }
    }

    // Recent Marks Entries
    const dbMarks = document.getElementById('db-teach-recent-marks');
    if (dbMarks) {
      dbMarks.innerHTML = '';
      try {
        const marks = await SSC_API.get('/teacher/marks');
        const marksList = Array.isArray(marks) ? marks : [];
        if (marksList.length > 0) {
          marksList.slice(0, 4).forEach(m => {
            const div = document.createElement('div');
            div.style.padding = '0.5rem';
            div.style.borderBottom = '1px solid rgba(56, 189, 248, 0.1)';
            div.innerHTML = `
              <div style="font-weight:600; font-size:0.82rem;">${esc(m.subject)} - ${esc(m.examName)}</div>
              <div style="font-size:0.72rem; opacity:0.8;">Score: ${m.marksObtained}/${m.maxMarks}</div>
            `;
            dbMarks.appendChild(div);
          });
        } else {
          dbMarks.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7; padding:1rem;"><div class="empty-state">No recent entries.</div></p>';
        }
      } catch {
        dbMarks.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7; padding:1rem;">Unable to load marks.</p>';
      }
    }

    // Recent Leaves
    const dbLeaves = document.getElementById('db-teach-recent-leaves');
    if (dbLeaves) {
      dbLeaves.innerHTML = '';
      if (leaveList.length > 0) {
        leaveList.slice(0, 4).forEach(l => {
          const div = document.createElement('div');
          div.style.padding = '0.5rem';
          div.style.borderBottom = '1px solid rgba(56, 189, 248, 0.1)';
          const from = l.fromDate ? new Date(l.fromDate).toLocaleDateString() : '';
          const statusStyle = l.status === 'approved' ? 'color:#22c55e;' : l.status === 'rejected' ? 'color:#ef4444;' : 'color:#f59e0b;';
          div.innerHTML = `
            <div style="font-weight:600; font-size:0.82rem; display:flex; justify-content:space-between;">
              <span>${esc(l.leaveType)}</span>
              <span style="${statusStyle}text-transform:capitalize;">${esc(l.status)}</span>
            </div>
            <div style="font-size:0.72rem; opacity:0.8;">From: ${from}</div>
          `;
          dbLeaves.appendChild(div);
        });
      } else {
        dbLeaves.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7; padding:1rem;"><div class="empty-state">No leave applications.</div></p>';
      }
    }

    // Recent Notices
    const dbNotices = document.getElementById('db-teach-recent-notices');
    if (dbNotices) {
      dbNotices.innerHTML = '';
      try {
        const notices = await SSC_API.get('/teacher/notices');
        const noticesList = Array.isArray(notices) ? notices : [];
        if (noticesList.length > 0) {
          noticesList.slice(0, 4).forEach(n => {
            const div = document.createElement('div');
            div.style.padding = '0.5rem';
            div.style.borderBottom = '1px solid rgba(56, 189, 248, 0.1)';
            div.innerHTML = `
              <div style="font-weight:600; font-size:0.82rem;">${esc(n.title)}</div>
              <p class="small" style="margin:2px 0 0 0; opacity:0.8; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(n.body || '')}</p>
            `;
            dbNotices.appendChild(div);
          });
        } else {
          dbNotices.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7; padding:1rem;"><div class="empty-state">No recent notices.</div></p>';
        }
      } catch {
        dbNotices.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7; padding:1rem;">Unable to load notices.</p>';
      }
    }

    // Load performance analytics widget
    await loadDashboardWidgets();
  }

  async function loadStudents() {
    const tb = document.querySelector('#tbl-stu tbody');
    if (tb) showTableShimmer('#tbl-stu tbody', 4);
    try {
      const res = await SSC_API.get('/teacher/students');
      studentsCache = Array.isArray(res) ? res : [];
    } catch (e) {
      studentsCache = [];
      console.error('Error loading students:', e);
    }
    if (tb) {
      tb.innerHTML = '';
      if (studentsCache.length === 0) {
        tb.innerHTML = '<tr><td colspan="4" class="small text-muted text-center" style="opacity: 0.7; padding: 2rem;"><div class="empty-state">No students assigned to your classes.</div></td></tr>';
      } else {
        studentsCache.forEach((s) => {
          const tr = document.createElement('tr');
          const sid = s._id || s.id || '';
          const roll = s.studentProfile?.rollNumber || '';
          const cls = s.studentProfile?.className || '';
          tr.innerHTML = `
            <td data-label="Name" style="font-weight:600; cursor:pointer;" class="student-name-click" data-sid="${sid}">${esc(s.name)}</td>
            <td data-label="Roll">${esc(roll)}</td>
            <td data-label="Class">${esc(cls)}</td>
            <td data-label="Email">${esc(s.email)}</td>
          `;
          tb.appendChild(tr);
        });

        // Bind clicks on student names to slide open detailed drawer
        tb.querySelectorAll('.student-name-click').forEach(el => {
          el.addEventListener('click', () => {
            openStudentDrawer(el.dataset.sid);
          });
        });
        
        makeTableSortableAndFilterable('tbl-stu');
      }
    }
  }

  async function loadMarksPanel() {
    await loadStudents();
    try {
      const exams = await SSC_API.get('/teacher/exams');
      teacherExamsCache = Array.isArray(exams) ? exams : [];
    } catch (e) {
      teacherExamsCache = [];
      console.error('Error loading teacher exams:', e);
    }
    
    const dl = document.getElementById('exams-datalist');
    if (dl) {
      dl.innerHTML = '';
      teacherExamsCache.forEach(ex => {
        const optDl = document.createElement('option');
        optDl.value = ex.title;
        dl.appendChild(optDl);
      });
    }
    
    const resSelect = document.getElementById('res-exam-select');
    if (resSelect) {
      resSelect.innerHTML = '<option value="">-- Choose Exam --</option>';
      teacherExamsCache.forEach(ex => {
        const optSel = document.createElement('option');
        optSel.value = ex.id || ex._id;
        optSel.textContent = `${ex.title} (${ex.subject} - ${ex.className})`;
        resSelect.appendChild(optSel);
      });
    }

    const resBtn = document.getElementById('res-generate-btn');
    if (resBtn && !resBtn.dataset.bound) {
      resBtn.dataset.bound = '1';
      resBtn.addEventListener('click', generateResultSheet);
    }

    await loadMarks();
  }

  async function loadMarks() {
    let rows = [];
    const tb = document.querySelector('#tbl-marks tbody');
    if (tb) showTableShimmer('#tbl-marks tbody', 4);
    try {
      const res = await SSC_API.get('/teacher/marks');
      rows = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading marks:', e);
    }
    if (tb) {
      tb.innerHTML = '';
      if (rows.length === 0) {
        tb.innerHTML = '<tr><td colspan="4" class="small text-muted text-center" style="opacity: 0.7; padding: 2rem;"><div class="empty-state">No recent marks entries.</div></td></tr>';
      } else {
        const byId = Object.fromEntries(studentsCache.map((s) => [String(s._id || s.id), s.name]));
        rows.slice(0, 40).forEach((m) => {
          const tr = document.createElement('tr');
          const sName = byId[String(m.studentId)] || m.studentId || '';
          tr.innerHTML = `<td data-label="Student">${esc(sName)}</td><td data-label="Subject">${esc(m.subject)}</td><td data-label="Exam">${esc(
            m.examName
          )}</td><td data-label="Score">${m.marksObtained}/${m.maxMarks}</td>`;
          tb.appendChild(tr);
        });
        makeTableSortableAndFilterable('tbl-marks');
      }
    }
  }

  async function loadAttendancePanel() {
    // Fetch assigned subjects to populate select dropdown automatically
    try {
      const res = await SSC_API.get('/teacher/subjects');
      const assignments = Array.isArray(res) ? res : [];
      const attSubSelect = document.getElementById('att-subject');
      if (attSubSelect) {
        const currentVal = attSubSelect.value;
        attSubSelect.innerHTML = assignments.map(a => `<option value="${esc(a.subject)}">${esc(a.subject)} (${esc(a.className)})</option>`).join('');
        // Restore value if existed and was valid
        if (currentVal && assignments.some(a => a.subject === currentVal)) {
          attSubSelect.value = currentVal;
        } else if (assignments.length > 0) {
          attSubSelect.value = assignments[0].subject;
        }
      }
    } catch (err) {
      console.error('Failed to populate subjects select dropdown', err);
    }

    await loadStudents();
    const box = document.getElementById('att-rows');
    if (box) {
      box.innerHTML = '';
      if (studentsCache.length === 0) {
        box.innerHTML = '<p class="small text-muted text-center" style="opacity: 0.7; padding: 1.5rem;"><div class="empty-state">No students assigned.</div></p>';
      } else {
        box.innerHTML = '<div style="text-align: center; padding: 1rem;"><div class="shimmer-line"></div></div>';
        
        // Fetch historical logs to compute student-wise percentages
        const allAtt = await SSC_API.get('/teacher/attendance').catch(() => []);
        const subject = document.getElementById('att-subject')?.value.trim() || '';
        const subjectAtt = allAtt.filter(a => a.subject === subject);
        
        // Get threshold
        const settings = await SSC_API.get('/public/settings').catch(() => ({}));
        const threshold = settings && settings.attendanceThreshold !== undefined ? Number(settings.attendanceThreshold) : 75;
        
        // Count for each student
        const studentPct = {};
        studentsCache.forEach(s => {
          const sid = s._id || s.id;
          const studentLogs = subjectAtt.filter(a => String(a.studentId) === String(sid));
          const total = studentLogs.length;
          const present = studentLogs.filter(a => a.status === 'present').length;
          studentPct[sid] = total ? Math.round((present / total) * 100) : 100; // default to 100%
        });

        box.innerHTML = '';
        studentsCache.forEach((s) => {
          const sid = s._id || s.id || '';
          const roll = s.studentProfile?.rollNumber || '';
          const pct = studentPct[sid];
          const isLow = pct < threshold;

          const row = document.createElement('label');
          row.className = 'small';
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '0.5rem';
          row.style.marginBottom = '0.35rem';
          row.style.cursor = 'pointer';

          let warnDot = '';
          if (isLow && subject) {
            warnDot = `<span style="width:7px; height:7px; border-radius:50%; background:#ef4444; display:inline-block; margin-left:0.25rem;" title="Low Attendance: ${pct}%"></span>`;
          }

          row.innerHTML = `<input type="checkbox" data-sid="${sid}" checked/> <span class="student-name-click" data-sid="${sid}">${esc(s.name)} — ${esc(roll)}</span>${warnDot}`;
          box.appendChild(row);
        });

        // Bind clicks to detailed slide-in drawer
        box.querySelectorAll('.student-name-click').forEach(el => {
          el.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent checkbox toggle
            openStudentDrawer(el.dataset.sid);
          });
        });
      }
    }
  }

  async function loadMaterials() {
    let list = [];
    const ul = document.getElementById('mat-list');
    if (ul) ul.innerHTML = '<li class="small py-2"><div class="shimmer-line"></div></li>';
    try {
      const res = await SSC_API.get('/teacher/materials');
      list = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading materials:', e);
    }
    if (ul) {
      ul.innerHTML = '';
      if (list.length === 0) {
        ul.innerHTML = '<li class="small text-muted text-center" style="opacity: 0.7; padding: 1.5rem;"><div class="empty-state">No uploads found.</div></li>';
      } else {
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
              <strong>${esc(m.title)}</strong> — ${esc(m.subject)} (${esc(m.className)})
            </div>
            ${m.fileUrl ? `<a class="btn small secondary" href="${m.fileUrl}" target="_blank" rel="noopener" style="color:var(--text);">Open</a>` : ''}
          `;
          ul.appendChild(li);
        });
      }
    }
  }

  async function loadNotices() {
    let items = [];
    const box = document.getElementById('teach-notices');
    if (box) box.innerHTML = '<div style="text-align: center; padding: 1rem;"><div class="shimmer-line"></div></div>';
    try {
      const res = await SSC_API.get('/teacher/notices');
      items = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading notices:', e);
    }
    if (box) {
      if (items.length === 0) {
        box.innerHTML = '<p class="small text-muted text-center" style="opacity: 0.7; padding: 1.5rem;"><div class="empty-state">No notices available.</div></p>';
      } else {
        box.innerHTML = items
          .map(
            (n) =>
              `<div class="card mt-2"><strong>${esc(n.title)}</strong><p class="small mt-2">${esc(n.body || '')}</p>${
                n.pdfUrl ? `<a class="btn small secondary" href="${n.pdfUrl}" target="_blank" style="color:var(--text);">PDF</a>` : ''
              }</div>`
          )
          .join('');
      }
    }
  }

  async function loadEditProfile() {
    const { user } = await SSC_API.get('/auth/me');
    const nameInput = document.getElementById('teacher-profile-name');
    const phoneInput = document.getElementById('teacher-profile-phone');
    const qualInput = document.getElementById('teacher-profile-qual');
    const bioInput = document.getElementById('teacher-profile-bio');
    
    if (nameInput) nameInput.value = user.name || '';
    if (phoneInput) phoneInput.value = user.phone || '';
    if (qualInput) qualInput.value = user.teacherProfile?.qualifications || '';
    if (bioInput) bioInput.value = user.bio || '';
    
    const img = document.getElementById('teacher-avatar-img');
    const placeholder = document.getElementById('teacher-avatar-placeholder');
    if (img && placeholder) {
      if (user.avatarUrl) {
        img.src = user.avatarUrl;
        img.style.display = 'block';
        placeholder.style.display = 'none';
      } else {
        img.style.display = 'none';
        placeholder.style.display = 'grid';
        placeholder.textContent = (user.name || 'T').charAt(0).toUpperCase();
      }
    }
    const uploadInput = document.getElementById('teacher-avatar-upload');
    if (uploadInput) uploadInput.value = '';

    const tp = user.teacherProfile || {};
    
    // Wire Edit Button in Overview
    const btnTriggerEdit = document.getElementById('btn-trigger-teacher-edit');
    if (btnTriggerEdit && !btnTriggerEdit.dataset.wired) {
      btnTriggerEdit.dataset.wired = 'true';
      btnTriggerEdit.addEventListener('click', () => {
        const editTab = document.querySelector('[data-sub-tab="edit-info"]');
        if (editTab) editTab.click();
      });
    }

    // Populate Overview fields
    if (document.getElementById('view-name')) document.getElementById('view-name').textContent = user.name || '—';
    if (document.getElementById('view-erp-id')) document.getElementById('view-erp-id').textContent = tp.employeeId || tp.teacherId || user.id || '—';
    if (document.getElementById('view-dept')) document.getElementById('view-dept').textContent = tp.department || '—';
    if (document.getElementById('view-desg')) document.getElementById('view-desg').textContent = tp.designation || 'Faculty Member';
    if (document.getElementById('view-qual')) document.getElementById('view-qual').textContent = tp.qualifications || '—';
    if (document.getElementById('view-phone')) document.getElementById('view-phone').textContent = tp.mobile || user.phone || '—';
    if (document.getElementById('view-email')) document.getElementById('view-email').textContent = tp.collegeEmail || user.email || '—';
    if (document.getElementById('view-bio')) {
      document.getElementById('view-bio').textContent = user.bio || 'No bio written yet.';
      document.getElementById('view-bio').style.fontStyle = user.bio ? 'normal' : 'italic';
    }

    // Populate Header metadata
    if (document.getElementById('profile-display-name')) document.getElementById('profile-display-name').textContent = user.name || 'Faculty Name';
    if (document.getElementById('profile-hdr-erp')) document.getElementById('profile-hdr-erp').textContent = 'Emp ID: ' + (tp.employeeId || tp.teacherId || '—');
    if (document.getElementById('profile-hdr-dept')) document.getElementById('profile-hdr-dept').textContent = 'Dept: ' + (tp.department || '—');
    if (document.getElementById('profile-hdr-desg')) document.getElementById('profile-hdr-desg').textContent = 'Designation: ' + (tp.designation || 'Faculty');
    if (document.getElementById('profile-hdr-status')) document.getElementById('profile-hdr-status').textContent = user.status || 'Active';

    // Fetch lists in parallel
    let assignments = [];
    let leavesList = [];
    let materialsList = [];
    let attendanceLogs = [];
    
    try {
      const [subjRes, leavesRes, matRes, attRes] = await Promise.all([
        SSC_API.get('/teacher/subjects').catch(() => []),
        SSC_API.get('/teacher/leave').catch(() => []),
        SSC_API.get('/teacher/materials').catch(() => []),
        SSC_API.get('/teacher/attendance').catch(() => [])
      ]);
      assignments = Array.isArray(subjRes) ? subjRes : [];
      leavesList = Array.isArray(leavesRes) ? leavesRes : [];
      materialsList = Array.isArray(matRes) ? matRes : [];
      attendanceLogs = Array.isArray(attRes) ? attRes : [];
    } catch (err) {
      console.error('Failed to load teacher history details', err);
    }

    // Populate Summary Cards
    const uniqueClasses = new Set(assignments.map(a => a.className));
    if (document.getElementById('prof-sum-subjects')) document.getElementById('prof-sum-subjects').textContent = assignments.length;
    if (document.getElementById('prof-sum-classes')) document.getElementById('prof-sum-classes').textContent = uniqueClasses.size;
    if (document.getElementById('prof-sum-attendance-sessions')) document.getElementById('prof-sum-attendance-sessions').textContent = attendanceLogs.length;
    if (document.getElementById('prof-sum-materials')) document.getElementById('prof-sum-materials').textContent = materialsList.length;
    const lastLoginStr = user.lastLogin ? new Date(user.lastLogin).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—';
    if (document.getElementById('prof-sum-login')) document.getElementById('prof-sum-login').textContent = lastLoginStr;

    // Populate Subjects tab table
    const tblProfTeachSubjects = document.querySelector('#tbl-prof-teach-subjects tbody');
    if (tblProfTeachSubjects) {
      tblProfTeachSubjects.innerHTML = '';
      if (!assignments.length) {
        tblProfTeachSubjects.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No courses assigned.</td></tr>';
      } else {
        assignments.forEach(a => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td><strong>${esc(a.subject)}</strong></td><td>${esc(a.className)}</td>`;
          tblProfTeachSubjects.appendChild(tr);
        });
      }
    }

    // Populate Attendance logs tab table
    const tblProfTeachAttendance = document.querySelector('#tbl-prof-teach-attendance tbody');
    if (tblProfTeachAttendance) {
      tblProfTeachAttendance.innerHTML = '';
      if (!attendanceLogs.length) {
        tblProfTeachAttendance.innerHTML = '<tr><td colspan="4" class="text-center text-muted">No lecture logs found.</td></tr>';
      } else {
        attendanceLogs.forEach(a => {
          const dtStr = new Date(a.date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
          const tr = document.createElement('tr');
          const studentCount = Array.isArray(a.entries) ? a.entries.length : 0;
          tr.innerHTML = `<td>${dtStr}</td><td><strong>${esc(a.subject)}</strong></td><td>${studentCount} Students</td><td><span class="badge success">Saved</span></td>`;
          tblProfTeachAttendance.appendChild(tr);
        });
      }
    }

    // Populate Materials tab table
    const tblProfTeachMaterials = document.querySelector('#tbl-prof-teach-materials tbody');
    if (tblProfTeachMaterials) {
      tblProfTeachMaterials.innerHTML = '';
      if (!materialsList.length) {
        tblProfTeachMaterials.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No materials uploaded yet.</td></tr>';
      } else {
        materialsList.forEach(m => {
          const dtStr = m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${esc(m.title)}</strong></td>
            <td>${esc(m.subject)}</td>
            <td>${esc(m.className)}</td>
            <td>${dtStr}</td>
            <td>${m.fileUrl ? `<a class="btn small secondary" href="${esc(m.fileUrl)}" target="_blank" style="color:var(--text); padding:0.2rem 0.5rem; font-size:0.75rem;">Download</a>` : '—'}</td>
          `;
          tblProfTeachMaterials.appendChild(tr);
        });
      }
    }

    // Populate Leave tab table
    const tblProfTeachLeaves = document.querySelector('#tbl-prof-teach-leaves tbody');
    if (tblProfTeachLeaves) {
      tblProfTeachLeaves.innerHTML = '';
      if (!leavesList.length) {
        tblProfTeachLeaves.innerHTML = '<tr><td colspan="5" class="text-center text-muted">No leave requests found.</td></tr>';
      } else {
        leavesList.forEach(l => {
          const startStr = new Date(l.startDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short' });
          const endStr = new Date(l.endDate).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
          const tr = document.createElement('tr');
          const stColor = l.status === 'approved' ? 'success' : (l.status === 'rejected' ? 'danger' : 'warning');
          tr.innerHTML = `
            <td>${startStr}</td>
            <td>${endStr}</td>
            <td>${esc(l.type || 'Casual')}</td>
            <td><span class="badge ${stColor}">${esc(l.status || 'pending')}</span></td>
            <td style="font-style:italic;">${esc(l.reviewReason || 'No review notes.')}</td>
          `;
          tblProfTeachLeaves.appendChild(tr);
        });
      }
    }

    // Populate Credentials
    const credsEmail = document.getElementById('creds-email');
    const credsErpId = document.getElementById('creds-erp-id');
    const copyBtn = document.getElementById('btn-copy-creds');
    if (credsEmail) credsEmail.value = user.email || '';
    if (credsErpId) credsErpId.value = tp.employeeId || tp.teacherId || user.id || '';
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

    // Populate Activity History
    const profileActivityLogs = document.getElementById('profile-activity-logs');
    if (profileActivityLogs) {
      profileActivityLogs.innerHTML = '';
      const logs = [];
      if (user.lastLogin) {
        logs.push({
          time: new Date(user.lastLogin).toLocaleString('en-IN'),
          text: 'User successfully logged in to the teacher portal.'
        });
      }
      if (user.updatedAt) {
        logs.push({
          time: new Date(user.updatedAt).toLocaleString('en-IN'),
          text: 'Faculty profile and assignment credentials synchronized.'
        });
      }
      if (!logs.length) {
        profileActivityLogs.innerHTML = '<div class="activity-log-item"><span class="activity-log-time">Now</span><span class="activity-log-text">No activity history recorded yet.</span></div>';
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
    const tabsContainer = document.getElementById('profile-inner-tabs');
    if (tabsContainer) {
      const tabs = tabsContainer.querySelectorAll('.id-tab');
      tabs.forEach(t => {
        if (t.getAttribute('data-sub-tab') === 'overview') {
          t.classList.add('active');
        } else {
          t.classList.remove('active');
        }
      });
      const contents = ['overview', 'subjects', 'attendance', 'materials', 'leaves', 'creds', 'activity', 'edit-info', 'security'];
      contents.forEach(c => {
        const contentEl = document.getElementById(`profile-sub-${c}`);
        if (contentEl) {
          contentEl.style.display = c === 'overview' ? 'block' : 'none';
        }
      });
    }
  }

  function setupProfileSubTabs() {
    const tabsContainer = document.getElementById('profile-inner-tabs');
    if (!tabsContainer) return;
    const tabs = tabsContainer.querySelectorAll('.id-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const target = tab.getAttribute('data-sub-tab');
        const contents = ['overview', 'subjects', 'attendance', 'materials', 'leaves', 'creds', 'activity', 'edit-info', 'security'];
        contents.forEach(c => {
          const contentEl = document.getElementById(`profile-sub-${c}`);
          if (contentEl) {
            contentEl.style.display = c === target ? 'block' : 'none';
          }
        });
      });
    });
  }

  function filterAttendanceStudents() {
    const query = document.getElementById('att-student-search')?.value.trim().toLowerCase() || '';
    document.querySelectorAll('#att-rows label').forEach((label) => {
      const text = label.textContent.toLowerCase();
      if (!query || text.includes(query)) {
        label.style.display = 'flex';
      } else {
        label.style.display = 'none';
      }
    });
  }

  async function checkExistingAttendance() {
    const subject = document.getElementById('att-subject')?.value.trim();
    const date = document.getElementById('att-date')?.value;
    const statusSpan = document.getElementById('att-loaded-status');
    const saveBtn = document.getElementById('att-save');
    
    if (!subject || !date) {
      if (statusSpan) statusSpan.style.display = 'none';
      if (saveBtn) saveBtn.textContent = 'Save attendance';
      existingAttendanceList = [];
      return;
    }
    
    try {
      const query = new URLSearchParams({ subject, from: date, to: date });
      const existing = await SSC_API.get('/teacher/attendance?' + query.toString());
      const existingList = Array.isArray(existing) ? existing : [];
      existingAttendanceList = existingList;
      
      if (existingList.length > 0) {
        const map = Object.fromEntries(existingList.map(e => [String(e.studentId), e.status]));
        document.querySelectorAll('#att-rows input[type="checkbox"]').forEach(cb => {
          const sid = cb.getAttribute('data-sid');
          cb.checked = map[sid] === 'present';
        });
        if (statusSpan) {
          statusSpan.textContent = 'Loaded existing logs';
          statusSpan.style.display = 'inline';
        }
        if (saveBtn) saveBtn.textContent = 'Update attendance';
      } else {
        document.querySelectorAll('#att-rows input[type="checkbox"]').forEach(cb => {
          cb.checked = true;
        });
        if (statusSpan) statusSpan.style.display = 'none';
        if (saveBtn) saveBtn.textContent = 'Save attendance';
      }
    } catch (err) {
      console.error(err);
      existingAttendanceList = [];
    }
  }

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const periodTimes = [
    { period: 1, label: 'Period 1 (09:00 - 10:00)' },
    { period: 2, label: 'Period 2 (10:00 - 11:00)' },
    { period: 3, label: 'Period 3 (11:00 - 12:00)' },
    { period: 4, label: 'Period 4 (12:00 - 01:00)' },
    { period: 5, label: 'Period 5 (01:30 - 02:30)' },
    { period: 6, label: 'Period 6 (02:30 - 03:30)' }
  ];

  async function loadTimetablePanel() {
    let slots = [];
    const tbody = document.getElementById('tbl-teacher-timetable');
    if (tbody) showTableShimmer('#tbl-teacher-timetable', 7, 6);
    try {
      const res = await SSC_API.get('/teacher/timetable');
      slots = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading timetable:', e);
    }
    if (tbody) {
      tbody.innerHTML = '';
      
      periodTimes.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td data-label="Period"><strong>${p.label}</strong></td>`;
        
        daysOfWeek.forEach(day => {
          const cellSlots = slots.filter(s => s.day === day && Number(s.period) === p.period);
          const td = document.createElement('td');
          td.setAttribute('data-label', day);
          if (cellSlots.length > 0) {
            td.innerHTML = cellSlots.map(s => `
              <div style="font-weight:600;color:var(--primary);">${esc(s.subject)}</div>
              <div class="small" style="font-size:0.8rem;opacity:0.85;">${esc(s.className)} • Room ${esc(s.room)}</div>
            `).join('<hr style="margin:4px 0;opacity:0.2;">');
          } else {
            td.innerHTML = '<span class="small" style="opacity:0.35;">-</span>';
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
    }
  }

  async function loadLeavePanel() {
    const form = document.getElementById('form-leave');
    if (form && !form.dataset.bound) {
      form.dataset.bound = '1';
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msgEl = document.getElementById('leave-msg');
        if (msgEl) {
          msgEl.textContent = '';
          msgEl.className = 'small mt-3';
        }
        
        const fromDate = document.getElementById('leave-from').value;
        const toDate = document.getElementById('leave-to').value;
        const reason = document.getElementById('leave-reason').value.trim();
        const leaveType = document.getElementById('leave-type').value;
        
        try {
          await SSC_API.post('/teacher/leave', { fromDate, toDate, reason, leaveType });
          showToast('Leave request submitted successfully!', 'success');
          form.reset();
          loadTeacherLeaves();
        } catch (err) {
          showToast(err.data && err.data.error ? err.data.error : err.message, 'error');
        }
      });
    }
    await loadTeacherLeaves();
  }

  async function loadTeacherLeaves() {
    let leaves = [];
    const tbody = document.querySelector('#tbl-teacher-leaves tbody');
    if (tbody) showTableShimmer('#tbl-teacher-leaves tbody', 5);
    try {
      const res = await SSC_API.get('/teacher/leave');
      leaves = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading leaves:', e);
    }
    if (tbody) {
      tbody.innerHTML = '';
      
      if (!leaves.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="center small text-muted text-center" style="opacity: 0.7; padding: 1.5rem;"><div class="empty-state">No leave requests yet</div></td></tr>';
        return;
      }

      leaves.forEach(lv => {
        const tr = document.createElement('tr');
        const start = lv.fromDate ? new Date(lv.fromDate).toLocaleDateString() : '';
        const end = lv.toDate ? new Date(lv.toDate).toLocaleDateString() : '';
        
        let statusStr = lv.status || 'pending';
        if (lv.status === 'pending') statusStr = '<span class="highlight">Pending</span>';
        else if (lv.status === 'approved') statusStr = '<span style="color:var(--accent);">Approved</span>';
        else if (lv.status === 'rejected') statusStr = '<span style="color:#ef4444;">Rejected</span>';

        tr.innerHTML = `
          <td data-label="Leave Type"><span style="text-transform: capitalize;">${esc(lv.leaveType)}</span></td>
          <td data-label="Duration">${start} to ${end}</td>
          <td data-label="Reason">${esc(lv.reason)}</td>
          <td data-label="Status">${statusStr}</td>
          <td data-label="Admin Note">${esc(lv.adminNote || 'None')}</td>
        `;
        tbody.appendChild(tr);
      });
      makeTableSortableAndFilterable('tbl-teacher-leaves');
    }
  }

  async function generateResultSheet() {
    const examId = document.getElementById('res-exam-select').value;
    if (!examId) return showToast('Please select a scheduled exam.', 'error');
    
    try {
      const { exam, results } = await SSC_API.get(`/teacher/exams/${examId}/result-sheet`);
      const container = document.getElementById('res-sheet-container');
      const title = document.getElementById('res-sheet-title');
      const tbody = document.querySelector('#tbl-res-sheet tbody');
      
      if (title) title.innerHTML = `<strong>Result Sheet:</strong> ${esc(exam.title)} — ${esc(exam.subject)} (${esc(exam.className)})`;
      if (tbody) {
        tbody.innerHTML = '';
        
        const resultsList = Array.isArray(results) ? results : [];
        if (!resultsList.length) {
          tbody.innerHTML = '<tr><td colspan="7" class="center small text-muted text-center" style="opacity: 0.7; padding: 1.5rem;"><div class="empty-state">No students in this class</div></td></tr>';
        } else {
          resultsList.forEach(r => {
            const tr = document.createElement('tr');
            
            let statusColor = '';
            if (r.passFail === 'PASS') statusColor = 'color:var(--accent);font-weight:600;';
            else if (r.passFail === 'FAIL') statusColor = 'color:#ef4444;font-weight:600;';

            tr.innerHTML = `
              <td data-label="Roll No">${esc(r.rollNumber || 'N/A')}</td>
              <td data-label="Student Name"><strong>${esc(r.name)}</strong></td>
              <td data-label="Marks">${r.marksObtained !== null ? `${r.marksObtained} / ${r.maxMarks}` : '<span class="small" style="opacity:0.5;">Not entered</span>'}</td>
              <td data-label="Percentage">${r.percentage !== null ? `${r.percentage}%` : '-'}</td>
              <td data-label="Grade">${r.grade !== null ? `<strong>${r.grade}</strong>` : '-'}</td>
              <td data-label="Pass / Fail"><span style="${statusColor}">${r.passFail || '-'}</span></td>
              <td data-label="Class Rank">${r.rank !== null ? `<strong>${r.rank}</strong>` : '-'}</td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
      if (container) container.style.display = 'block';
    } catch (err) {
      showToast(err.message || 'Failed to generate result sheet.', 'error');
    }
  }

  // Visual Setup functions
  function setupSearch() {
    const searchInput = document.getElementById('global-search');
    const resultsDiv = document.getElementById('search-results');
    const searchWrap = document.getElementById('global-search-wrap');
    
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
      
      const filteredStudents = studentsCache.filter(s => s.name.toLowerCase().includes(q) || (s.studentProfile?.rollNumber || '').toLowerCase().includes(q));
      
      resultsDiv.innerHTML = '';
      resultsDiv.classList.add('visible');
      
      if (filteredStudents.length === 0) {
        resultsDiv.innerHTML = '<div class="search-results-empty">No matches found</div>';
        return;
      }
      
      const group = document.createElement('div');
      group.className = 'search-result-group';
      group.innerHTML = '<div class="search-result-group-label">Students</div>';
      
      filteredStudents.forEach(s => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span>${esc(s.name)} (${esc(s.studentProfile?.rollNumber || '—')}) - Class ${esc(s.studentProfile?.className || '—')}</span>
        `;
        item.addEventListener('click', () => {
          searchInput.value = '';
          resultsDiv.classList.remove('visible');
          openStudentDrawer(s._id || s.id);
        });
        group.appendChild(item);
      });
      resultsDiv.appendChild(group);
    });
    
    // Click outside to hide
    document.addEventListener('click', (e) => {
      if (searchWrap && !searchWrap.contains(e.target)) {
        resultsDiv.classList.remove('visible');
      }
    });
  }

  async function setupNotifications() {
    const notifBtn = document.getElementById('topbar-notif-btn');
    const dropdown = document.getElementById('notif-dropdown');
    const notifList = document.getElementById('notif-list');
    const badge = document.getElementById('notif-badge');
    const clearBtn = document.getElementById('notif-clear-btn');
    
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
    
    clearBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      readNotifications = activeNotifications.map(n => n.id);
      localStorage.setItem('ssc_read_notifs_teacher', JSON.stringify(readNotifications));
      renderNotifications();
    });
    
    // Load read array from localStorage
    try {
      const stored = localStorage.getItem('ssc_read_notifs_teacher');
      readNotifications = stored ? JSON.parse(stored) : [];
    } catch {
      readNotifications = [];
    }
    
    await fetchNotifications();
    
    async function fetchNotifications() {
      try {
        const [notices, leaves] = await Promise.all([
          SSC_API.get('/teacher/notices').catch(() => []),
          SSC_API.get('/teacher/leave').catch(() => [])
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
        
        // Leaves (only decisions)
        leaves.forEach(l => {
          if (l.status !== 'pending') {
            const isApproved = l.status === 'approved';
            activeNotifications.push({
              id: 'leave-' + (l._id || l.id),
              title: isApproved ? 'Leave Request Approved' : 'Leave Request Rejected',
              desc: `Your leave application from ${new Date(l.fromDate).toLocaleDateString()} was ${l.status}.`,
              time: l.updatedAt ? new Date(l.updatedAt) : new Date(),
              icon: isApproved ? 'green' : 'red',
              svg: isApproved 
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 8 8 12 12 16"/><line x1="16" y1="12" x2="8" y2="12"/></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>'
            });
          }
        });
        
        // Sort notifications by time descending
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
      localStorage.setItem('ssc_read_notifs_teacher', JSON.stringify(readNotifications));
      badge.style.display = 'none';
      setTimeout(renderNotifications, 1000);
    }
  }

  function checkPasswordForcedChange(user) {
    if (user.mustChangePassword === true) {
      const modal = document.getElementById('modal-must-change-pwd');
      if (modal) modal.style.display = 'flex';
      
      const form = document.getElementById('form-must-change-pwd');
      if (form) {
        const curInput = document.getElementById('must-current-pwd');
        const newInput = document.getElementById('must-new-pwd');
        const confirmInput = document.getElementById('must-confirm-pwd');
        
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
    const el = document.getElementById(id);
    if (el) {
      el.classList.toggle('valid', isValid);
    }
  }

  function setupChangePasswordForm() {
    const form = document.getElementById('form-change-password');
    if (form) {
      const curInput = document.getElementById('profile-current-pwd');
      const newInput = document.getElementById('profile-new-pwd');
      const confirmInput = document.getElementById('profile-confirm-pwd');
      
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

  async function setupBulkMarks() {
    const subSel = document.getElementById('bulk-mark-subject');
    const examInput = document.getElementById('bulk-mark-exam');
    const maxInput = document.getElementById('bulk-mark-max');
    const container = document.getElementById('bulk-marks-roster-container');
    const tbody = document.querySelector('#tbl-bulk-marks-roster tbody');
    const saveBtn = document.getElementById('btn-save-bulk-marks');
    
    if (!subSel) return;

    let debounceTimeout = null;
    function debouncedLoadRoster() {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(loadRoster, 300);
    }
    
    // Load assigned subjects
    try {
      const res = await SSC_API.get('/teacher/subjects');
      const subjects = Array.isArray(res) ? res : [];
      subSel.innerHTML = '<option value="">-- Select Subject --</option>';
      subjects.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.subject;
        opt.textContent = `${s.subject} (${s.className})`;
        opt.dataset.class = s.className;
        subSel.appendChild(opt);
      });
    } catch (e) {
      console.error(e);
    }
    
    // Trigger loading roster on change
    async function loadRoster() {
      const subject = subSel.value;
      const examName = examInput.value.trim();
      const maxMarks = Number(maxInput.value) || 50;
      
      if (!subject || !examName) {
        container.style.display = 'none';
        return;
      }
      
      tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding: 2rem;"><div class="shimmer-line"></div></td></tr>';
      container.style.display = 'block';
      
      try {
        // Fetch students and current marks
        const [students, marks] = await Promise.all([
          SSC_API.get('/teacher/students'),
          SSC_API.get('/teacher/marks')
        ]);
        
        // Filter students by class of the selected subject
        const selectedOpt = subSel.options[subSel.selectedIndex];
        const className = selectedOpt.dataset.class;
        const filteredStudents = students.filter(s => s.studentProfile?.className === className);
        
        // Filter marks for this subject and exam
        const subjectMarks = marks.filter(m => m.subject === subject && m.examName === examName);
        const marksByStudent = Object.fromEntries(subjectMarks.map(m => [String(m.studentId), m.marksObtained]));
        
        tbody.innerHTML = '';
        if (filteredStudents.length === 0) {
          tbody.innerHTML = '<tr><td colspan="3" class="text-center small text-muted" style="padding: 1.5rem;">No students registered in class ' + esc(className) + '</td></tr>';
          updateCounter(0, 0);
          return;
        }
        
        filteredStudents.forEach(s => {
          const sid = s._id || s.id;
          const currentVal = marksByStudent[sid] !== undefined ? marksByStudent[sid] : '';
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td data-label="Roll No">${esc(s.studentProfile?.rollNumber || '—')}</td>
            <td data-label="Student Name" style="font-weight:600; cursor:pointer;" class="student-name-click text-primary" data-sid="${sid}">${esc(s.name)}</td>
            <td data-label="Marks Obtained">
              <input type="number" step="0.01" max="${maxMarks}" class="input bulk-mark-input" data-sid="${sid}" value="${currentVal}" style="max-width: 120px; padding: 0.35rem 0.5rem;"/>
            </td>
          `;
          tbody.appendChild(tr);
        });
        
        setupRosterInputs(filteredStudents.length);
        
        // Bind student name clicks to slide open detailed drawer
        tbody.querySelectorAll('.student-name-click').forEach(el => {
          el.addEventListener('click', () => {
            openStudentDrawer(el.dataset.sid);
          });
        });
        
      } catch (err) {
        tbody.innerHTML = '<tr><td colspan="3" class="text-center text-danger" style="padding: 1.5rem;">Failed to load roster data: ' + esc(err.message) + '</td></tr>';
      }
    }
    
    subSel.addEventListener('change', loadRoster);
    examInput.addEventListener('input', debouncedLoadRoster);
    maxInput.addEventListener('input', debouncedLoadRoster);
    
    // Bind Tab/Enter keydown focus shift
    function setupRosterInputs(totalCount) {
      const inputs = Array.from(tbody.querySelectorAll('.bulk-mark-input'));
      
      function updateCounterVal() {
        const entered = inputs.filter(inp => inp.value.trim() !== '').length;
        updateCounter(entered, totalCount);
      }
      
      inputs.forEach((inp, idx) => {
        inp.addEventListener('input', updateCounterVal);
        inp.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === 'Tab') {
            e.preventDefault();
            const nextIdx = idx + 1;
            if (nextIdx < inputs.length) {
              inputs[nextIdx].focus();
              inputs[nextIdx].select();
            } else {
              saveBtn.focus();
            }
          }
        });
      });
      
      updateCounterVal();
    }
    
    function updateCounter(entered, total) {
      const counter = document.getElementById('bulk-marks-counter');
      if (counter) counter.textContent = `${entered} of ${total} entered`;
    }
    
    // Save All batch submit with Undo capability!
    saveBtn.addEventListener('click', async () => {
      const subject = subSel.value;
      const examName = examInput.value.trim();
      const maxMarks = Number(maxInput.value) || 50;
      
      if (!subject || !examName) return;
      
      const inputs = Array.from(tbody.querySelectorAll('.bulk-mark-input'));
      const entries = inputs.map(inp => ({
        studentId: inp.getAttribute('data-sid'),
        marksObtained: inp.value.trim() !== '' ? Number(inp.value) : null
      })).filter(e => e.marksObtained !== null);

      const invalid = entries.filter(e => e.marksObtained > maxMarks || e.marksObtained < 0);
      if (invalid.length > 0) {
        showToast(`${invalid.length} entries exceed max marks (${maxMarks}) or are negative. Please fix before saving.`, 'error');
        return;
      }
      
      saveBtn.disabled = true;
      const origText = saveBtn.textContent;
      saveBtn.textContent = 'Saving...';
      
      // Cache previous state for Undo
      const previousState = inputs.map(inp => ({
        studentId: inp.getAttribute('data-sid'),
        value: inp.defaultValue || ''
      }));
      
      try {
        // Sequentially save marks
        for (const entry of entries) {
          await SSC_API.post('/teacher/marks', {
            studentId: entry.studentId,
            subject,
            examName,
            marksObtained: entry.marksObtained,
            maxMarks
          });
        }
        
        showToast('Successfully saved ' + entries.length + ' marks!', 'success', () => {
          // Revert to previous state
          tbody.innerHTML = '<tr><td colspan="3" class="text-center" style="padding: 1.5rem;">Undoing save...</td></tr>';
          Promise.all(previousState.map(async (prev) => {
            if (prev.value !== '') {
              await SSC_API.post('/teacher/marks', {
                studentId: prev.studentId,
                subject,
                examName,
                marksObtained: Number(prev.value),
                maxMarks
              });
            }
          })).then(() => {
            loadRoster();
            showToast('Marks save undone successfully.', 'info');
          }).catch(err => {
            showToast('Failed to undo save: ' + err.message, 'error');
          });
        });
        
        // Update input defaultValues to current values
        inputs.forEach(inp => inp.defaultValue = inp.value);
        
      } catch (err) {
        showToast('Error saving marks roster: ' + err.message, 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = origText;
      }
    });
  }

  function setupMobileMenu() {
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.dash-side');
    if (mobileBtn && sidebar) {
      if (window.innerWidth <= 900) mobileBtn.style.display = '';
      window.addEventListener('resize', () => { 
        mobileBtn.style.display = window.innerWidth <= 900 ? '' : 'none'; 
      });
      mobileBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
      
      document.querySelectorAll('.dash-nav button[data-panel]').forEach(btn => {
        btn.addEventListener('click', () => { 
          if (window.innerWidth <= 900) sidebar.classList.remove('open'); 
        });
      });
    }
    
    // Bottom viewport navigation tabs
    document.querySelectorAll('.mobile-bottom-nav button[data-nav-panel]').forEach(btn => {
      btn.addEventListener('click', () => {
        const pId = btn.getAttribute('data-nav-panel');
        
        document.querySelectorAll('.mobile-bottom-nav button').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        document.querySelectorAll('.dash-nav button').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-panel') === pId);
        });
        
        panel(pId);
        load(pId);
      });
    });
  }

  function setupTeacherIdCard(user) {
    const idBtn = document.getElementById('qa-id-card');
    const modal = document.getElementById('id-card-modal');
    const closeBtn = document.getElementById('btn-close-id');
    const tabFront = document.getElementById('id-tab-front');
    const tabBack = document.getElementById('id-tab-back');
    const frontCard = document.getElementById('id-card-front');
    const backCard = document.getElementById('id-card-back');
    
    if (!idBtn || !modal) return;
    
    idBtn.addEventListener('click', () => {
      try {
        const tp = user.teacherProfile || {};
        const designation = tp.designation || 'Faculty Member';
        const department = tp.department || 'General';
        const joinYear = user.createdAt ? new Date(user.createdAt).getFullYear() : new Date().getFullYear();
        const validityYear = Number(joinYear) + 3;
        const validity = `May ${validityYear}`;
        const verificationId = `SSC-FAC-${(user.id || 'unknown').slice(-6).toUpperCase()}`;
        
        const nameEl = document.getElementById('id-card-name');
        if (nameEl) nameEl.textContent = user.name;
        
        const desEl = document.getElementById('id-card-designation');
        if (desEl) desEl.textContent = designation;
        
        const erpEl = document.getElementById('id-card-erp-id');
        if (erpEl) erpEl.textContent = tp.employeeId || tp.teacherId || user.id || '—';
        
        const deptEl = document.getElementById('id-card-dept');
        if (deptEl) deptEl.textContent = department;
        
        const emailEl = document.getElementById('id-card-email');
        if (emailEl) emailEl.textContent = user.email;
        
        const phoneEl = document.getElementById('id-card-phone');
        if (phoneEl) phoneEl.textContent = user.phone || '—';
        
        const valEl = document.getElementById('id-card-validity');
        if (valEl) valEl.textContent = validity;
        
        const qualEl = document.getElementById('id-card-qual');
        if (qualEl) qualEl.textContent = tp.qualifications || '—';
        
        const bioEl = document.getElementById('id-card-bio');
        if (bioEl) bioEl.textContent = user.bio || '—';
        
        const verEl = document.getElementById('id-card-verify-id');
        if (verEl) verEl.textContent = verificationId;
        
        const emEl = document.getElementById('id-card-emergency');
        if (emEl) emEl.textContent = user.phone || '—';
        
        const photo = document.getElementById('id-card-photo');
        const placeholder = document.getElementById('id-card-photo-placeholder');
        if (photo && placeholder) {
          if (user.avatarUrl) {
            photo.src = user.avatarUrl;
            photo.style.display = 'block';
            placeholder.style.display = 'none';
          } else {
            photo.style.display = 'none';
            placeholder.style.display = 'grid';
          }
        }
        
        const qrCanvas = document.getElementById('id-card-qr');
        if (qrCanvas && window.QRious) {
          new QRious({
            element: qrCanvas,
            value: JSON.stringify({
              role: 'teacher',
              id: tp.employeeId || tp.teacherId || user.id,
              name: user.name,
              designation,
              department,
              verificationId
            }),
            size: 128,
            background: '#ffffff',
            foreground: '#0f172a',
            level: 'M'
          });
        }
      } catch (err) {
        console.error('Error rendering ID card content:', err);
      }
      
      showTab('front');
      modal.style.display = 'flex';
    });
    
    function showTab(tab) {
      const isFront = tab === 'front';
      frontCard.style.display = isFront ? 'block' : 'none';
      backCard.style.display = isFront ? 'none' : 'block';
      tabFront.classList.toggle('active', isFront);
      tabBack.classList.toggle('active', !isFront);
    }
    
    tabFront.addEventListener('click', () => showTab('front'));
    tabBack.addEventListener('click', () => showTab('back'));
    closeBtn.addEventListener('click', () => modal.style.display = 'none');
  }

  function setupStudentDrawer() {
    const drawerCloseBtn = document.getElementById('btn-close-drawer');
    const drawerOverlay = document.getElementById('drawer-overlay');
    if (drawerCloseBtn) drawerCloseBtn.addEventListener('click', closeStudentDrawer);
    if (drawerOverlay) drawerOverlay.addEventListener('click', closeStudentDrawer);
  }

  async function openStudentDrawer(sid) {
    const drawer = document.getElementById('student-detail-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const body = document.getElementById('drawer-student-body');
    const title = document.getElementById('drawer-student-name');
    
    if (!drawer || !overlay || !body) return;
    
    const student = studentsCache.find(s => String(s._id || s.id) === String(sid));
    if (!student) return;
    
    title.textContent = student.name;
    body.innerHTML = '<div class="text-center py-4"><div class="shimmer-line"></div></div>';
    
    drawer.classList.add('open');
    overlay.classList.add('open');
    
    try {
      // Fetch student stats
      const [allAttendance, allMarks] = await Promise.all([
        SSC_API.get('/teacher/attendance'),
        SSC_API.get('/teacher/marks')
      ]);
      
      const studentAtt = allAttendance.filter(a => String(a.studentId) === String(sid));
      const studentMarks = allMarks.filter(m => String(m.studentId) === String(sid));
      
      const totalClasses = studentAtt.length;
      const presentClasses = studentAtt.filter(a => a.status === 'present').length;
      const attPct = totalClasses ? Math.round((presentClasses / totalClasses) * 100) : 100;
      
      const sp = student.studentProfile || {};
      
      body.innerHTML = `
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="width: 70px; height: 70px; border-radius: 50%; background: var(--primary-muted); color: var(--primary); display: grid; place-items: center; font-size: 1.75rem; font-weight: 700; margin: 0 auto 0.75rem;">
            ${(student.name || 'S').charAt(0).toUpperCase()}
          </div>
          <h3 style="margin: 0; font-size: 1.15rem;">${esc(student.name)}</h3>
          <p class="small text-secondary" style="margin: 0.15rem 0 0;">ERP ID: ${esc(sp.studentId || sid)}</p>
        </div>
        
        <h4 style="margin: 0 0 0.5rem; font-size: 0.9rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em;">Student Info</h4>
        <dl style="display: grid; gap: 0.5rem; margin: 0 0 1.5rem; font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.25rem;"><dt style="color:var(--muted);">Roll Number</dt><dd style="margin:0; font-weight:600;">${esc(sp.rollNumber || '—')}</dd></div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.25rem;"><dt style="color:var(--muted);">Class Name</dt><dd style="margin:0; font-weight:600;">${esc(sp.className || '—')}</dd></div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.25rem;"><dt style="color:var(--muted);">Email</dt><dd style="margin:0; font-weight:600;">${esc(student.email)}</dd></div>
          <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.25rem;"><dt style="color:var(--muted);">Phone</dt><dd style="margin:0; font-weight:600;">${esc(student.phone || '—')}</dd></div>
        </dl>
        
        <h4 style="margin: 0 0 0.5rem; font-size: 0.9rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em;">Attendance Summary</h4>
        <div style="padding: 1rem; border-radius: 8px; background: rgba(0,0,0,0.15); border: 1px solid var(--card-border); margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
            <span class="small">Overall Attendance</span>
            <strong style="font-size: 1.2rem; color: ${attPct < 75 ? 'var(--danger)' : 'var(--accent)'};">${attPct}%</strong>
          </div>
          <div style="background: rgba(255,255,255,0.08); height: 6px; border-radius: 3px; overflow: hidden; margin-bottom: 0.75rem;">
            <div style="background: ${attPct < 75 ? 'var(--danger)' : 'var(--accent)'}; width: ${attPct}%; height: 100%;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.75rem; opacity: 0.8;">
            <span>Attended: ${presentClasses}</span>
            <span>Total: ${totalClasses}</span>
          </div>
        </div>
        
        <h4 style="margin: 0 0 0.5rem; font-size: 0.9rem; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em;">Grades Sheet</h4>
        <div class="table-wrap">
          <table class="table small">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Exam</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              ${studentMarks.length === 0 
                ? '<tr><td colspan="3" class="text-center small text-muted" style="padding: 1rem;">No marks records entered.</td></tr>' 
                : studentMarks.map(m => `
                    <tr>
                      <td>${esc(m.subject)}</td>
                      <td>${esc(m.examName)}</td>
                      <td><strong>${m.marksObtained} / ${m.maxMarks}</strong></td>
                    </tr>
                  `).join('')
              }
            </tbody>
          </table>
        </div>
      `;
      
    } catch (err) {
      body.innerHTML = '<div class="text-center text-danger py-4">Failed to load student details: ' + esc(err.message) + '</div>';
    }
  }

  function closeStudentDrawer() {
    const drawer = document.getElementById('student-detail-drawer');
    const overlay = document.getElementById('drawer-overlay');
    if (drawer) drawer.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
  }

  async function loadDashboardWidgets() {
    const container = document.getElementById('performance-average-widget');
    const card = document.getElementById('card-db-performance-avg');
    if (!container) return;
    
    try {
      const marks = await SSC_API.get('/teacher/marks').catch(() => []);
      if (marks.length === 0) {
        container.innerHTML = '<p class="small empty-state" style="padding: 1rem;"><div class="empty-state">No academic performance logs entered yet.</div></p>';
        if (card) card.style.display = 'block';
        return;
      }
      
      const subGroup = {};
      marks.forEach(m => {
        if (!subGroup[m.subject]) subGroup[m.subject] = { obtained: 0, max: 0 };
        subGroup[m.subject].obtained += m.marksObtained;
        subGroup[m.subject].max += m.maxMarks;
      });
      
      container.innerHTML = '';
      if (card) card.style.display = 'block';
      
      Object.entries(subGroup).forEach(([subject, data]) => {
        const pct = data.max ? Math.round((data.obtained / data.max) * 100) : 0;
        
        const barWrap = document.createElement('div');
        barWrap.className = 'att-trend-bar';
        barWrap.style.marginBottom = '0.75rem';
        
        let colorClass = 'var(--primary)';
        if (pct < 50) colorClass = 'var(--danger)';
        else if (pct < 75) colorClass = 'var(--warning)';
        else colorClass = 'var(--accent)';
        
        barWrap.innerHTML = `
          <div class="att-trend-labels">
            <span style="font-weight:600; color:var(--text);">${esc(subject)}</span>
            <span>Average: ${pct}%</span>
          </div>
          <div class="att-trend-track" style="margin-top: 0.25rem;">
            <div class="att-trend-fill" style="width: ${pct}%; background: ${colorClass}; height: 100%;"></div>
          </div>
        `;
        container.appendChild(barWrap);
      });
      
    } catch (err) {
      container.innerHTML = '<p class="small text-danger">Failed to load subject performance analytics</p>';
    }
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
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

  window.panel = panel;
  window.load = load;

  document.addEventListener('DOMContentLoaded', boot);
})();
