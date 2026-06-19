const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport({ width: 1280, height: 800 });

  console.log('Navigating to Admin Panel...');
  await page.goto('http://localhost:3000/admin', { waitUntil: 'networkidle2' });
  
  // Login
  console.log('Logging in...');
  await page.type('#admin-access-key', '123456');
  await page.click('#admin-gate-form button[type="submit"]');
  
  // Wait for shell to be visible
  await page.waitForSelector('#admin-shell', { visible: true, timeout: 5000 });
  console.log('Logged in successfully!');
  
  // Test 1: Student Edit
  console.log('--- TEST 1: Student Edit ---');
  // Navigate to students panel
  await page.click('button[data-panel="students"]');
  await page.waitForSelector('#students-list tr', { timeout: 5000 }).catch(() => console.log('No students found or table not loaded'));
  
  // Take screenshot of before state
  await page.screenshot({ path: 'C:\\Users\\Siddhu\\.gemini\\antigravity-ide\\brain\\0b66d80b-9122-4539-a4a1-991d2a048f97\\student_edit_before.png' });

  console.log('Clicking Edit on the first student...');
  const editButtons = await page.$$('button[onclick^="editStudent"]');
  if (editButtons.length > 0) {
    await editButtons[0].click();
    await page.waitForSelector('#modal-student-edit', { visible: true });
    
    // Change name
    await page.evaluate(() => {
      const nameInput = document.getElementById('edit-student-name');
      if(nameInput) {
        nameInput.value = nameInput.value + ' (Edited)';
      }
    });
    
    await page.screenshot({ path: 'C:\\Users\\Siddhu\\.gemini\\antigravity-ide\\brain\\0b66d80b-9122-4539-a4a1-991d2a048f97\\student_edit_action.png' });
    
    // Save
    await page.click('#edit-student-form button[type="submit"]');
    await page.waitForFunction(() => {
      return document.getElementById('modal-student-edit').style.display === 'none';
    }, { timeout: 5000 }).catch(() => console.log('Modal did not close'));
    
    // Take screenshot of after state
    await page.screenshot({ path: 'C:\\Users\\Siddhu\\.gemini\\antigravity-ide\\brain\\0b66d80b-9122-4539-a4a1-991d2a048f97\\student_edit_after.png' });
    console.log('Test 1 Complete');
  } else {
    console.log('No students available to edit.');
  }
  
  await browser.close();
}

run().catch(console.error);
