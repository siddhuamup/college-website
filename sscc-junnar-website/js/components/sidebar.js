/**
 * SSCC Component: Sidebar Navigation & Mobile Drawer Controller
 */
export class SidebarController {
  static init() {
    if (typeof document === 'undefined') return;
    const toggleBtn = document.getElementById('sidebar-toggle');
    const dashboard = document.querySelector('.dashboard');
    
    if (!toggleBtn || !dashboard) return;

    toggleBtn.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        dashboard.classList.toggle('dashboard--sidebar-open');
      } else {
        dashboard.classList.toggle('dashboard--collapsed');
      }
    });
  }
}
