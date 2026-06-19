const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const SERVER = 'http://localhost:3000';
const OUT_DIR = 'C:\\Users\\Siddhu\\.gemini\\antigravity-ide\\brain\\0b66d80b-9122-4539-a4a1-991d2a048f97';
let token = null;

async function api(endpoint, method = 'GET', body = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  
  const res = await fetch(`${SERVER}/api${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login() {
  const r = await api('/auth/admin-access', 'POST', { accessKey: '123456' });
  if (r.status === 200 && r.data.token) {
    token = r.data.token;
    console.log('API Login successful');
  } else {
    throw new Error('API Login failed');
  }
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function takeScreenshot(page, panelName, filename) {
  if (!page) return;
  try {
    await page.evaluate((panel) => {
      const btn = document.querySelector(`button[data-panel="${panel}"]`);
      if(btn) btn.click();
    }, panelName);
    await delay(1000); // let UI render
    await page.screenshot({ path: path.join(OUT_DIR, filename) });
    console.log(`Saved screenshot: ${filename}`);
  } catch (err) {
    console.log(`Failed to take screenshot ${filename}: ${err.message}`);
  }
}

async function run() {
  await login();
  
  let browser, page;
  try {
    browser = await puppeteer.launch({ 
      headless: 'new', 
      args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    // Login in browser
    await page.goto(`${SERVER}/admin`, { waitUntil: 'domcontentloaded' });
    await delay(500);
    await page.type('#admin-access-key', '123456');
    await page.click('#admin-gate-form button[type="submit"]');
    await delay(2000);
  } catch (err) {
    console.log('Puppeteer launch failed. Proceeding with API tests only.', err);
    page = null;
  }

  let results = [];

  // Helper for tests
  async function testCrud(name, panel, getEndpoint, doAction, idExtractor) {
    console.log(`\n--- Running: ${name} ---`);
    let result = { name, panel };
    
    // 1. Before state
    await takeScreenshot(page, panel, `${name.replace(/[^a-zA-Z0-9]/g, '_')}_before.png`);
    const beforeRes = await api(getEndpoint);
    result.beforeState = beforeRes.data;
    
    // find target
    const target = idExtractor(beforeRes.data);
    if (!target) {
      console.log(`No target found for ${name}`);
      result.error = 'No target found';
      results.push(result);
      return;
    }
    
    // 2. Action
    console.log(`Target ID: ${target.id || target._id}`);
    const actionRes = await doAction(target.id || target._id);
    result.actionEndpoint = actionRes.endpoint;
    result.actionStatus = actionRes.status;
    result.actionResponse = actionRes.data;
    
    // 3. After state
    if (page) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await delay(1000);
    }
    await takeScreenshot(page, panel, `${name.replace(/[^a-zA-Z0-9]/g, '_')}_after.png`);
    const afterRes = await api(getEndpoint);
    result.afterState = afterRes.data;
    
    results.push(result);
    console.log(`Status: ${actionRes.status}`);
  }

  // --- Tests ---
  
  // 1. Student Edit
  await testCrud('1_Student_Edit', 'students', '/admin/students', 
    async (id) => {
      const endpoint = `/admin/students/${id}`;
      const r = await api(endpoint, 'PATCH', { name: 'Test Student ' + Date.now() });
      return { endpoint, ...r };
    },
    (data) => data.length > 0 ? data[0] : null
  );

  // 2. Student Delete
  await testCrud('2_Student_Delete', 'students', '/admin/students', 
    async (id) => {
      const endpoint = `/admin/students/${id}`;
      const r = await api(endpoint, 'DELETE');
      return { endpoint, ...r };
    },
    (data) => data.length > 1 ? data[1] : (data.length > 0 ? data[0] : null)
  );
  
  // 3. Faculty Edit
  await testCrud('3_Faculty_Edit', 'teachers', '/admin/teachers', 
    async (id) => {
      const endpoint = `/admin/teachers/${id}`;
      const r = await api(endpoint, 'PATCH', { name: 'Test Faculty ' + Date.now() });
      return { endpoint, ...r };
    },
    (data) => data.length > 0 ? data[0] : null
  );

  // 4. Faculty Delete
  await testCrud('4_Faculty_Delete', 'teachers', '/admin/teachers', 
    async (id) => {
      const endpoint = `/admin/teachers/${id}`;
      const r = await api(endpoint, 'DELETE');
      return { endpoint, ...r };
    },
    (data) => data.length > 1 ? data[1] : (data.length > 0 ? data[0] : null)
  );

  // 5. Notice Edit
  await testCrud('5_Notice_Edit', 'notices', '/admin/notices', 
    async (id) => {
      const endpoint = `/admin/notices/${id}`;
      const r = await api(endpoint, 'PATCH', { title: 'Updated Notice ' + Date.now() });
      return { endpoint, ...r };
    },
    (data) => data.length > 0 ? data[0] : null
  );

  // 6. Notice Delete
  await testCrud('6_Notice_Delete', 'notices', '/admin/notices', 
    async (id) => {
      const endpoint = `/admin/notices/${id}`;
      const r = await api(endpoint, 'DELETE');
      return { endpoint, ...r };
    },
    (data) => data.length > 1 ? data[1] : (data.length > 0 ? data[0] : null)
  );

  // 7. Study Material Delete
  await testCrud('7_Study_Material_Delete', 'study-materials', '/admin/study-materials', 
    async (id) => {
      const endpoint = `/admin/study-materials/${id}`;
      const r = await api(endpoint, 'DELETE');
      return { endpoint, ...r };
    },
    (data) => data.length > 0 ? data[0] : null
  );

  // 8. Examination Edit
  await testCrud('8_Examination_Edit', 'exams', '/admin/exams', 
    async (id) => {
      const endpoint = `/admin/exams/${id}`;
      const r = await api(endpoint, 'PATCH', { title: 'Updated Exam ' + Date.now() });
      return { endpoint, ...r };
    },
    (data) => data.length > 0 ? data[0] : null
  );

  // 9. Examination Delete
  await testCrud('9_Examination_Delete', 'exams', '/admin/exams', 
    async (id) => {
      const endpoint = `/admin/exams/${id}`;
      const r = await api(endpoint, 'DELETE');
      return { endpoint, ...r };
    },
    (data) => data.length > 1 ? data[1] : (data.length > 0 ? data[0] : null)
  );

  // 10. Admission Approve/Reject
  await testCrud('10_Admission_Workflow', 'admissions', '/admin/admissions', 
    async (id) => {
      const endpoint = `/admin/admissions/${id}`;
      const r = await api(endpoint, 'PATCH', { status: 'approved' });
      return { endpoint, ...r };
    },
    (data) => {
      const pending = data.find(d => String(d.status).toLowerCase() === 'pending');
      return pending || (data.length > 0 ? data[0] : null);
    }
  );

  fs.writeFileSync('crud_results.json', JSON.stringify(results, null, 2));
  console.log('Saved results to crud_results.json');
  if (browser) await browser.close();
}

run().catch(console.error);
