const fs = require('fs');

const html = `
  <!-- Student ID Card Modal -->
  <div class="modal-overlay" id="modal-student-idcard" style="display:none;">
    <div class="modal-container" style="max-width: 420px; padding: 1.5rem; background: var(--bg-card, #ffffff); border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);">
      <div class="modal-header" style="margin-bottom: 1rem; border-bottom: none; padding-bottom: 0;">
        <h3 class="modal-title" style="font-size: 1.1rem; color: var(--primary);">Digital ID Card</h3>
        <button type="button" class="modal-close" onclick="document.getElementById('modal-student-idcard').style.display='none'">&times;</button>
      </div>
      
      <!-- Wallet-sized card container -->
      <div id="idcard-print-area" style="position: relative; width: 340px; height: 500px; margin: 0 auto; padding: 1.5rem; border-radius: 12px; background: linear-gradient(135deg, var(--card) 0%, rgba(56, 189, 248, 0.05) 100%); border: 2px solid var(--primary); box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); display: flex; flex-direction: column; justify-content: space-between; overflow: hidden; font-family: 'Outfit', sans-serif;">
        <!-- Header -->
        <div style="text-align: center; border-bottom: 1.5px solid var(--primary); padding-bottom: 0.75rem;">
          <h4 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: var(--primary); letter-spacing: 0.5px;">SHRI SHIV CHHATRAPATI COLLEGE</h4>
          <p class="small" style="margin: 2px 0 0 0; font-size: 0.65rem; color: var(--muted); text-transform: uppercase;">Junnar, Pune — 410502</p>
        </div>
        
        <!-- Photo & Basic details -->
        <div style="display: flex; flex-direction: column; align-items: center; margin-top: 1rem; flex: 1; justify-content: center;">
          <div style="position: relative; width: 110px; height: 110px; border-radius: 50%; overflow: hidden; border: 3px solid var(--primary); margin-bottom: 1rem; background: rgba(0,0,0,0.1); display: grid; place-items: center;">
            <img id="idcard-photo" src="" alt="Student Photo" style="width: 100%; height: 100%; object-fit: cover; display: none;"/>
            <div id="idcard-photo-placeholder" class="faculty-avatar-placeholder" style="font-size: 2rem;">🎓</div>
          </div>
          
          <h3 id="idcard-name" style="margin: 0 0 0.25rem 0; font-size: 1.15rem; font-weight: 700; text-align: center; color: var(--text);"></h3>
          <span id="idcard-course" style="font-size: 0.8rem; font-weight: 600; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 1rem;"></span>
        </div>
        
        <!-- Detailed profile info -->
        <div style="font-size: 0.75rem; color: var(--text); border-top: 1px dashed rgba(56, 189, 248, 0.2); padding-top: 0.75rem; margin-bottom: 0.5rem; display: flex; flex-direction: column; gap: 0.4rem;">
          <div style="display: flex; justify-content: space-between;"><strong>Student ID:</strong> <span id="idcard-studentid"></span></div>
          <div style="display: flex; justify-content: space-between;"><strong>Roll Number:</strong> <span id="idcard-roll"></span></div>
          <div style="display: flex; justify-content: space-between;"><strong>Class & Division:</strong> <span id="idcard-class"></span></div>
          <div style="display: flex; justify-content: space-between;"><strong>Mobile:</strong> <span id="idcard-phone"></span></div>
          <div style="display: flex; justify-content: space-between; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"><strong>College Email:</strong> <span id="idcard-email" style="font-size: 0.7rem;"></span></div>
        </div>

        <!-- Footer / Validity -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 1.5px solid var(--primary); padding-top: 0.6rem; margin-top: 0.25rem;">
          <div>
            <div style="font-size: 0.55rem; color: var(--muted); text-transform: uppercase;">Validity</div>
            <div style="font-size: 0.68rem; font-weight: 600;" id="idcard-validity">May 2029</div>
          </div>
          <div style="width: 45px; height: 45px; display: grid; place-items: center; padding: 2px;">
            <canvas id="idcard-qr" style="width: 100%; height: 100%; background: #fff; padding: 2px; border-radius: 4px;"></canvas>
          </div>
        </div>
      </div>
      
      <!-- Actions -->
      <div style="margin-top: 1.5rem; display: flex; gap: 1rem; justify-content: center;">
        <button class="btn" onclick="printIdCard()" style="color: #000; font-size: 0.85rem; padding: 0.5rem 1rem; display: flex; align-items: center; gap: 0.4rem;">
          Print ID Card
        </button>
        <button class="btn secondary" onclick="document.getElementById('modal-student-idcard').style.display='none'" style="font-size: 0.85rem; padding: 0.5rem 1rem; color: var(--text);">Close</button>
      </div>
    </div>
  </div>
  
  <script>
    function printIdCard() {
      const printContent = document.getElementById('idcard-print-area').outerHTML;
      const originalBody = document.body.innerHTML;
      const printWindow = window.open('', '', 'height=600,width=800');
      printWindow.document.write('<html><head><title>Student ID Card</title>');
      printWindow.document.write('<style>@import url("https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700&display=swap"); body { font-family: "Outfit", sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0; background: #fff; } * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }</style>');
      printWindow.document.write('</head><body>');
      printWindow.document.write(printContent);
      printWindow.document.write('</body></html>');
      printWindow.document.close();
      setTimeout(() => {
        printWindow.print();
      }, 500);
    }
  </script>
`;

let content = fs.readFileSync('student/index.html', 'utf8');
// remove if already there
if (content.includes('<!-- Student ID Card Modal -->')) {
   console.log('Already there. Aborting.');
   process.exit(0);
}
const lines = content.split('\n');
const insertIndex = lines.findIndex(l => l.includes('</body>'));
lines.splice(insertIndex, 0, html);
fs.writeFileSync('student/index.html', lines.join('\n'));
console.log('ID card HTML injected successfully.');
