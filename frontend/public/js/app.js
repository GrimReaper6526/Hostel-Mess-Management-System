// UniHostel — Main Application Shell & Navigation

let currentUser = null, currentRole = null, selectedRole = 'student';
let allComplaints = [], allFees = { roomFees: [], messFees: [] }, allStudents = [];
let notifications = [];

function initApp() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  setupSidebar(); 
  setupNotifications();
  const first = currentRole === 'admin' ? 'admin-dashboard' : 'dashboard';
  navigateTo(first);
}

function goHome() {
  const dash = currentRole === 'admin' ? 'admin-dashboard' : 'dashboard';
  navigateTo(dash);
}

function setupSidebar() {
  const name = currentUser.FullName;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  document.getElementById('sb-av').textContent = initials;
  document.getElementById('sb-name').textContent = name;
  document.getElementById('sb-role').textContent = currentRole === 'admin' ? `Portal Administrator` : `Student Resident`;
  
  const nav = document.getElementById('sidebar-nav');
  const studentNav = [
    { sec: 'Main' }, 
    { id: 'dashboard', icon: '✦', label: 'Command Center' },
    { sec: 'Residence' }, 
    { id: 'halls', icon: '🏛', label: 'Hostel Wings' }, 
    { id: 'booking', icon: '🛏', label: 'Room Placement' },
    { sec: 'Services' }, 
    { id: 'mess', icon: '🍽', label: 'Dining Hall' }, 
    { id: 'fees', icon: '💳', label: 'Financials' }, 
    { id: 'complaints', icon: '📣', label: 'Support Desk' },
    { sec: 'Account' }, 
    { id: 'profile', icon: '👤', label: 'My Profile' },
  ];
  const adminNav = [
    { sec: 'Main' }, 
    { id: 'admin-dashboard', icon: '✦', label: 'Control Panel' },
    { sec: 'Registry' }, 
    { id: 'admin-bookings', icon: '📋', label: 'Allocations' }, 
    { id: 'admin-students', icon: '🎓', label: 'Student Database' }, 
    { id: 'admin-fees', icon: '💳', label: 'Financial Audit' }, 
    { id: 'admin-complaints', icon: '📣', label: 'Resolutions Hub' },
    { id: 'admin-mess', icon: '📋', label: 'Mess Planner' },
    { sec: 'System' }, 
    { id: 'halls', icon: '🏛', label: 'Hostel Master' }, 
    { id: 'mess', icon: '🍽', label: 'Dining Master' },
    { sec: 'Settings' }, 
    { id: 'profile', icon: '👤', label: 'Admin Profile' },
  ];
  
  const items = currentRole === 'admin' ? adminNav : studentNav;
  if (nav) {
    nav.innerHTML = items.map(it => it.sec
      ? `<div class="nav-sec">${it.sec}</div>`
      : `<button class="nav-item" id="nav-${it.id}" onclick="navigateTo('${it.id}')">
          <span class="nav-icon">${it.icon}</span>
          <span class="nav-label">${it.label}</span>
         </button>`
    ).join('');
  }
}

async function navigateTo(id) {
  const container = document.getElementById('page-container');
  if (!container) return;

  // 1. Mark active nav
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const n = document.getElementById(`nav-${id}`);
  if (n) n.classList.add('active');

  // 2. Clear current pages (simple approach: only one active at a time)
  // Or just hide them if we want to preserve state
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // 3. Check if already loaded
  let p = document.getElementById(`page-${id}`);
  if (!p) {
    try {
      const resp = await fetch(`components/${id}.html`);
      if (!resp.ok) throw new Error('Component not found');
      const html = await resp.text();
      
      p = document.createElement('div');
      p.className = 'page';
      p.id = `page-${id}`;
      p.innerHTML = html;
      container.appendChild(p);
    } catch (e) {
      toast(`Error loading ${id} component`, 'error');
      return;
    }
  }

  // 4. Show page
  p.classList.add('active');
  const pageWrap = p.closest('.page-wrap');
  if (pageWrap) pageWrap.scrollTop = 0;

  // Clean and direct page transition for professional appearance
  p.style.opacity = '1';
  p.style.transform = 'none';
  p.style.filter = 'none';

  
  // 5. Update Topbar
  const titles = {
    'dashboard': 'Command Center', 'admin-dashboard': 'Control Panel', 'halls': 'Hostel Wings',
    'booking': 'Room Placement', 'mess': 'Dining Hall', 'fees': 'Financials', 'complaints': 'Support Desk',
    'profile': 'Account Settings', 'admin-bookings': 'Allocations', 'admin-complaints': 'Resolutions Hub', 'admin-students': 'Student Database',
    'admin-fees': 'Financial Audit', 'admin-mess': 'Mess Planner',
    'search-results': 'Institutional Search'
  };
  
  const titleEl = document.getElementById('topbar-title');
  if (titleEl) titleEl.textContent = titles[id] || id;
  
  // 6. Run page logic
  loadPage(id);
  closeNotifPanel();
}

function loadPage(id) {
  const loaders = {
    'dashboard': loadStudentDash, 'admin-dashboard': loadAdminDash,
    'halls': loadHalls, 'booking': loadBooking, 'mess': loadMess, 'fees': loadFees,
    'complaints': loadComplaints, 'profile': loadProfile,
    'admin-bookings': loadAdminBookings, 'admin-complaints': loadAdminComplaints, 'admin-students': loadAdminStudents,
    'admin-fees': loadAdminFees, 'admin-mess': loadAdminMessReport,
    'search-results': loadSearchResults
  };
  if (loaders[id]) loaders[id]();
}

let searchResults = null;
async function handleSearch(q) {
  if (!q || q.trim().length < 2) return;
  
  try {
    const uid = currentRole === 'student' ? currentUser.StudentID : null;
    const resp = await fetch(`${API}/search?q=${encodeURIComponent(q)}&role=${currentRole}&userId=${uid}`);
    
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Search failed');
    
    searchResults = data;
    if (searchResults) {
        navigateTo('search-results');
    }
  } catch (e) {
    toast('Search error: ' + e.message, 'error');
    console.error('Search error Details:', e);
  }
}

async function exportReport() {
  try {
    toast('Generating SQL report...', 'info');
    const res = await fetch(`${API}/admin/export`);
    if (!res.ok) throw new Error('Export failed');
    
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `hostel_report_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    toast('Report exported successfully!', 'success');
  } catch (e) {
    toast('Error exporting report: ' + e.message, 'error');
  }
}

// Fetch and load live statistics on landing page
async function loadLandingStats() {
  try {
    const res = await fetch(`${API}/public/stats`);
    if (!res.ok) throw new Error('Failed to fetch statistics');
    const stats = await res.json();

    const activeStudentsEl = document.getElementById('stat-active-students');
    const residencyRoomsEl = document.getElementById('stat-residency-rooms');
    const hostelHallsEl = document.getElementById('stat-hostel-halls');
    const satisfactionRateEl = document.getElementById('stat-satisfaction-rate');

    if (activeStudentsEl) activeStudentsEl.textContent = stats.ActiveStudents;
    if (residencyRoomsEl) residencyRoomsEl.textContent = stats.ResidencyRooms;
    if (hostelHallsEl) hostelHallsEl.textContent = stats.HostelHalls.toString().padStart(2, '0');
    if (satisfactionRateEl) satisfactionRateEl.textContent = `${Math.round(stats.SatisfactionRate)}%`;
  } catch (e) {
    console.error('Error loading landing page stats:', e);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadLandingStats);
} else {
  loadLandingStats();
}

