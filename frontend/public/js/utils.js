// UniHostel — UI Utilities

// Global Fetch Interceptor to automatically attach JWT Bearer Token
const originalFetch = window.fetch;
window.fetch = async function (resource, options = {}) {
  // If the resource is our API, automatically append authorization header
  const urlString = typeof resource === 'string' ? resource : (resource && resource.url) || '';
  if (urlString.includes('/api/')) {
    options.headers = options.headers || {};
    const token = localStorage.getItem('jwt_token');
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }
  }
  return originalFetch(resource, options);
};

// Global XSS Mitigation Helper
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

let toastTimer;
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' };
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = `<span>${icons[type] || '•'}</span>${escapeHTML(msg)}`;
  t.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 3000);
}

function openModal(title, body) {
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const overlay = document.getElementById('overlay');
  
  if (modalTitle) modalTitle.textContent = title;
  if (modalBody) modalBody.innerHTML = body;
  if (overlay) overlay.classList.add('open');
}

function closeModal(e) {
  const overlay = document.getElementById('overlay');
  if (!e || e.target === overlay) {
    if (overlay) overlay.classList.remove('open');
  }
}

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function infoCell(l, v) { 
  return `<div style="padding:10px;background:var(--slate-50);border-radius:8px;border:1px solid var(--slate-100)">
    <div style="font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:var(--slate-400);margin-bottom:3px">${l}</div>
    <div style="font-size:13px;font-weight:700">${v}</div>
  </div>`; 
}

function toggleTheme() {
  // removed
}

function initTheme() {
  document.documentElement.setAttribute('data-theme', 'light');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTheme);
} else {
  initTheme();
}
