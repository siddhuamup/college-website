(function () {
  let studentsCache = [];

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
      if (String(user.role || '').toLowerCase() !== 'teacher') {
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

    document.getElementById('att-date').valueAsDate = new Date();

    document.getElementById('form-marks').addEventListener('submit', async (e) => {
      e.preventDefault();
      await SSC_API.post('/teacher/marks', {
        studentId: document.getElementById('mark-student').value,
        subject: document.getElementById('mark-subject').value.trim(),
        examName: document.getElementById('mark-exam').value.trim(),
        marksObtained: Number(document.getElementById('mark-obt').value),
        maxMarks: Number(document.getElementById('mark-max').value),
      });
      msg('Marks saved');
      loadMarks();
    });

    document.getElementById('att-save').addEventListener('click', async () => {
      const subject = document.getElementById('att-subject').value.trim();
      const date = document.getElementById('att-date').value;
      const entries = [];
      document.querySelectorAll('#att-rows input[type="checkbox"]').forEach((cb) => {
        entries.push({
          studentId: cb.getAttribute('data-sid'),
          status: cb.checked ? 'present' : 'absent',
        });
      });
      await SSC_API.post('/teacher/attendance', { subject, date, entries });
      msg('Attendance saved');
    });

    document.getElementById('form-mat').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      const fd = new FormData();
      fd.append('title', f.title.value);
      fd.append('subject', f.subject.value);
      fd.append('className', f.className.value);
      fd.append('file', f.file.files[0]);
      await SSC_API.upload('/teacher/materials', fd);
      f.reset();
      msg('Material uploaded');
      loadMaterials();
    });

    document.getElementById('form-edit-profile').addEventListener('submit', async (e) => {
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
        document.getElementById('who').innerHTML = `${avatarImg}<span>${esc(resUser.name)}</span>`;
        loadEditProfile();
      } catch (err) {
        msg(err.message || 'Update failed', true);
      }
    });

    load('subjects');
  }

  async function load(id) {
    msg('');
    try {
      if (id === 'subjects') await loadSubjects();
      if (id === 'students') await loadStudents();
      if (id === 'marks') await loadMarksPanel();
      if (id === 'attendance') await loadAttendancePanel();
      if (id === 'materials') await loadMaterials();
      if (id === 'notices') await loadNotices();
      if (id === 'edit-profile') await loadEditProfile();
    } catch (e) {
      msg(e.message || 'Error', true);
    }
  }

  async function loadSubjects() {
    const list = await SSC_API.get('/teacher/subjects');
    const ul = document.getElementById('subj-list');
    ul.innerHTML = '';
    list.forEach((a) => {
      const li = document.createElement('li');
      li.textContent = `${a.subject} — ${a.className}`;
      ul.appendChild(li);
    });
  }

  async function loadStudents() {
    studentsCache = await SSC_API.get('/teacher/students');
    const tb = document.querySelector('#tbl-stu tbody');
    tb.innerHTML = '';
    studentsCache.forEach((s) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(s.name)}</td><td>${esc(s.studentProfile?.rollNumber || '')}</td><td>${esc(
        s.studentProfile?.className || ''
      )}</td><td>${esc(s.email)}</td>`;
      tb.appendChild(tr);
    });
  }

  async function loadMarksPanel() {
    await loadStudents();
    const sel = document.getElementById('mark-student');
    sel.innerHTML = '';
    studentsCache.forEach((s) => {
      const o = document.createElement('option');
      o.value = s._id;
      o.textContent = s.name + ' (' + (s.studentProfile?.rollNumber || s._id) + ')';
      sel.appendChild(o);
    });
    await loadMarks();
  }

  async function loadMarks() {
    const rows = await SSC_API.get('/teacher/marks');
    const tb = document.querySelector('#tbl-marks tbody');
    tb.innerHTML = '';
    const byId = Object.fromEntries(studentsCache.map((s) => [String(s._id), s.name]));
    rows.slice(0, 40).forEach((m) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${esc(byId[String(m.studentId)] || m.studentId)}</td><td>${esc(m.subject)}</td><td>${esc(
        m.examName
      )}</td><td>${m.marksObtained}/${m.maxMarks}</td>`;
      tb.appendChild(tr);
    });
  }

  async function loadAttendancePanel() {
    await loadStudents();
    const box = document.getElementById('att-rows');
    box.innerHTML = '';
    studentsCache.forEach((s) => {
      const row = document.createElement('label');
      row.className = 'small';
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '0.5rem';
      row.style.marginBottom = '0.35rem';
      row.innerHTML = `<input type="checkbox" data-sid="${s._id}" checked/> <span>${esc(s.name)} — ${esc(
        s.studentProfile?.rollNumber || ''
      )}</span>`;
      box.appendChild(row);
    });
  }

  async function loadMaterials() {
    const list = await SSC_API.get('/teacher/materials');
    const ul = document.getElementById('mat-list');
    ul.innerHTML = '';
    list.forEach((m) => {
      const li = document.createElement('li');
      li.className = 'mt-2';
      li.innerHTML = `<strong>${esc(m.title)}</strong> — ${esc(m.subject)} (${esc(m.className)})
        ${m.fileUrl ? `<a class="btn small secondary" href="${m.fileUrl}" target="_blank" rel="noopener">Open</a>` : ''}`;
      ul.appendChild(li);
    });
  }

  async function loadNotices() {
    const items = await SSC_API.get('/teacher/notices');
    const box = document.getElementById('teach-notices');
    box.innerHTML = items
      .map(
        (n) =>
          `<div class="card mt-2"><strong>${esc(n.title)}</strong><p class="small mt-2">${esc(n.body || '')}</p>${
            n.pdfUrl ? `<a class="btn small secondary" href="${n.pdfUrl}" target="_blank">PDF</a>` : ''
          }</div>`
      )
      .join('');
  }

  async function loadEditProfile() {
    const { user } = await SSC_API.get('/auth/me');
    document.getElementById('teacher-profile-name').value = user.name || '';
    document.getElementById('teacher-profile-phone').value = user.phone || '';
    document.getElementById('teacher-profile-qual').value = user.teacherProfile?.qualifications || '';
    document.getElementById('teacher-profile-bio').value = user.bio || '';
    
    const img = document.getElementById('teacher-avatar-img');
    const placeholder = document.getElementById('teacher-avatar-placeholder');
    if (user.avatarUrl) {
      img.src = user.avatarUrl;
      img.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      img.style.display = 'none';
      placeholder.style.display = 'grid';
    }
    document.getElementById('teacher-avatar-upload').value = '';

  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
