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
      document.getElementById('admin-user').textContent = user.name + ' • ' + user.email;
    } catch {
      SSC_API.setToken(null);
      showGate();
      return;
    }

    document.getElementById('logout-btn').addEventListener('click', () => {
      SSC_API.setToken(null);
      showGate();
    });

    document.querySelectorAll('#dash-nav button').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#dash-nav button').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        const id = btn.getAttribute('data-panel');
        document.querySelectorAll('.dash-panel').forEach((p) => {
          p.classList.toggle('active', p.getAttribute('data-panel') === id);
        });
        document.getElementById('dash-title').textContent = btn.textContent;
        loadPanel(id);
      });
    });

    loadPanel('overview');
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
      if (id === 'settings') await loadSettings();
    } catch (e) {
      msg(e.message || 'Load failed', true);
    }
  }

  async function loadStats() {
    const s = await SSC_API.get('/admin/dashboard/stats');
    const grid = document.getElementById('stat-grid');
    grid.innerHTML = `
      <div class="stat-card"><span class="small">Students</span><strong>${s.students}</strong></div>
      <div class="stat-card"><span class="small">Faculty</span><strong>${s.teachers}</strong></div>
      <div class="stat-card"><span class="small">Total admissions</span><strong>${s.totalAdmissions}</strong></div>
      <div class="stat-card"><span class="small">Pending admissions</span><strong>${s.pendingAdmissions}</strong></div>
      <div class="stat-card"><span class="small">Notices</span><strong>${s.noticesCount}</strong></div>
      <div class="stat-card"><span class="small">Feedback</span><strong>${s.feedbackCount}</strong></div>
    `;
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

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
