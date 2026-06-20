(function () {
  let cachedSettings = null;
  async function getSettings() {
    if (cachedSettings) return cachedSettings;
    try {
      cachedSettings = await SSC_API.get('/public/settings');
    } catch (e) {
      console.error('Failed to fetch settings', e);
      cachedSettings = { attendanceThreshold: 75 };
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

  function msg(t, err) {
    const node = el('dash-msg');
    if (!node) return;
    node.textContent = t || '';
    node.className = 'small mt-3' + (err ? ' alert error' : t ? ' alert success' : '');
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
          alert('Could not load profile for ID Card: ' + (err.message || 'Unknown error'));
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

    const qaResultsBtn = document.getElementById('qa-view-results');
    if (qaResultsBtn) {
      qaResultsBtn.addEventListener('click', () => {
        panel('exams');
        load('exams');
      });
    }

    const qaAttendanceBtn = document.getElementById('qa-view-attendance');
    if (qaAttendanceBtn) {
      qaAttendanceBtn.addEventListener('click', () => {
        panel('attendance');
        load('attendance');
      });
    }

    const qaEditProfileBtn = document.getElementById('qa-edit-profile');
    if (qaEditProfileBtn) {
      qaEditProfileBtn.addEventListener('click', () => {
        panel('edit-profile');
        load('edit-profile');
      });
    }

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

    // 1. Populate top welcome
    document.getElementById('db-welcome-name').textContent = `Welcome, ${u.name}!`;
    document.getElementById('db-student-meta').textContent = `${sp.courseName || 'General'} • Year ${sp.year || '1'} (Roll: ${sp.rollNumber || 'N/A'})`;
    
    const dbAvatar = document.getElementById('db-avatar-img');
    const dbPlaceholder = document.getElementById('db-avatar-placeholder');
    if (u.avatarUrl) {
      dbAvatar.src = u.avatarUrl;
      dbAvatar.style.display = 'block';
      dbPlaceholder.style.display = 'none';
    } else {
      dbAvatar.style.display = 'none';
      dbPlaceholder.style.display = 'grid';
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
    } catch { /* silent fallback */ }

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

    document.getElementById('db-stat-attendance').textContent = `${overallAttendancePct}%`;
    document.getElementById('db-stat-attendance-desc').innerHTML = `
      <div style="margin-top: 0.25rem; font-size: 0.75rem; opacity: 0.85;">Required: ${threshold}%</div>
      <div style="margin-top: 0.25rem; font-weight: 600; color: ${statusColor};">Status: ${statusText}</div>
    `;

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
    } catch { /* silent fallback */ }

    const avgPct = examCount ? (totalMarksPct / examCount) : null;
    const gpaVal = avgPct !== null ? `${(avgPct / 10).toFixed(1)} CGPA` : 'N/A';
    document.getElementById('db-stat-gpa').textContent = gpaVal;
    document.getElementById('db-stat-gpa-desc').textContent = examCount
      ? `Based on ${examCount} exams`
      : 'No grades published';

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
    } catch { /* silent fallback */ }
    document.getElementById('db-stat-exams').textContent = upcomingExamsCount;
    document.getElementById('db-stat-exams-desc').textContent = nextExamDateStr;

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
    } catch { /* silent fallback */ }
    document.getElementById('db-stat-library').textContent = libraryCount;
    document.getElementById('db-stat-library-desc').textContent = oldestDueDateStr;

    // 6. Compute and render Monthly Attendance Trend chart card
    const trendContainer = document.getElementById('db-attendance-trend-chart');
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
            barWrap.style.display = 'flex';
            barWrap.style.flexDirection = 'column';
            barWrap.style.gap = '0.25rem';
            
            let color = 'var(--accent)';
            if (pct < 75) color = '#ef4444';
            
            barWrap.innerHTML = `
              <div style="display:flex; justify-content:space-between; font-size:0.75rem;">
                <span style="font-weight:600;">${monthLabel}</span>
                <span>${pct}% (${stat.present}/${stat.total})</span>
              </div>
              <div style="background:rgba(255,255,255,0.08); height:8px; border-radius:4px; overflow:hidden; border: 0.5px solid rgba(255,255,255,0.1);">
                <div style="background:${color}; width:${pct}%; height:100%; border-radius:4px; transition: width 0.6s ease-in-out;"></div>
              </div>
            `;
            trendContainer.appendChild(barWrap);
          });
        }
      }
    }

    // 7. Always show dashboard widgets — empty data uses placeholders above
    ['card-db-attendance', 'card-db-gpa', 'card-db-exams', 'card-db-library', 'card-db-marks', 'card-db-att-summary', 'card-db-att-trend'].forEach((id) => {
      const card = el(id);
      if (card) card.style.display = '';
    });
    const row2 = el('db-row-2');
    if (row2) {
      row2.style.display = '';
      row2.className = 'grid grid-3 student-row-2';
    }

    // 8. Today's Timetable slots
    const dbTimetable = document.getElementById('db-timetable-today');
    if (dbTimetable) {
      dbTimetable.innerHTML = '';
      try {
        const tt = await SSC_API.get('/student/timetable');
        const slots = tt.slots || [];
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        let todayDay = dayNames[new Date().getDay()];
        if (todayDay === 'Sunday') todayDay = 'Monday'; // Default to Monday if Sunday
        
        const todaySlots = slots.filter(s => s.day === todayDay).sort((a,b) => Number(a.period) - Number(b.period));
        if (!todaySlots.length) {
          dbTimetable.innerHTML = `<p class="small" style="opacity: 0.7;">No slots scheduled for today (${todayDay}).</p>`;
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
      } catch {
        dbTimetable.innerHTML = '<p class="small" style="opacity: 0.7;">Unable to load timetable slots.</p>';
      }
    }

    // 9. Recent Notices
    const dbNotices = document.getElementById('db-notices-feed');
    if (dbNotices) {
      dbNotices.innerHTML = '';
      try {
        const notices = await SSC_API.get('/student/notices');
        if (Array.isArray(notices) && notices.length > 0) {
          notices.slice(0, 4).forEach(n => {
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
          dbNotices.innerHTML = '<p class="small" style="opacity: 0.7;">No recent notices.</p>';
        }
      } catch {
        dbNotices.innerHTML = '<p class="small" style="opacity: 0.7;">Unable to load notices.</p>';
      }
    }

    // 10. Recent Study Materials
    const dbMaterials = document.getElementById('db-materials-feed');
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
          dbMaterials.innerHTML = '<p class="small" style="opacity: 0.7;">No study materials available.</p>';
        }
      } catch {
        dbMaterials.innerHTML = '<p class="small" style="opacity: 0.7;">Unable to load study materials.</p>';
      }
    }
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
    
    const settings = await getSettings();
    const threshold = settings.attendanceThreshold ? Number(settings.attendanceThreshold) : 75;

    const warn = document.getElementById('att-warn-banner');
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
      trendColor = '#22c55e'; // Green
    } else if (pct30 < pctPrior - 1) {
      trendDir = '↓ Dropping';
      trendColor = '#ef4444'; // Red
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
    let statusColor = '#22c55e'; // Green
    let statusBg = 'var(--accent-muted)';
    let statusBorder = '1px solid var(--accent)';
    
    if (pct < threshold) {
      statusText = 'Attendance Warning';
      statusColor = '#ef4444'; // Red
      statusBg = 'var(--danger-muted)';
      statusBorder = '1px solid var(--danger)';
    } else if (pct < threshold + 5) {
      statusText = 'Watchlist';
      statusColor = '#f59e0b'; // Amber
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

    const tblBreakdown = document.querySelector('#tbl-subject-breakdown tbody');
    tblBreakdown.innerHTML = '';
    const subjects = Object.keys(subBreakdown).sort();
    if (!subjects.length) {
      tblBreakdown.innerHTML = '<tr><td colspan="4" class="small">No attendance data to summarize.</td></tr>';
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
          <td>${esc(sub)}</td>
          <td>${stats.present}</td>
          <td>${stats.total}</td>
          <td style="${subColorStyle}">${subPct}%</td>
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

  // ════════════════════════════════════════════════════════════
  // PLACEMENT CELL — Student JS
  // ════════════════════════════════════════════════════════════

  async function loadPlacementPanel() {
    await Promise.all([loadStuPlDrives(), loadStuPlApplications()]);
  }

  async function loadStuPlDrives() {
    const drives = asArray(await SSC_API.get('/student/placement/drives'));
    const container = el('pl-drives-list');
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
    const apps = asArray(await SSC_API.get('/student/placement/applications'));
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
    const slots = asArray(tt?.slots);
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
    const issues = asArray(await SSC_API.get('/student/library/my-books'));
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
    const history = asArray(await SSC_API.get('/student/library/history'));
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
    const schedules = asArray(await SSC_API.get('/student/exams/schedule'));
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
    examResultsCache = asArray(await SSC_API.get('/student/exams/results'));
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
