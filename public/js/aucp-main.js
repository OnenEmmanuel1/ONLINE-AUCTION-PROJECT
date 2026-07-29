/**
 * BidSecure — Main Client JavaScript (aucp-main.js)
 */

document.addEventListener('DOMContentLoaded', () => {
  console.log('[BidSecure] System UI Initialized');

  // Flash Alert Dismissal
  const alerts = document.querySelectorAll('.aucp-alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.5s ease';
      setTimeout(() => alert.remove(), 500);
    }, 6000);
  });
});
