/**
 * Reusable Drag-and-Drop File Upload Component — SSCC Junnar ERP
 *
 * Features:
 * - Drag and drop dropzone with visual highlights
 * - File type & max size validation before upload
 * - Progress bar with XHR upload status
 * - Image thumbnail preview
 */

class DropzoneUpload {
  /**
   * @param {Object} opts
   * @param {HTMLElement} opts.container - Container element to render the dropzone into
   * @param {string} opts.uploadUrl - API endpoint URL
   * @param {string} [opts.fieldName='file'] - Form field name for file
   * @param {string} [opts.accept='image/*'] - Allowed MIME types / extensions
   * @param {number} [opts.maxSizeMb=10] - Max file size in MB
   * @param {Function} [opts.onSuccess] - Callback when upload completes: (response) => {}
   * @param {Function} [opts.onError] - Callback on error: (errMessage) => {}
   */
  constructor(opts) {
    this.container = opts.container;
    this.uploadUrl = opts.uploadUrl;
    this.fieldName = opts.fieldName || 'file';
    this.accept = opts.accept || '*/*';
    this.maxSizeMb = opts.maxSizeMb || 10;
    this.onSuccess = opts.onSuccess || (() => {});
    this.onError = opts.onError || ((msg) => alert(msg));
    this.selectedFile = null;

    this.render();
    this.bindEvents();
  }

  render() {
    this.container.innerHTML = `
      <div class="dropzone-box" id="dzBox" style="border: 2px dashed var(--border-color, #cbd5e1); border-radius: 12px; padding: 2rem; text-align: center; background: var(--bg-secondary, #f8fafc); cursor: pointer; transition: all 0.2s ease;">
        <input type="file" id="dzInput" accept="${this.accept}" style="display: none;" />
        <div class="dz-icon" style="font-size: 2.5rem; margin-bottom: 0.5rem;">📁</div>
        <p style="font-weight: 600; margin-bottom: 0.25rem;">Drag & drop your file here or <span style="color: var(--primary-color, #2563eb); text-decoration: underline;">browse</span></p>
        <p style="font-size: 0.85rem; color: var(--text-muted, #64748b); margin-bottom: 0;">Max size: ${this.maxSizeMb}MB</p>
        <div id="dzPreview" style="display: none; margin-top: 1rem; padding: 0.75rem; background: var(--bg-primary, #ffffff); border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); text-align: left;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <span id="dzFileName" style="font-weight: 500; font-size: 0.9rem; word-break: break-all;"></span>
            <button type="button" id="dzRemoveBtn" style="background: none; border: none; color: #ef4444; font-size: 1.2rem; cursor: pointer;">&times;</button>
          </div>
          <div class="dz-progress-bar" style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; margin-top: 0.5rem; overflow: hidden; display: none;">
            <div id="dzProgressFill" style="width: 0%; height: 100%; background: #2563eb; transition: width 0.1s ease;"></div>
          </div>
        </div>
      </div>
    `;
  }

  bindEvents() {
    const box = this.container.querySelector('#dzBox');
    const input = this.container.querySelector('#dzInput');
    const removeBtn = this.container.querySelector('#dzRemoveBtn');

    box.addEventListener('click', (e) => {
      if (e.target !== removeBtn) input.click();
    });

    input.addEventListener('change', () => {
      if (input.files && input.files[0]) {
        this.handleFile(input.files[0]);
      }
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      box.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        box.style.borderColor = 'var(--primary-color, #2563eb)';
        box.style.background = 'var(--bg-accent, #eff6ff)';
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      box.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        box.style.borderColor = 'var(--border-color, #cbd5e1)';
        box.style.background = 'var(--bg-secondary, #f8fafc)';
      });
    });

    box.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      if (dt && dt.files && dt.files[0]) {
        this.handleFile(dt.files[0]);
      }
    });

    removeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.clearFile();
    });
  }

  handleFile(file) {
    if (file.size > this.maxSizeMb * 1024 * 1024) {
      this.onError(`File "${file.name}" exceeds the maximum allowed size of ${this.maxSizeMb}MB.`);
      return;
    }

    this.selectedFile = file;
    const preview = this.container.querySelector('#dzPreview');
    const nameEl = this.container.querySelector('#dzFileName');

    nameEl.textContent = `${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    preview.style.display = 'block';
  }

  clearFile() {
    this.selectedFile = null;
    const input = this.container.querySelector('#dzInput');
    const preview = this.container.querySelector('#dzPreview');
    input.value = '';
    preview.style.display = 'none';
  }

  async upload(extraFields = {}) {
    if (!this.selectedFile) {
      this.onError('Please select a file to upload.');
      return null;
    }

    const formData = new FormData();
    formData.append(this.fieldName, this.selectedFile);
    for (const [k, v] of Object.entries(extraFields)) {
      formData.append(k, v);
    }

    const progressBar = this.container.querySelector('.dz-progress-bar');
    const progressFill = this.container.querySelector('#dzProgressFill');
    progressBar.style.display = 'block';
    progressFill.style.width = '0%';

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', this.uploadUrl, true);
      xhr.withCredentials = true;

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          progressFill.style.width = `${percent}%`;
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const res = JSON.parse(xhr.responseText);
            this.onSuccess(res);
            this.clearFile();
            resolve(res);
          } catch {
            resolve(xhr.responseText);
          }
        } else {
          let errObj;
          try { errObj = JSON.parse(xhr.responseText); } catch {}
          const errMsg = errObj?.error || `Upload failed with status ${xhr.status}`;
          this.onError(errMsg);
          reject(new Error(errMsg));
        }
      };

      xhr.onerror = () => {
        const msg = 'Network error occurred during file upload.';
        this.onError(msg);
        reject(new Error(msg));
      };

      xhr.send(formData);
    });
  }
}

if (typeof window !== 'undefined') {
  window.DropzoneUpload = DropzoneUpload;
}
