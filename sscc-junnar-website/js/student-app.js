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
      if (id === 'marks') await loadMarks();
      if (id === 'attendance') await loadAttendance();
      if (id === 'materials') await loadMaterials();
      if (id === 'notices') await loadNotices();
      if (id === 'admission') await loadAdmission();
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
    const tb = document.querySelector('#tbl-att tbody');
    tb.innerHTML = '';
    const list = Array.isArray(rows) ? rows : [];
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

  document.addEventListener('DOMContentLoaded', boot);
})();
