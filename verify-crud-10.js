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
  }
}

async function run() {
  await login();
  
  let browser, page;
  try {
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });
    
    await page.goto(`${SERVER}/admin`, { waitUntil: 'domcontentloaded' });
    await new Promise(r => setTimeout(r, 500));
    await page.type('#admin-access-key', '123456');
    await page.click('#admin-gate-form button[type="submit"]');
    await new Promise(r => setTimeout(r, 2000));
  } catch (err) {
    page = null;
  }

  let results = JSON.parse(fs.readFileSync('crud_results.json', 'utf8'));

  async function testCrud(name, panel, getEndpoint, doAction, idExtractor) {
    let result = { name, panel };
    
    if(page) {
      await page.evaluate((p) => { document.querySelector(`button[data-panel="${p}"]`).click(); }, panel);
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(OUT_DIR, `${name.replace(/[^a-zA-Z0-9]/g, '_')}_before.png`) });
    }
    const beforeRes = await api(getEndpoint);
    result.beforeState = beforeRes.data;
    
    const target = idExtractor(beforeRes.data);
    
    const actionRes = await doAction(target.id || target._id);
    result.actionEndpoint = actionRes.endpoint;
    result.actionStatus = actionRes.status;
    result.actionResponse = actionRes.data;
    
    if (page) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await new Promise(r => setTimeout(r, 1000));
      await page.evaluate((p) => { document.querySelector(`button[data-panel="${p}"]`).click(); }, panel);
      await new Promise(r => setTimeout(r, 1000));
      await page.screenshot({ path: path.join(OUT_DIR, `${name.replace(/[^a-zA-Z0-9]/g, '_')}_after.png`) });
    }
    const afterRes = await api(getEndpoint);
    result.afterState = afterRes.data;
    
    results = results.filter(r => r.name !== name);
    results.push(result);
  }

  await testCrud('10_Admission_Workflow', 'admissions', '/admin/admissions', 
    async (id) => {
      const endpoint = `/admin/admissions/${id}/decision`;
      const r = await api(endpoint, 'POST', { status: 'approved', notes: 'API Test approval', createAccount: true, courseName: 'BCA', year: 'First Year' });
      return { endpoint, ...r };
    },
    (data) => data.find(d => String(d.status).toLowerCase() === 'pending') || data[0]
  );

  fs.writeFileSync('crud_results.json', JSON.stringify(results, null, 2));
  console.log('Fixed Test 10');
  if (browser) await browser.close();
}
run();
