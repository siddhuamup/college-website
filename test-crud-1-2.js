const puppeteer = require('puppeteer');

const SERVER_URL = 'http://localhost:3000';
const OUT_DIR = 'C:\\Users\\Siddhu\\.gemini\\antigravity-ide\\brain\\0b66d80b-9122-4539-a4a1-991d2a048f97';

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  try {
    console.log('Navigating to Admin Panel...');
    await page.goto(`${SERVER_URL}/admin`, { waitUntil: 'domcontentloaded' });
    await delay(1000);
    
    // Login
    console.log('Logging in...');
    await page.type('#admin-access-key', '123456');
    await page.click('#admin-gate-form button[type="submit"]');
    
    await page.waitForSelector('#admin-shell', { visible: true, timeout: 5000 });
    console.log('Logged in successfully!');
    await delay(1000);

    // ==========================================
    // 1. Student Edit
    // ==========================================
    console.log('--- TEST 1: Student Edit ---');
    await page.click('button[data-panel="students"]');
    await delay(2000);
    await page.screenshot({ path: `${OUT_DIR}\\1_student_edit_before.png` });

    console.log('Clicking Edit on the first student...');
    await page.evaluate(() => {
      const editBtn = document.querySelector('button[onclick^="editStudent"]');
      if(editBtn) editBtn.click();
    });
    await page.waitForSelector('#modal-student-edit', { visible: true, timeout: 5000 });
    
    // Modify
    await page.evaluate(() => {
      const input = document.getElementById('edit-student-name');
      if(input) input.value = input.value + ' (Edited)';
    });
    await delay(500);
    await page.screenshot({ path: `${OUT_DIR}\\1_student_edit_action.png` });
    
    // Save
    await page.click('#edit-student-form button[type="submit"]');
    await delay(2000); // Wait for API and UI update
    await page.screenshot({ path: `${OUT_DIR}\\1_student_edit_after.png` });
    console.log('Test 1 Complete');

    // ==========================================
    // 2. Student Delete
    // ==========================================
    console.log('--- TEST 2: Student Delete ---');
    await page.screenshot({ path: `${OUT_DIR}\\2_student_delete_before.png` });
    
    await page.evaluate(() => {
      const delBtn = document.querySelector('button[onclick^="deleteStudent"]');
      if(delBtn) delBtn.click();
    });
    await delay(1000);
    await page.screenshot({ path: `${OUT_DIR}\\2_student_delete_action.png` });
    
    // Assuming it shows a confirmation modal/prompt, wait wait... does it use window.confirm?
    // Let's check admin-app.js later. If it's a window.confirm, puppeteer dismisses by default unless handled!
    
  } catch (err) {
    console.error('Error during test:', err);
  } finally {
    await browser.close();
  }
}

run();
