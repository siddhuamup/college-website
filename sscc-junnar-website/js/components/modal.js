/**
 * SSCC Component: Reusable Modal Component
 */
export class Modal {
  static showConfirm(title, message, onConfirm, confirmText = 'Confirm', isDanger = false) {
    if (typeof document === 'undefined') return;
    const backdrop = document.createElement('div');
    backdrop.className = 'confirm-dialog-backdrop';
    
    const dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    
    dialog.innerHTML = `
      <h3>${title}</h3>
      <p>${message}</p>
      <div class="confirm-dialog-actions">
        <button type="button" class="btn btn--secondary cancel-btn">Cancel</button>
        <button type="button" class="btn ${isDanger ? 'btn--danger' : 'btn--primary'} confirm-btn">${confirmText}</button>
      </div>
    `;

    backdrop.appendChild(dialog);
    document.body.appendChild(backdrop);

    const cancelBtn = dialog.querySelector('.cancel-btn');
    const confirmBtn = dialog.querySelector('.confirm-btn');

    cancelBtn.addEventListener('click', () => backdrop.remove());
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.classList.add('btn--loading');
      try {
        await onConfirm();
      } finally {
        backdrop.remove();
      }
    });

    // Focus trap & ESC key handling
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') backdrop.remove();
    });
    confirmBtn.focus();
  }
}
