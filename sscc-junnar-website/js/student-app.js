(function () {
  function msg(t, err) {
    const el = document.getElementById('dash-msg');
    el.textContent = t || '';
    el.className = 'small mt-3' + (err ? ' alert error' : t ? ' alert success' : '');
  }

  function panel(id) {
    document.querySelectorAll('.dash-nav button').forEach((b) => b.classList.toggle('active', b.getAttribute('data-panel') === id));
    document.querySelectorAll('.dash-panel').forEach((p) => p.classList.toggle('active', p.getAttribute('data-panel') === id));
  }

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
      const avatarImg = user.avatarUrl ? `<img src="${esc(user.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:0.5rem;border:1px solid rgba(56,189,248,0.3);"/>` : '';
      document.getElementById('who').innerHTML = `${avatarImg}<span>${esc(user.name)}</span>`;
    } catch {
      SSC_API.setToken(null);
      location.href = '../login.html';
      return;
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
      SSC_API.setToken(null);
      location.href = '../login.html';
    });

    document.querySelectorAll('.dash-nav button').forEach((btn) => {
      btn.addEventListener('click', () => {
        panel(btn.getAttribute('data-panel'));
        load(btn.getAttribute('data-panel'));
      });
    });

    document.getElementById('form-fb').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await SSC_API.post('/student/feedback', {
          message: document.getElementById('fb-msg').value.trim(),
          rating: Number(document.getElementById('fb-rate').value),
        });
        msg('Feedback submitted');
        e.target.reset();
      } catch (err) {
        msg(err.data?.error || err.message || 'Could not submit', true);
      }
    });

    document.getElementById('form-edit-profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData();
      fd.append('name', document.getElementById('student-profile-name').value.trim());
      fd.append('phone', document.getElementById('student-profile-phone').value.trim());
      fd.append('bio', document.getElementById('student-profile-bio').value.trim());
      const avatarFile = document.getElementById('student-avatar-upload').files[0];
      if (avatarFile) fd.append('avatar', avatarFile);
      
      try {
        const resUser = await SSC_API.upload('/student/profile', fd, 'PATCH');
        msg('Profile updated successfully');
        const avatarImg = resUser.avatarUrl ? `<img src="${esc(resUser.avatarUrl)}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;vertical-align:middle;margin-right:0.5rem;border:1px solid rgba(56,189,248,0.3);"/>` : '';
        document.getElementById('who').innerHTML = `${avatarImg}<span>${esc(resUser.name)}</span>`;
        loadEditProfile();
      } catch (err) {
        msg(err.message || 'Update failed', true);
      }
    });

    load('profile');
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
      if (id === 'admission') await loadAdmission();
      if (id === 'placement') await loadPlacementPanel();
      if (id === 'edit-profile') await loadEditProfile();
    } catch (e) {
      msg(e.data?.error || e.message || 'Error', true);
    }
  }

  async function loadProfile() {
    const u = await SSC_API.get('/student/profile');
    const sp = u.studentProfile || {};
    document.getElementById('profile-card').innerHTML = `
      <h3>${esc(u.name)}</h3>
      <p class="small">Email: ${esc(u.email)} • Phone: ${esc(u.phone || '')}</p>
      <p class="small">Roll: ${esc(sp.rollNumber || '')} • Class: ${esc(sp.className || '')}</p>
      <p class="small">Course: ${esc(sp.courseName || '')} • Year: ${esc(sp.year || '')}</p>
    `;
  }

  async function loadMarks() {
    const rows = await SSC_API.get('/student/marks');
    const tb = document.querySelector('#tbl-marks tbody');
    tb.innerHTML = '';
    const list = Array.isArray(rows) ? rows : [];
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="3" class="small">No marks entered yet.</td></tr>';
      return;
    }
    list.forEach((m) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(m.subject)}</td><td>${esc(m.examName)}</td><td>${m.marksObtained}/${m.maxMarks}</td>`;
      tb.appendChild(tr);
    });
  }

  async function loadAttendance() {
    const rows = await SSC_API.get('/student/attendance');
    const list = Array.isArray(rows) ? rows : [];
    
    // Stats calculation
    const total = list.length;
    const present = list.filter(a => a.status === 'present').length;
    const missed = total - present;
    const pct = total ? Math.round((present / total) * 100) : 100;
    
    document.getElementById('stu-att-total').textContent = total;
    document.getElementById('stu-att-present').textContent = present;
    const missedEl = document.getElementById('stu-att-missed');
    if (missedEl) missedEl.textContent = missed;
    document.getElementById('stu-att-percent').textContent = pct + '%';
    
    const warn = document.getElementById('att-warn-banner');
    if (total > 0 && pct < 75) {
      warn.style.display = 'block';
    } else {
      warn.style.display = 'none';
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

    const tblBreakdown = document.querySelector('#tbl-subject-breakdown tbody');
    tblBreakdown.innerHTML = '';
    const subjects = Object.keys(subBreakdown).sort();
    if (!subjects.length) {
      tblBreakdown.innerHTML = '<tr><td colspan="4" class="small">No attendance data to summarize.</td></tr>';
    } else {
      subjects.forEach(sub => {
        const stats = subBreakdown[sub];
        const subPct = stats.total ? Math.round((stats.present / stats.total) * 100) : 100;
        const color = subPct < 75 ? 'color: #ef4444; font-weight: bold;' : '';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${esc(sub)}</td>
          <td>${stats.present}</td>
          <td>${stats.total}</td>
          <td style="${color}">${subPct}%</td>
        `;
        tblBreakdown.appendChild(tr);
      });
    }

    // Render detailed logs
    const tb = document.querySelector('#tbl-att tbody');
    tb.innerHTML = '';
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="3" class="small">No attendance records yet.</td></tr>';
      return;
    }
    list.forEach((a) => {
      const tr = document.createElement('tr');
      const d = a.date ? new Date(a.date).toLocaleDateString() : '';
      tr.innerHTML = `<td>${d}</td><td>${esc(a.subject)}</td><td>${esc(a.status)}</td>`;
      tb.appendChild(tr);
    });
  }

  async function loadMaterials() {
    const listRaw = await SSC_API.get('/student/materials');
    const list = Array.isArray(listRaw) ? listRaw : [];
    const ul = document.getElementById('mat-list');
    ul.innerHTML = '';
    if (!list.length) {
      ul.innerHTML = '<li class="small">No study materials for your class yet.</li>';
      return;
    }
    list.forEach((m) => {
      const li = document.createElement('li');
      li.className = 'mt-2';
      li.innerHTML = `<strong>${esc(m.title)}</strong> — ${esc(m.subject)}
        ${m.fileUrl ? `<a class="btn small secondary" href="${esc(m.fileUrl)}" target="_blank" rel="noopener">Download</a>` : ''}`;
      ul.appendChild(li);
    });
  }

  async function loadNotices() {
    const itemsRaw = await SSC_API.get('/student/notices');
    const items = Array.isArray(itemsRaw) ? itemsRaw : [];
    const el = document.getElementById('stu-notices');
    if (!items.length) {
      el.innerHTML = '<p class="small">No notices published yet.</p>';
      return;
    }
    el.innerHTML = items
      .map(
        (n) =>
          `<div class="card mt-2"><strong>${esc(n.title)}</strong><p class="small mt-2">${esc(n.body || '')}</p>${
            n.pdfUrl ? `<a class="btn small secondary" href="${esc(n.pdfUrl)}" target="_blank">PDF</a>` : ''
          }</div>`
      )
      .join('');
  }

  async function loadAdmission() {
    const data = await SSC_API.get('/student/admission-status');
    const pre = document.getElementById('adm-pre');
    if (!data.linked || !data.application) {
      pre.textContent =
        'No admission application is linked to this account yet. If you applied online with the same email, it will appear here once the office processes it. Otherwise contact the admission cell.';
      return;
    }
    const a = data.application;
    pre.textContent = [
      `Application: ${a.applicationNumber}`,
      `Status: ${a.status}`,
      `Course: ${a.courseApplied || ''}`,
      a.documentsVerified != null ? `Documents verified: ${a.documentsVerified ? 'Yes' : 'No'}` : '',
      a.verificationNotes ? `Notes: ${a.verificationNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  async function loadEditProfile() {
    const u = await SSC_API.get('/student/profile');
    document.getElementById('student-profile-name').value = u.name || '';
    document.getElementById('student-profile-phone').value = u.phone || '';
    document.getElementById('student-profile-bio').value = u.bio || '';
    
    const img = document.getElementById('student-avatar-img');
    const placeholder = document.getElementById('student-avatar-placeholder');
    if (u.avatarUrl) {
      img.src = u.avatarUrl;
      img.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      img.style.display = 'none';
      placeholder.style.display = 'grid';
    }
    document.getElementById('student-avatar-upload').value = '';
  }

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // ════════════════════════════════════════════════════════════
  // PLACEMENT CELL — Student JS
  // ════════════════════════════════════════════════════════════

  async function loadPlacementPanel() {
    await Promise.all([loadStuPlDrives(), loadStuPlApplications()]);
  }

  async function loadStuPlDrives() {
    const drives = await SSC_API.get('/student/placement/drives');
    const container = document.getElementById('pl-drives-list');
    if (!container) return;

    if (!drives.length) {
      container.innerHTML = '<p class="small" style="opacity:0.6">No active placement drives at the moment. Check back soon.</p>';
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
                  ? `<span class="btn small" style="opacity:0.4;cursor:not-allowed;">Deadline Passed</span>`
                  : `<button class="btn small" data-apply-drive="${d._id}">Apply Now</button>`
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
          msg('Application submitted successfully!');
          loadPlacementPanel();
        } catch (err) {
          msg(err.data?.error || err.message || 'Could not apply', true);
          b.disabled = false;
          b.textContent = 'Apply Now';
        }
      });
    });
  }

  async function loadStuPlApplications() {
    const apps = await SSC_API.get('/student/placement/applications');
    const tb = document.querySelector('#tbl-stu-pl-apps tbody');
    if (!tb) return;
    tb.innerHTML = '';

    // Update stat grid
    const grid = document.getElementById('stu-pl-stat-grid');
    if (grid) {
      const applied = apps.length;
      const shortlisted = apps.filter(a => ['shortlisted','interview_scheduled','selected'].includes(a.applicationStatus)).length;
      const selected = apps.filter(a => a.applicationStatus === 'selected').length;
      grid.innerHTML = `
        <div class="stat-card"><span class="small">Total Applied</span><strong>${applied}</strong></div>
        <div class="stat-card"><span class="small">Shortlisted</span><strong style="color:#f59e0b">${shortlisted}</strong></div>
        <div class="stat-card"><span class="small">Selected</span><strong style="color:#22c55e">${selected}</strong></div>
      `;
    }

    if (!apps.length) {
      tb.innerHTML = '<tr><td colspan="6" class="small">You have not applied for any drives yet.</td></tr>';
      return;
    }

    const statusColor = { applied:'#94a3b8', shortlisted:'#f59e0b', interview_scheduled:'#3b82f6', selected:'#22c55e', rejected:'#ef4444' };
    apps.forEach((a) => {
      const tr = document.createElement('tr');
      const dt = a.appliedAt ? new Date(a.appliedAt).toLocaleDateString('en-IN') : '';
      const sColor = statusColor[a.applicationStatus] || '#94a3b8';
      const statusLabel = (a.applicationStatus || '').replace(/_/g, ' ');
      tr.innerHTML = `
        <td><strong>${esc(a.companyName)}</strong></td>
        <td>${esc(a.driveTitle)}</td>
        <td>${esc(a.packageOffered || '—')}</td>
        <td>${esc(a.location || '—')}</td>
        <td><span style="color:${sColor};font-weight:600;text-transform:capitalize">${esc(statusLabel)}</span></td>
        <td>${dt}</td>`;
      tb.appendChild(tr);
    });
  }

  // ════════════════════════════════════════════════════════════
  // TIMETABLE MODULE
  // ════════════════════════════════════════════════════════════
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
    const tt = await SSC_API.get('/student/timetable');
    const slots = tt.slots || [];
    const tbody = document.getElementById('tbl-student-timetable');
    tbody.innerHTML = '';
    
    periodTimes.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td><strong>${p.label}</strong></td>`;
      
      daysOfWeek.forEach(day => {
        const slot = slots.find(s => s.day === day && Number(s.period) === p.period);
        const td = document.createElement('td');
        if (slot) {
          td.innerHTML = `
            <div style="font-weight:600;color:var(--primary);">${esc(slot.subject)}</div>
            <div class="small" style="font-size:0.8rem;opacity:0.85;">${esc(slot.teacherName || 'TBA')} • Room ${esc(slot.room || 'TBA')}</div>
          `;
        } else {
          td.innerHTML = '<span class="small" style="opacity:0.35;">-</span>';
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
  }

  // ════════════════════════════════════════════════════════════
  // LIBRARY MODULE
  // ════════════════════════════════════════════════════════════
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
          await t.action();
        });
      }
    });
  }

  async function loadIssuedBooks() {
    const issues = await SSC_API.get('/student/library/my-books');
    const tbody = document.querySelector('#tbl-stu-lib-issued tbody');
    tbody.innerHTML = '';
    
    if (!issues.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="center small">You currently have no issued books.</td></tr>';
      return;
    }

    issues.forEach(is => {
      const tr = document.createElement('tr');
      const isOverdue = new Date(is.dueDate) < new Date();
      
      tr.innerHTML = `
        <td><strong>${esc(is.book?.title)}</strong></td>
        <td>${esc(is.book?.author)}</td>
        <td>${esc(is.book?.category)}</td>
        <td>${new Date(is.issuedAt).toLocaleDateString()}</td>
        <td><span style="${isOverdue ? 'color:#ef4444;font-weight:600;' : ''}">${new Date(is.dueDate).toLocaleDateString()}</span></td>
        <td>₹${is.fine || 0}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function loadBorrowHistory() {
    const history = await SSC_API.get('/student/library/history');
    const tbody = document.querySelector('#tbl-stu-lib-history tbody');
    tbody.innerHTML = '';
    
    if (!history.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="center small">Your borrow history is empty.</td></tr>';
      return;
    }

    history.forEach(is => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${esc(is.book?.title)}</strong></td>
        <td>${esc(is.book?.author)}</td>
        <td>${esc(is.book?.category)}</td>
        <td>${new Date(is.issuedAt).toLocaleDateString()}</td>
        <td>${new Date(is.returnedAt).toLocaleDateString()}</td>
        <td>₹${is.fine || 0}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ════════════════════════════════════════════════════════════
  // EXAMS MODULE
  // ════════════════════════════════════════════════════════════
  let examResultsCache = [];
  
  async function loadExamsPanel() {
    await loadExamSchedules();
    await loadExamResults();
    
    const closeBtn = document.getElementById('btn-close-print-view');
    if (closeBtn && !closeBtn.dataset.bound) {
      closeBtn.dataset.bound = '1';
      closeBtn.addEventListener('click', () => {
        document.getElementById('print-result-overlay').style.display = 'none';
      });
    }
  }

  async function loadExamSchedules() {
    const schedules = await SSC_API.get('/student/exams/schedule');
    const tbody = document.querySelector('#tbl-stu-exams tbody');
    tbody.innerHTML = '';
    
    if (!schedules.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="center small">No upcoming exams scheduled.</td></tr>';
      return;
    }

    schedules.forEach(ex => {
      const tr = document.createElement('tr');
      const dt = ex.examDate ? new Date(ex.examDate).toLocaleDateString() : 'TBA';
      const tm = ex.startTime ? `${dt} at ${ex.startTime}` : dt;
      
      tr.innerHTML = `
        <td><strong>${esc(ex.title)}</strong></td>
        <td><span style="text-transform: capitalize;">${ex.examType}</span></td>
        <td>${esc(ex.subject)}</td>
        <td>${tm}</td>
        <td>${esc(ex.venue || 'TBA')}</td>
        <td>${ex.maxMarks}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  async function loadExamResults() {
    examResultsCache = await SSC_API.get('/student/exams/results');
    const tbody = document.querySelector('#tbl-stu-results tbody');
    tbody.innerHTML = '';
    
    if (!examResultsCache.length) {
      tbody.innerHTML = '<tr><td colspan="10" class="center small">No exam results published yet.</td></tr>';
      return;
    }

    examResultsCache.forEach(r => {
      const tr = document.createElement('tr');
      const dt = r.examDate ? new Date(r.examDate).toLocaleDateString() : '';
      
      let statusColor = '';
      if (r.passFail === 'PASS') statusColor = 'color:var(--accent);font-weight:600;';
      else if (r.passFail === 'FAIL') statusColor = 'color:#ef4444;font-weight:600;';

      tr.innerHTML = `
        <td><strong>${esc(r.title)}</strong></td>
        <td>${esc(r.subject)}</td>
        <td><span style="text-transform: capitalize;">${r.examType}</span></td>
        <td>${dt}</td>
        <td>${r.marksObtained} / ${r.maxMarks}</td>
        <td>${r.percentage}%</td>
        <td><strong>${r.grade}</strong></td>
        <td><span style="${statusColor}">${r.passFail}</span></td>
        <td><strong>${r.rank || 'N/A'}</strong></td>
        <td>
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
    
    const profileRes = await SSC_API.get('/student/profile');
    const sp = profileRes.studentProfile || {};
    
    document.getElementById('pr-student-info').innerHTML = `
      <strong>Student Name:</strong> ${esc(profileRes.name)}<br>
      <strong>Roll Number:</strong> ${esc(sp.rollNumber || 'N/A')} &nbsp;&nbsp;|&nbsp;&nbsp; 
      <strong>Class:</strong> ${esc(sp.className || 'N/A')} &nbsp;&nbsp;|&nbsp;&nbsp;
      <strong>Course:</strong> ${esc(sp.courseName || 'N/A')}
    `;
    
    const tbody = document.querySelector('#tbl-print-result tbody');
    tbody.innerHTML = '';
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${esc(res.title)}</strong></td>
      <td>${esc(res.subject)}</td>
      <td style="text-transform: capitalize;">${res.examType}</td>
      <td><strong>${res.marksObtained} / ${res.maxMarks}</strong></td>
      <td>${res.percentage}%</td>
      <td><strong>${res.grade}</strong></td>
      <td><strong>${res.passFail}</strong></td>
      <td><strong>${res.rank || 'N/A'}</strong></td>
    `;
    tbody.appendChild(tr);
    
    document.getElementById('print-result-overlay').style.display = 'block';
    document.getElementById('print-result-overlay').scrollIntoView({ behavior: 'smooth' });
  }

  // ════════════════════════════════════════════════════════════

  document.addEventListener('DOMContentLoaded', boot);
})();
