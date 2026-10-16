import './pages/manager-page.js';
import 'jodit/es2021/jodit.min.css';
import('./pages/manager-night-operations.js').catch(error => {
  console.error('Night Staffing failed to initialize:', error);
  const target = document.getElementById('nightStaffingStatus');
  if (target) target.textContent = 'Night Staffing unavailable. Reload the page or contact support.';
});
