(function () {
  let studentsCache = [];
  let teacherExamsCache = [];

  function msg(t, err) {
    const el = document.getElementById('dash-msg');
    if (el) {
      el.textContent = t || '';
      el.className = 'small mt-3' + (err ? ' alert error' : t ? ' alert success' : '');
    }
  }

  function panel(id) {
    document.querySelectorAll('.dash-nav button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-panel') === id));
    document.querySelectorAll('.dash-panel').forEach((p) => p.classList.toggle('active', p.getAttribute('data-panel') === id));
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
      const avatarImg = user.avatarUrl ? `<img src="${esc(user.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:0.5rem;border:1px solid rgba(56,189,248,0.3);"/>` : '';
      const whoEl = document.getElementById('who');
      if (whoEl) whoEl.innerHTML = `${avatarImg}<span>${esc(user.name)}</span>`;
    } catch {
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

    const formMarks = document.getElementById('form-marks');
    if (formMarks) {
      formMarks.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await SSC_API.post('/teacher/marks', {
            studentId: document.getElementById('mark-student').value,
            subject: document.getElementById('mark-subject').value.trim(),
            examName: document.getElementById('mark-exam').value.trim(),
            marksObtained: Number(document.getElementById('mark-obt').value),
            maxMarks: Number(document.getElementById('mark-max').value),
          });
          msg('Marks saved');
          loadMarks();
        } catch (err) {
          msg(err.message || 'Could not save marks', true);
        }
      });
    }

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
          msg('Subject and Date are required', true);
          btn.disabled = false;
          btn.textContent = originalText;
          return;
        }
        
        const entries = [];
        document.querySelectorAll('#att-rows input[type="checkbox"]').forEach((cb) => {
          entries.push({
            studentId: cb.getAttribute('data-sid'),
            status: cb.checked ? 'present' : 'absent',
          });
        });
        try {
          await SSC_API.post('/teacher/attendance', { subject, date, entries });
          msg('Attendance saved');
          await checkExistingAttendance();
        } catch (err) {
          msg(err.message || 'Could not save attendance', true);
        } finally {
          btn.disabled = false;
          btn.textContent = originalText;
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
          msg('Material uploaded');
          loadMaterials();
        } catch (err) {
          msg(err.message || 'Could not upload material', true);
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
          msg('Profile updated successfully');
          const avatarImg = resUser.avatarUrl ? `<img src="${esc(resUser.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:0.5rem;border:1px solid rgba(56,189,248,0.3);"/>` : '';
          const whoEl = document.getElementById('who');
          if (whoEl) whoEl.innerHTML = `${avatarImg}<span>${esc(resUser.name)}</span>`;
          loadEditProfile();
        } catch (err) {
          msg(err.message || 'Update failed', true);
        }
      });
    }

    load('subjects');
  }
  window.load = load;

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
      msg(e.message || 'Error loading data', true);
    }
  }

  async function loadSubjects() {
    const userRes = await SSC_API.get('/auth/me');
    const u = userRes.user || userRes;
    const tp = u.teacherProfile || {};

    // 1. Populate top welcome
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

    // 2. Fetch Assigned Subjects
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
        tblSubjects.innerHTML = '<tr><td colspan="2" class="small text-muted text-center" style="opacity: 0.7;">No subjects assigned.</td></tr>';
      } else {
        assignments.forEach(a => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td><strong>${esc(a.subject)}</strong></td><td>${esc(a.className)}</td>`;
          tblSubjects.appendChild(tr);
        });
      }
    }

    // 3. Fetch Students Count
    let studentCount = 0;
    try {
      const students = await SSC_API.get('/teacher/students');
      if (Array.isArray(students)) {
        studentCount = students.length;
      }
    } catch { /* fallback */ }
    
    const statStudentsEl = document.getElementById('db-teach-stat-students');
    if (statStudentsEl) statStudentsEl.textContent = studentCount;
    
    const statStudentsDescEl = document.getElementById('db-teach-stat-students-desc');
    if (statStudentsDescEl) {
      statStudentsDescEl.textContent = studentCount ? `${studentCount} registered students` : 'No students found';
    }

    // 4. Fetch Timetable & Today's Classes
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

    // 5. Fetch Pending Leaves count
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
      statLeavesDescEl.textContent = pendingLeavesCount ? `${pendingLeavesCount} pending requests` : 'All request decisions in';
    }

    // 6. Fetch Scheduled Exams
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
            tr.innerHTML = `<td><strong>${esc(ex.title)}</strong></td><td>${esc(ex.subject)}</td><td>${dt}</td>`;
            tblExams.appendChild(tr);
          });
        } else {
          tblExams.innerHTML = '<tr><td colspan="3" class="small text-muted text-center" style="opacity: 0.7;">No scheduled exams.</td></tr>';
        }
      } catch {
        tblExams.innerHTML = '<tr><td colspan="3" class="small text-muted text-center" style="opacity: 0.7;">Unable to load exams.</td></tr>';
      }
    }

    // 7. Recent Marks Entries
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
          dbMarks.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7;">No recent entries.</p>';
        }
      } catch {
        dbMarks.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7;">Unable to load marks.</p>';
      }
    }

    // 8. Recent Leaves
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
        dbLeaves.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7;">No leave applications.</p>';
      }
    }

    // 9. Recent Notices
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
          dbNotices.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7;">No recent notices.</p>';
        }
      } catch {
        dbNotices.innerHTML = '<p class="small text-muted text-center" style="opacity:0.7;">Unable to load notices.</p>';
      }
    }
  }

  async function loadStudents() {
    try {
      const res = await SSC_API.get('/teacher/students');
      studentsCache = Array.isArray(res) ? res : [];
    } catch (e) {
      studentsCache = [];
      console.error('Error loading students:', e);
    }
    const tb = document.querySelector('#tbl-stu tbody');
    if (tb) {
      tb.innerHTML = '';
      if (studentsCache.length === 0) {
        tb.innerHTML = '<tr><td colspan="4" class="small text-muted text-center" style="opacity: 0.7;">No students assigned.</td></tr>';
      } else {
        studentsCache.forEach((s) => {
          const tr = document.createElement('tr');
          const sid = s._id || s.id || '';
          const roll = s.studentProfile?.rollNumber || '';
          const cls = s.studentProfile?.className || '';
          tr.innerHTML = `<td>${esc(s.name)}</td><td>${esc(roll)}</td><td>${esc(cls)}</td><td>${esc(s.email)}</td>`;
          tb.appendChild(tr);
        });
      }
    }
  }

  async function loadMarksPanel() {
    await loadStudents();
    const sel = document.getElementById('mark-student');
    if (sel) {
      sel.innerHTML = '';
      studentsCache.forEach((s) => {
        const o = document.createElement('option');
        o.value = s._id || s.id;
        o.textContent = s.name + ' (' + (s.studentProfile?.rollNumber || s._id || s.id) + ')';
        sel.appendChild(o);
      });
    }

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

    const examInput = document.getElementById('mark-exam');
    if (examInput && !examInput.dataset.bound) {
      examInput.dataset.bound = '1';
      examInput.addEventListener('change', () => {
        const match = teacherExamsCache.find(ex => ex.title === examInput.value);
        if (match) {
          const subInput = document.getElementById('mark-subject');
          const maxInput = document.getElementById('mark-max');
          if (subInput) subInput.value = match.subject || '';
          if (maxInput) maxInput.value = match.maxMarks || '';
        }
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
    try {
      const res = await SSC_API.get('/teacher/marks');
      rows = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading marks:', e);
    }
    const tb = document.querySelector('#tbl-marks tbody');
    if (tb) {
      tb.innerHTML = '';
      if (rows.length === 0) {
        tb.innerHTML = '<tr><td colspan="4" class="small text-muted text-center" style="opacity: 0.7;">No recent marks entries.</td></tr>';
      } else {
        const byId = Object.fromEntries(studentsCache.map((s) => [String(s._id || s.id), s.name]));
        rows.slice(0, 40).forEach((m) => {
          const tr = document.createElement('tr');
          const sName = byId[String(m.studentId)] || m.studentId || '';
          tr.innerHTML = `<td>${esc(sName)}</td><td>${esc(m.subject)}</td><td>${esc(
            m.examName
          )}</td><td>${m.marksObtained}/${m.maxMarks}</td>`;
          tb.appendChild(tr);
        });
      }
    }
  }

  async function loadAttendancePanel() {
    await loadStudents();
    const box = document.getElementById('att-rows');
    if (box) {
      box.innerHTML = '';
      if (studentsCache.length === 0) {
        box.innerHTML = '<p class="small text-muted text-center" style="opacity: 0.7;">No students assigned.</p>';
      } else {
        studentsCache.forEach((s) => {
          const row = document.createElement('label');
          row.className = 'small';
          row.style.display = 'flex';
          row.style.alignItems = 'center';
          row.style.gap = '0.5rem';
          row.style.marginBottom = '0.35rem';
          const sid = s._id || s.id || '';
          const roll = s.studentProfile?.rollNumber || '';
          row.innerHTML = `<input type="checkbox" data-sid="${sid}" checked/> <span>${esc(s.name)} — ${esc(roll)}</span>`;
          box.appendChild(row);
        });
      }
    }
  }

  async function loadMaterials() {
    let list = [];
    try {
      const res = await SSC_API.get('/teacher/materials');
      list = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading materials:', e);
    }
    const ul = document.getElementById('mat-list');
    if (ul) {
      ul.innerHTML = '';
      if (list.length === 0) {
        ul.innerHTML = '<li class="small text-muted text-center" style="opacity: 0.7;">No uploads found.</li>';
      } else {
        list.forEach((m) => {
          const li = document.createElement('li');
          li.className = 'mt-2';
          li.innerHTML = `<strong>${esc(m.title)}</strong> — ${esc(m.subject)} (${esc(m.className)})
            ${m.fileUrl ? `<a class="btn small secondary" href="${m.fileUrl}" target="_blank" rel="noopener">Open</a>` : ''}`;
          ul.appendChild(li);
        });
      }
    }
  }

  async function loadNotices() {
    let items = [];
    try {
      const res = await SSC_API.get('/teacher/notices');
      items = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading notices:', e);
    }
    const box = document.getElementById('teach-notices');
    if (box) {
      if (items.length === 0) {
        box.innerHTML = '<p class="small text-muted text-center" style="opacity: 0.7;">No notices available.</p>';
      } else {
        box.innerHTML = items
          .map(
            (n) =>
              `<div class="card mt-2"><strong>${esc(n.title)}</strong><p class="small mt-2">${esc(n.body || '')}</p>${
                n.pdfUrl ? `<a class="btn small secondary" href="${n.pdfUrl}" target="_blank">PDF</a>` : ''
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
      }
    }
    const uploadInput = document.getElementById('teacher-avatar-upload');
    if (uploadInput) uploadInput.value = '';
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
      return;
    }
    
    try {
      const query = new URLSearchParams({ subject, from: date, to: date });
      const existing = await SSC_API.get('/teacher/attendance?' + query.toString());
      const existingList = Array.isArray(existing) ? existing : [];
      
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
    try {
      const res = await SSC_API.get('/teacher/timetable');
      slots = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading timetable:', e);
    }
    const tbody = document.getElementById('tbl-teacher-timetable');
    if (tbody) {
      tbody.innerHTML = '';
      
      periodTimes.forEach(p => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td><strong>${p.label}</strong></td>`;
        
        daysOfWeek.forEach(day => {
          const cellSlots = slots.filter(s => s.day === day && Number(s.period) === p.period);
          const td = document.createElement('td');
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
          if (msgEl) {
            msgEl.textContent = 'Leave request submitted successfully!';
            msgEl.className = 'small mt-3 alert success';
          }
          form.reset();
          loadTeacherLeaves();
        } catch (err) {
          if (msgEl) {
            msgEl.textContent = err.data && err.data.error ? err.data.error : err.message;
            msgEl.className = 'small mt-3 alert error';
          }
        }
      });
    }
    await loadTeacherLeaves();
  }

  async function loadTeacherLeaves() {
    let leaves = [];
    try {
      const res = await SSC_API.get('/teacher/leave');
      leaves = Array.isArray(res) ? res : [];
    } catch (e) {
      console.error('Error loading leaves:', e);
    }
    const tbody = document.querySelector('#tbl-teacher-leaves tbody');
    if (tbody) {
      tbody.innerHTML = '';
      
      if (!leaves.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="center small text-muted text-center" style="opacity: 0.7;">No leave requests yet</td></tr>';
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
          <td><span style="text-transform: capitalize;">${esc(lv.leaveType)}</span></td>
          <td>${start} to ${end}</td>
          <td>${esc(lv.reason)}</td>
          <td>${statusStr}</td>
          <td>${esc(lv.adminNote || 'None')}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  async function generateResultSheet() {
    const examId = document.getElementById('res-exam-select').value;
    if (!examId) return alert('Please select a scheduled exam.');
    
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
          tbody.innerHTML = '<tr><td colspan="7" class="center small text-muted text-center" style="opacity: 0.7;">No students in this class</td></tr>';
        } else {
          resultsList.forEach(r => {
            const tr = document.createElement('tr');
            
            let statusColor = '';
            if (r.passFail === 'PASS') statusColor = 'color:var(--accent);font-weight:600;';
            else if (r.passFail === 'FAIL') statusColor = 'color:#ef4444;font-weight:600;';

            tr.innerHTML = `
              <td>${esc(r.rollNumber || 'N/A')}</td>
              <td><strong>${esc(r.name)}</strong></td>
              <td>${r.marksObtained !== null ? `${r.marksObtained} / ${r.maxMarks}` : '<span class="small" style="opacity:0.5;">Not entered</span>'}</td>
              <td>${r.percentage !== null ? `${r.percentage}%` : '-'}</td>
              <td>${r.grade !== null ? `<strong>${r.grade}</strong>` : '-'}</td>
              <td><span style="${statusColor}">${r.passFail || '-'}</span></td>
              <td>${r.rank !== null ? `<strong>${r.rank}</strong>` : '-'}</td>
            `;
            tbody.appendChild(tr);
          });
        }
      }
      if (container) container.style.display = 'block';
    } catch (err) {
      alert(err.message || 'Failed to generate result sheet.');
    }
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // Expose locally defined functions globally so that inline onclick attributes will work.
  window.panel = panel;
  window.load = load;

  document.addEventListener('DOMContentLoaded', boot);
})();
