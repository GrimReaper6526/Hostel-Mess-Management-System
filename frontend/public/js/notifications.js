// UniHostel — Notification System

let notifInterval = null;

function setupNotifications() {
  fetchNotifications();
  if (notifInterval) clearInterval(notifInterval);
  // Poll every 10 seconds for new notifications if a user is logged in
  notifInterval = setInterval(() => {
    if (currentUser && currentRole === 'student') {
      fetchNotifications(true); // silent fetch
    }
  }, 10000);
}

async function fetchNotifications(silent = false) {
  if (!currentUser || currentRole !== 'student') {
    // If admin or logged out, show default mock notifications
    notifications = [
      { id: null, msg: 'Your booking application is under review.', time: '2 min ago', read: false },
      { id: null, msg: 'March room fee is due by the 15th.', time: '1 hour ago', read: false },
      { id: null, msg: 'Complaint #2 has been updated to In Progress.', time: 'Yesterday', read: true },
    ];
    renderNotifs();
    return;
  }

  try {
    const res = await fetch(`${API}/notifications/student/${currentUser.StudentID}`);
    if (!res.ok) throw new Error('Failed to fetch from backend');
    const dbNotifs = await res.json();
    
    const formatted = dbNotifs.map(n => ({
      id: n.NotificationID,
      msg: n.Message,
      time: formatTimeAgo(n.CreatedAt),
      read: n.IsRead,
      icon: '🔔'
    }));

    // Check if we have new unread notifications that were not in our local array
    const oldUnreadCount = notifications.filter(n => !n.read).length;
    const newUnreadCount = formatted.filter(n => !n.read).length;
    
    if (silent && newUnreadCount > oldUnreadCount) {
      toast('You have new notifications!', 'info');
      // If we are currently on the mess page, reload mess stats and history as well
      const messPage = document.getElementById('page-mess');
      if (messPage && messPage.classList.contains('active')) {
        loadMess();
      }
    }

    notifications = formatted;
    renderNotifs();
  } catch (e) {
    console.error('Error fetching persistent notifications:', e);
  }
}

function formatTimeAgo(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return date.toLocaleDateString();
}

async function addNotif(msg, icon) {
  notifications.unshift({ msg, time: 'Just now', read: false, icon });
  renderNotifs();
}

function renderNotifs() {
  const unreadCount = notifications.filter(n => !n.read).length;
  const notifDot = document.getElementById('notif-dot');
  const notifList = document.getElementById('notif-list');
  
  if (notifDot) notifDot.style.display = unreadCount ? 'block' : 'none';
  if (notifList) {
    notifList.innerHTML = notifications.slice(0, 10).map((n, i) => `
      <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markRead(${i})">
        ${!n.read ? '<div class="notif-dot-sm"></div>' : '<div style="width:8px"></div>'}
        <div style="font-size:16px; margin-right:8px;">${escapeHTML(n.icon || '🔔')}</div>
        <div><div class="notif-msg">${escapeHTML(n.msg)}</div><div class="notif-time">${escapeHTML(n.time)}</div></div>
      </div>`).join('');
  }
}

async function markRead(i) { 
  const notif = notifications[i];
  if (!notif) return;
  
  notif.read = true; 
  renderNotifs(); 

  if (notif.id) {
    try {
      await fetch(`${API}/notifications/${notif.id}/read`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (e) {
      console.error('Failed to mark notification read in database:', e);
    }
  }
}

async function clearNotifs() { 
  // Mark all unread as read in backend
  const unread = notifications.filter(n => !n.read);
  notifications.forEach(n => n.read = true); 
  renderNotifs(); 
  closeNotifPanel(); 

  for (const n of unread) {
    if (n.id) {
      try {
        await fetch(`${API}/notifications/${n.id}/read`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {}
    }
  }
}

function toggleNotif() { 
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.toggle('open'); 
}

function closeNotifPanel() { 
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.remove('open'); 
}

// Global click handler for notifications
document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  if (panel && !e.target.closest('#notif-panel') && !e.target.closest('.icon-btn')) {
    closeNotifPanel();
  }
});
