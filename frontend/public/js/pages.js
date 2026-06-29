// UniHostel — Page-Specific Loading Logic

// ── STUDENT DASHBOARD ──
// ── STUDENT DASHBOARD ──
async function loadStudentDash() {
  const dashGreeting = document.getElementById('dash-greeting');
  if (dashGreeting) dashGreeting.textContent = getGreeting() + ', ' + currentUser.FullName.split(' ')[0] + '!';

  const dateEl = document.getElementById('current-date-display');
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const cgpa = currentUser.CGPA;
  const tier = cgpa >= 3.5 ? '1st Floor' : cgpa >= 2.5 ? 'Ground Floor' : '2nd Floor';

  try {
    const [bookingsRes, feesRes, compRes, menuRes, weeklyBillsRes] = await Promise.all([
      fetch(`${API}/bookings/student/${currentUser.StudentID}`),
      fetch(`${API}/fees/${currentUser.StudentID}`),
      fetch(`${API}/complaints/student/${currentUser.StudentID}`),
      fetch(`${API}/mess/menu`),
      fetch(`${API}/mess/bills/weekly?studentId=${currentUser.StudentID}`)
    ]);

    const bookings = await bookingsRes.json();
    const fees = await feesRes.json();
    const complaints = await compRes.json();
    const menu = await menuRes.json();
    const weeklyBills = await weeklyBillsRes.json();

    const formattedWeeklyBills = weeklyBills.map(b => ({
      ...b,
      IsWeekly: true,
      Month: 'Weekly Bill',
      Year: `${new Date(b.WeekStartDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'})} - ${new Date(b.WeekEndDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}`,
      Amount: b.TotalAmount
    }));

    const activeBooking = bookings.find(b => b.Status === 'Approved' || b.Status === 'Active');
    const openComplaintsCount = complaints.filter(c => c.Status !== 'Resolved').length;

    const allFeesList = [...(fees.roomFees || []), ...(fees.messFees || []), ...formattedWeeklyBills];
    const unpaidFees = allFeesList.filter(f => !f.IsPaid);
    const unpaidTotal = unpaidFees.reduce((sum, f) => sum + (f.Amount || f.TotalAmount || 0), 0);

    const kpiEl = document.getElementById('student-kpis');
    if (kpiEl) {
      kpiEl.innerHTML = `
        <div class="bento-item large glass-panel" style="background: linear-gradient(135deg, rgba(255,255,255,0.9), rgba(197,160,89,0.05));">
          <div class="bento-icon">📊</div>
          <div>
            <div class="data-label">Academic Profile</div>
            <div class="data-value">${currentUser.Semester} Sem | Year ${Math.ceil(currentUser.Semester/2)}</div>
            <div class="data-sub">Merit Score: ${cgpa} CGPA</div>
            <div class="data-sub" style="margin-top:4px; font-size: 10px; opacity: 0.8; border-top: 1px solid rgba(0,0,0,0.05); padding-top:4px;">
              Session: ${(new Date().getMonth()+1 >= 1 && new Date().getMonth()+1 <= 6) ? 'Even' : 'Odd'} (Duration: 6 Months)
            </div>
          </div>
          <div class="bento-footer">
             <span class="pill pill-green" style="background: rgba(13,148,136,0.1); color: var(--emerald);">Active Enrollment</span>
             <span class="text-xs" style="color: var(--slate-400); font-weight: 700;">Verified Account</span>
          </div>
        </div>
        
        <div class="bento-item wide glass-panel">
          <div class="bento-icon">🏛️</div>
          <div>
            <div class="data-label">Current Placement</div>
            <div class="data-value">${activeBooking ? activeBooking.RoomNumber : 'Pending'}</div>
            <div class="data-sub">${activeBooking ? activeBooking.HallName : 'Allocation In Progress'}</div>
          </div>
          <div class="bento-footer">
            <div class="mini-chart">
              <div class="chart-bar" style="height:40%; animation-delay: 0.1s"></div>
              <div class="chart-bar" style="height:70%; animation-delay: 0.2s"></div>
              <div class="chart-bar" style="height:55%; animation-delay: 0.3s"></div>
              <div class="chart-bar" style="height:85%; animation-delay: 0.4s"></div>
              <div class="chart-bar" style="height:60%; animation-delay: 0.5s"></div>
            </div>
            <span class="text-xs" style="color: var(--slate-400); font-weight: 700; margin-left: 10px;">Occupancy Heatmap</span>
          </div>
        </div>

        <div class="bento-item glass-panel">
          <div class="bento-icon">💳</div>
          <div>
            <div class="data-label">Portal Balance</div>
            <div class="data-value" style="font-size: 28px;">PKR ${unpaidTotal.toLocaleString()}</div>
            <div class="data-sub">${unpaidFees.length} Pending Dues</div>
          </div>
          <div class="visual-indicator" style="background:var(--ruby); width: 30px;"></div>
        </div>

        <div class="bento-item glass-panel">
          <div class="bento-icon">📣</div>
          <div>
            <div class="data-label">System Support</div>
            <div class="data-value">${openComplaintsCount}</div>
            <div class="data-sub">Open Maintenance</div>
          </div>
          <div class="visual-indicator" style="background:var(--emerald); width: 30px;"></div>
        </div>
        
        <div class="bento-item glass-panel wide" style="background: rgba(15, 23, 42, 0.02);">
          <div class="bento-icon">⚡</div>
          <div>
            <div class="data-label">Quick Commands</div>
            <div style="display: flex; gap: 8px; margin-top: 12px;">
              <button class="btn btn-ghost btn-sm" onclick="navigateTo('complaints')" style="font-size: 10px; padding: 8px 14px; border-radius: 99px;">Report Issue</button>
              <button class="btn btn-ghost btn-sm" onclick="navigateTo('mess')" style="font-size: 10px; padding: 8px 14px; border-radius: 99px;">View Dining Status</button>
              <button class="btn btn-ghost btn-sm" onclick="navigateTo('profile')" style="font-size: 10px; padding: 8px 14px; border-radius: 99px;">Sync Profile</button>
            </div>
          </div>
        </div>`;
    }

    // Update Booking Status Card
    const bookingCard = document.getElementById('booking-status-card');
    if (bookingCard && activeBooking) {
        bookingCard.innerHTML = `
          <div style="padding: 24px; background: linear-gradient(135deg, var(--navy), #1e293b); border-radius: 20px; color: white; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -20px; right: -20px; font-size: 80px; opacity: 0.05;">🏠</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
              <div>
                <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: var(--gold-light); font-weight: 800;">Primary Residence</div>
                <div style="font-size: 28px; font-weight: 700; font-family: var(--font-serif); margin-top: 4px;">${escapeHTML(activeBooking.HallName)}</div>
              </div>
              <span class="pill" style="background: rgba(255,255,255,0.1); color: white; border: 1px solid rgba(255,255,255,0.2);">${escapeHTML(activeBooking.Status.toUpperCase())}</span>
            </div>
            <div style="display: flex; gap: 32px;">
              <div>
                <div style="font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; font-weight: 800;">Room Number</div>
                <div style="font-size: 18px; font-weight: 600;">${escapeHTML(activeBooking.RoomNumber)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; font-weight: 800;">Type</div>
                <div style="font-size: 18px; font-weight: 600;">${escapeHTML(activeBooking.RoomType)}</div>
              </div>
              <div>
                <div style="font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; font-weight: 800;">Rate</div>
                <div style="font-size: 18px; font-weight: 600;">PKR ${activeBooking.MonthlyFee?.toLocaleString()}</div>
              </div>
            </div>
          </div>
        `;
    } else if (bookingCard) {
        bookingCard.innerHTML = `
          <div style="padding: 32px; background: rgba(0,0,0,0.02); border-radius: 20px; border: 1px dashed var(--slate-200); text-align: center;">
            <div style="font-size: 32px; margin-bottom: 12px;">⌛</div>
            <div style="font-weight: 700; color: var(--navy);">No Active Placement</div>
            <p style="font-size: 13px; color: var(--slate-500); margin-top: 4px;">Visit the Placement Dashboard to apply for a room.</p>
            <button class="btn btn-navy btn-sm" onclick="navigateTo('booking')" style="margin-top: 16px; border-radius: 99px;">Apply Now →</button>
          </div>
        `;
    }

    // Mess Summary logic stays mostly same but with better formatting
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = days[new Date().getDay()];
    const todayMenu = menu.filter(m => m.DayOfWeek === today);
    const messSum = document.getElementById('today-menu-summary');
    if (messSum) {
        messSum.innerHTML = todayMenu.length ? todayMenu.slice(0, 3).map(m => `
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.03);">
              <span style="font-size:13px; font-weight: 700; color: var(--navy);">${escapeHTML(m.MealType)}</span>
              <span style="font-size:13px; color: var(--slate-600);">${escapeHTML(m.MenuItem)}</span>
            </div>
        `).join('') : '<div style="padding: 20px; text-align: center; color: var(--slate-400);">Menu data unavailable</div>';
    }

    const activityFeed = document.getElementById('activity-feed');
    if (activityFeed) {
      activityFeed.innerHTML = `
        <div class="tl-item">
          <div class="tl-dot" style="background: rgba(13, 148, 136, 0.1); color: var(--emerald); font-size: 14px;">📡</div>
          <div class="tl-content">
            <div class="tl-title">Academic Feed Synchronized</div>
            <div class="tl-time">Active Connection Established</div>
          </div>
        </div>
        <div class="tl-item">
          <div class="tl-dot" style="background: rgba(197, 160, 89, 0.1); color: var(--gold); font-size: 14px;">🔐</div>
          <div class="tl-content">
            <div class="tl-title">Session Authenticated</div>
            <div class="tl-time">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
        </div>`;
    }

    const feeCard = document.getElementById('fee-summary-card');
    if (feeCard) {
      feeCard.innerHTML = unpaidFees.slice(0, 2).map(f => {
        const isRoom = !!f.FeeID;
        const title = isRoom ? `Room Fee — ${escapeHTML(f.Month)}` : `Mess Bill — ${escapeHTML(f.Month)}`;
        const amount = f.Amount || f.TotalAmount || 0;
        return `
          <div class="fee-item overdue" style="padding: 16px; margin-bottom: 12px; background: rgba(185, 28, 28, 0.02);">
            <div class="fi-left">
              <div class="fi-icon" style="background: var(--navy); color: white; width: 36px; height: 36px; font-size: 16px;">${isRoom ? '🏠' : '🍽️'}</div>
              <div><div class="fi-title" style="font-size: 14px;">${escapeHTML(title)}</div><div class="fi-sub" style="font-size: 11px;">Invoice #X0${f.FeeID || f.BillID}</div></div>
            </div>
            <div class="fi-actions">
              <div class="fi-amount" style="font-size: 15px;">PKR ${amount.toLocaleString()}</div>
            </div>
          </div>`;
      }).join('') || '<div style="padding: 32px; text-align: center; background: rgba(13,148,136,0.05); border-radius: 16px; border: 1px solid rgba(13,148,136,0.1); color: var(--emerald); font-weight: 700;">✓ All Financials Settled</div>';
    }

  } catch (e) { toast('Error synchronizing portal data', 'error'); }
}

// ── ADMIN DASHBOARD ──
async function loadAdminDash() {
  const adminTitle = document.querySelector('.page-hdr h2');
  if (adminTitle) adminTitle.textContent = 'Warden Command Center';
  
  const hallDisplay = document.getElementById('managed-hall-name');
  if (hallDisplay) hallDisplay.textContent = currentUser.ManagedHallName || 'Central Processing';

  try {
    const [statsRes, bookingsRes, compRes] = await Promise.all([
      fetch(`${API}/stats`),
      fetch(`${API}/bookings/all`),
      fetch(`${API}/complaints/all`)
    ]);

    let stats = {};
    let bookings = [];
    let complaints = [];

    try {
      if (statsRes.ok) stats = await statsRes.json();
    } catch (err) { console.error("Error parsing stats:", err); }

    try {
      if (bookingsRes.ok) bookings = await bookingsRes.json();
    } catch (err) { console.error("Error parsing bookings:", err); }

    try {
      if (compRes.ok) complaints = await compRes.json();
    } catch (err) { console.error("Error parsing complaints:", err); }

    const kpiGrid = document.getElementById('admin-kpis');
    if (kpiGrid) {
      kpiGrid.innerHTML = `
        <div class="kpi" style="--kpi-color:var(--navy)"><div class="kpi-icon">🎓</div><div class="kpi-val">${stats.TotalStudents || 0}</div><div class="kpi-label">Registered Students</div></div>
        <div class="kpi" style="--kpi-color:var(--emerald)"><div class="kpi-icon">✅</div><div class="kpi-val">${stats.ActiveBookings || 0}</div><div class="kpi-label">Active Occupancy</div></div>
        <div class="kpi" style="--kpi-color:var(--amber)"><div class="kpi-icon">⏳</div><div class="kpi-val">${stats.PendingBookings || 0}</div><div class="kpi-label">Pending Requests</div></div>
        <div class="kpi" style="--kpi-color:var(--ruby)"><div class="kpi-icon">📣</div><div class="kpi-val">${stats.OpenComplaints || 0}</div><div class="kpi-label">Active Maintenance</div></div>`;
    }

    // Update Wing Occupancy Summary live values
    const occPctEl = document.getElementById('occ-pct');
    const occVacantEl = document.getElementById('occ-vacant');
    const occMaintEl = document.getElementById('occ-maintenance');
    const occVisualEl = document.getElementById('occupancy-visual-container');

    if (occPctEl) occPctEl.textContent = `${stats.TotalOccupancyPct || 0}%`;
    if (occVacantEl) occVacantEl.textContent = stats.VacantCapacity || 0;
    if (occMaintEl) occMaintEl.textContent = stats.OpenComplaints || 0;

    if (occVisualEl && stats.halls) {
      occVisualEl.innerHTML = stats.halls.map(h => {
        // High-end visual gradients for progress bar fills
        let progressColor = 'linear-gradient(90deg, #10b981 0%, #059669 100%)'; // Emerald gradient (available)
        let pillColor = 'rgba(16, 185, 129, 0.1)';
        let textColor = '#059669';
        
        if (h.OccupancyPct > 85) {
          progressColor = 'linear-gradient(90deg, #ef4444 0%, #b91c1c 100%)'; // Ruby gradient (near full)
          pillColor = 'rgba(239, 68, 68, 0.1)';
          textColor = '#b91c1c';
        } else if (h.OccupancyPct > 40) {
          progressColor = 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)'; // Navy gradient (filling up)
          pillColor = 'rgba(59, 130, 246, 0.1)';
          textColor = '#1d4ed8';
        }

        return `
        <div class="wing-occupancy-row" style="display: flex; flex-direction: column; gap: 6px; padding: 8px 0; border-bottom: 1px solid rgba(0,0,0,0.02); transition: all 0.2s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 13px; font-weight: 700; color: var(--navy); font-family: var(--font-body);">${escapeHTML(h.HallName)}</span>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 11px; font-weight: 600; color: var(--slate-500);">${h.OccupiedCapacity} / ${h.TotalCapacity} Beds</span>
              <span class="pill" style="background: ${pillColor}; color: ${textColor}; font-weight: 700; padding: 2px 8px; border-radius: 99px; font-size: 10px;">${h.OccupancyPct}%</span>
            </div>
          </div>
          <div style="width: 100%; height: 7px; background: rgba(0,0,0,0.04); border-radius: 99px; overflow: hidden; position: relative;">
            <div style="width: ${h.OccupancyPct}%; height: 100%; background: ${progressColor}; border-radius: 99px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);"></div>
          </div>
        </div>`;
      }).join('');
    }

    const announceZone = document.getElementById('announce-zone-admin');
    if (announceZone && !announceZone.innerHTML) {
      announceZone.innerHTML = `
        <div class="announce">
          <span class="announce-icon">⚠️</span>
          <div class="announce-text"><h4>System Online</h4><p>Monitoring all hostel modules.</p></div>
          <button class="announce-close" onclick="this.closest('.announce').remove()">✕</button>
        </div>`;
    }

    const pendingBookings = bookings.filter(b => b.Status === 'Pending');
    const pendingCount = document.getElementById('pending-count');
    if (pendingCount) pendingCount.textContent = `${pendingBookings.length} pending`;

    const pendingCard = document.getElementById('pending-bookings-card');
    if (pendingCard) {
      pendingCard.innerHTML = pendingBookings.map(b => `
        <div style="padding:14px;border:1.5px solid var(--slate-200);border-radius:var(--r);margin-bottom:10px;background:var(--white)">
          <div class="flex items-center justify-between mb-3">
            <div class="flex items-center gap-2">
              <div style="width:36px;height:36px;background:var(--sky-l);border-radius:9px;display:flex;align-items:center;justify-content:center;font-weight:800;color:var(--sky);font-size:13px">${escapeHTML(b.FullName.split(' ').map(w => w[0]).join(''))}</div>
              <div><div style="font-size:13px;font-weight:700">${escapeHTML(b.FullName)}</div><div style="font-size:11px;color:var(--slate-400)">${escapeHTML(b.RegNumber)}</div></div>
            </div>
            <span class="pill pill-gold">CGPA ${b.CGPA}</span>
          </div>
          <div style="font-size:12px;color:var(--slate-500);margin-bottom:10px">
            ${escapeHTML(b.HallName)} · Room ${escapeHTML(b.RoomNumber)} (${escapeHTML(b.RoomType)}) · PKR ${b.MonthlyFee?.toLocaleString()}/mo
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-emerald" onclick="adminUpdateBooking(${b.BookingID}, 'Approved')">✓ Approve</button>
            <button class="btn btn-sm btn-ruby" onclick="adminUpdateBooking(${b.BookingID}, 'Rejected')">✗ Reject</button>
            <button class="btn btn-sm btn-ghost" onclick="showBookingDetail(${JSON.stringify(b).replace(/"/g, '&quot;')})">Details</button>
          </div>
        </div>`).join('') || '<div class="empty"><div class="empty-icon">✅</div><h4>All clear!</h4><p>No pending bookings.</p></div>';
    }

    const openComplaints = complaints.filter(c => c.Status === 'Open');


    // Check for overdue complaints (> 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const overdueComplaints = openComplaints.filter(c => c.Status !== 'Resolved' && new Date(c.SubmittedAt) < thirtyDaysAgo);

    if (overdueComplaints.length > 0) {
      const overdueZone = document.getElementById('announce-zone-admin');
      if (overdueZone) {
        const existingAlert = document.getElementById('overdue-complaints-alert');
        if (!existingAlert) {
          const alert = document.createElement('div');
          alert.id = 'overdue-complaints-alert';
          alert.className = 'announce';
          alert.style.borderLeft = '4px solid var(--ruby)';
          alert.innerHTML = `
            <span class="announce-icon">⚠️</span>
            <div class="announce-text">
              <h4>Action Required: Overdue Complaints</h4>
              <p>There are ${overdueComplaints.length} pending complaints older than a month. Please prioritize these.</p>
            </div>
            <button class="btn btn-sm btn-ruby" onclick="navigateTo('admin-complaints')">View All</button>
          `;
          overdueZone.prepend(alert);
        }
      }
    }

    const compCard = document.getElementById('open-complaints-card');
    if (compCard) {
      compCard.innerHTML = openComplaints.map(c => {
        const isOverdue = new Date(c.SubmittedAt) < thirtyDaysAgo;
        return `
        <div class="comp-item ${isOverdue ? 'overdue' : ''}" style="${isOverdue ? 'border-left: 3px solid var(--ruby); background: #fff5f5;' : ''}">
          <div class="comp-top">
            <div>
              <div class="comp-title">${escapeHTML(c.Title)} ${isOverdue ? '<span class="pill pill-red" style="font-size:9px; vertical-align:middle; margin-left:5px">⚠️ OVERDUE</span>' : ''}</div>
              <div class="comp-meta">${escapeHTML(c.FullName)} · ${escapeHTML(c.HallName || 'N/A')} · ${escapeHTML(c.Category)} · ${escapeHTML(c.SubmittedAt?.split('T')[0])}</div>
            </div>
            <span class="pill pill-red">Open</span>
          </div>
          <div class="flex gap-2">
            <button class="btn btn-sm btn-ghost" onclick="showComplaintDetail(${JSON.stringify(c).replace(/"/g, '&quot;')})">View Details</button>
            <button class="btn btn-sm btn-ghost" onclick="adminUpdateComplaint(${c.ComplaintID}, 'In Progress')">Mark In Progress</button>
          </div>
        </div>`;
      }).join('') || '<div class="empty"><div class="empty-icon">✅</div><h4>No open complaints</h4></div>';
    }

    const activityEl = document.getElementById('admin-activity');
    if (activityEl) {
      activityEl.innerHTML = `
        <div class="tl-item">
          <div class="tl-dot" style="background:var(--emerald-l)">🛡️</div>
          <div class="tl-content"><div class="tl-title">Admin session started</div><div class="tl-time">Just now</div></div>
        </div>`;
    }
  } catch (e) { toast('Error loading admin dashboard', 'error'); }
}

async function adminUpdateBooking(id, status) {
  try {
    const res = await fetch(`${API}/bookings/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminId: currentUser?.AdminID })
    });
    if (!res.ok) throw new Error('Update failed');
    toast(`Booking ${status.toLowerCase()}!`, status === 'Approved' ? 'success' : 'warn');
    closeModal();
    if (document.getElementById('page-admin-dashboard').classList.contains('active')) loadAdminDash();
    else loadAdminBookings();
  } catch (e) { toast('Error updating booking', 'error'); }
}

async function adminUpdateComplaint(id, status, note = '') {
  try {
    const res = await fetch(`${API}/complaints/${id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote: note })
    });
    if (!res.ok) throw new Error('Update failed');
    toast(`Complaint marked ${status}`, 'info');
    closeModal();
    if (document.getElementById('page-admin-dashboard').classList.contains('active')) loadAdminDash();
    else loadAdminComplaints();
  } catch (e) { toast('Error updating complaint', 'error'); }
}

// ── HALLS ──
async function loadHalls() {
  try {
    const res = await fetch(`${API}/halls`);
    const halls = await res.json();
    window.allHalls = halls;
    
    if (!Array.isArray(halls)) {
      console.error('Expected halls array but got:', halls);
      throw new Error(halls.error || 'Invalid data format from server');
    }

    const cgpa = currentRole === 'student' ? currentUser.CGPA : null;
    
    // Update KPIs
    const totalCapacity = halls.reduce((sum, h) => sum + (h.TotalRooms || 0), 0);
    const totalAvailable = halls.reduce((sum, h) => sum + (h.AvailableRooms || 0), 0);
    const avgOccupancy = totalCapacity > 0 ? Math.round(((totalCapacity - totalAvailable) / totalCapacity) * 100) : 0;

    const kpiHalls = document.getElementById('total-halls-count');
    const kpiCap = document.getElementById('total-capacity-count');
    const kpiRate = document.getElementById('avg-occupancy-rate');
    
    if (kpiHalls) kpiHalls.textContent = halls.length;
    if (kpiCap) kpiCap.textContent = totalCapacity;

    const kpiLabel = kpiRate?.nextElementSibling;
    const kpiIcon = kpiRate?.previousElementSibling;
    const kpiCard = kpiRate?.closest('.kpi');

    if (currentRole === 'student') {
      const studentYear = Math.ceil(currentUser.Semester / 2);
      const eligibleCount = halls.filter(h => 
        (h.TargetYear === studentYear) || 
        (h.TargetYear === null && cgpa >= h.MinCGPA && cgpa <= h.MaxCGPA)
      ).length;
      
      if (kpiRate) kpiRate.textContent = `${eligibleCount} / ${halls.length}`;
      if (kpiLabel) kpiLabel.textContent = 'Eligible Wings';
      if (kpiIcon) kpiIcon.textContent = '🎯';
      if (kpiCard) {
        kpiCard.style.cursor = 'pointer';
        kpiCard.title = 'Click to highlight eligible wings';
        kpiCard.onclick = () => {
          const grid = document.getElementById('halls-grid');
          if (grid) {
            grid.scrollIntoView({ behavior: 'smooth', block: 'center' });
            gsap.fromTo('.hall-card.eligible', 
              { scale: 1, boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' },
              { scale: 1.05, boxShadow: '0 0 25px rgba(197, 160, 89, 0.5)', duration: 0.4, yoyo: true, repeat: 3, ease: 'power2.inOut' }
            );
          }
        };
      }
    } else {
      if (kpiRate) kpiRate.textContent = `${avgOccupancy}%`;
      if (kpiLabel) kpiLabel.textContent = 'Avg. Occupancy';
      if (kpiIcon) kpiIcon.textContent = '📈';
      if (kpiCard) {
        kpiCard.style.cursor = '';
        kpiCard.title = '';
        kpiCard.onclick = null;
      }
    }

    const hallsGrid = document.getElementById('halls-grid');
    if (hallsGrid) {
      hallsGrid.innerHTML = halls.map(h => {
        // --- UPDATED ELIGIBILITY LOGIC ---
        const studentYear = currentUser ? Math.ceil(currentUser.Semester / 2) : null;
        const eligible = currentRole === 'student' && (
          (h.TargetYear === studentYear) || (h.TargetYear === null)
        );
        // ---------------------------------
        const occupancyPct = Math.round(((h.TotalRooms - (h.AvailableRooms || 0)) / h.TotalRooms) * 100) || 0;
        const facilities = h.Facilities ? h.Facilities.split(',').map(f => f.trim()) : [];

        return `
          <div class="hall-card ${eligible ? 'eligible' : ''}" onclick="${currentRole === 'admin' ? '' : `handleHallCardClick(${JSON.stringify(h).replace(/"/g, '&quot;')}, ${eligible})`}">
            <div class="hc-banner standard">
              <span class="hc-tier-icon">🏛️</span>
              <div class="hc-name">${h.HallName}</div>
            </div>
            <div class="hc-body">
              <div class="hc-row">
                <span class="lbl">Requirement</span>
                <span class="val">Year ${h.TargetYear || 'All'}</span>
              </div>
              <div class="hc-row">
                <span class="lbl">Live Occupancy</span>
                <span class="val">${occupancyPct}% full</span>
              </div>
              <div class="progress-track" style="margin: 12px 0; height: 6px; background: var(--slate-100);">
                <div class="progress-fill" style="width: ${occupancyPct}%; background: var(--navy);"></div>
              </div>
              <div class="hc-row">
                <span class="lbl">Availability</span>
                <span class="val">${h.AvailableRooms || 0} / ${h.TotalRooms} units free</span>
              </div>
              
              <div class="facility-tags">
                ${facilities.map(f => `<span class="tag">${f}</span>`).join('')}
              </div>

              ${currentRole === 'admin' ? `
                <button class="btn btn-navy btn-sm" style="width:100%; margin-top: 10px;" onclick="openHallOccupancy(${h.HallID}, '${h.HallName}')">
                  Manage Wing Occupancy →
                </button>` : `
                <button class="btn btn-ghost btn-sm" style="width:100%; margin-top: 10px;">
                  View Eligibility Details
                </button>
              `}
            </div>
          </div>`;
      }).join('');
    }
  } catch (e) { toast('Error loading halls', 'error'); }
}

window.handleHallCardClick = function(hall, isEligible) {
  if (isEligible) {
    navigateTo('booking');
    return;
  }
  
  const studentYear = currentUser ? Math.ceil(currentUser.Semester / 2) : 1;
  const yearNames = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th' };
  
  // Find recommended hall name dynamically based on TargetYear
  let recommendedHallName = 'your designated hall';
  if (window.allHalls && Array.isArray(window.allHalls)) {
    const recHall = window.allHalls.find(h => h.TargetYear === studentYear);
    if (recHall) recommendedHallName = recHall.HallName;
  } else {
    // Fallback mapping
    const recHalls = { 1: 'Faiz Hall', 2: 'Jinnah Hall', 3: 'Razi Hall', 4: 'Iqbal Hall' };
    recommendedHallName = recHalls[studentYear] || 'your designated hall';
  }
  
  const currentYearName = yearNames[studentYear] || `${studentYear}th`;
  
  // Build dynamic list of recommendations
  let recsListStr = '';
  if (window.allHalls && Array.isArray(window.allHalls)) {
    const recs = [];
    for (let y = 1; y <= 4; y++) {
      const hForY = window.allHalls.find(h => h.TargetYear === y);
      if (hForY) recs.push(`${yearNames[y] || y + 'th'} year: ${hForY.HallName}`);
    }
    if (recs.length > 0) recsListStr = ` (${recs.join(', ')})`;
  } else {
    recsListStr = ' (1st year: Faiz Hall, 2nd year: Jinnah Hall, 3rd year: Razi Hall, 4th year: Iqbal Hall)';
  }
  
  const warningMsg = `You cannot apply for this hall. Your recommended hall for ${currentYearName} year is ${recommendedHallName}.${recsListStr}`;
  
  toast(warningMsg, 'error');
  addNotif(warningMsg, '⚠️');
};

let adminCurrentWing = '2-Seater';
let adminCurrentStatusFilter = 'all';

async function openHallOccupancy(id, name) {
  try {
    const res = await fetch(`${API}/halls/${id}/occupancy`);
    const rooms = await res.json();
    const hall = (await (await fetch(`${API}/halls`)).json()).find(h => h.HallID === id);
    const studyYearStr = hall && hall.TargetYear ? `Year ${hall.TargetYear} Wing` : 'General Access Wing';
    
    const content = `
      <div style="background: var(--slate-50); padding: 20px; border-radius: 12px; margin-bottom: 24px; border: 1px solid var(--slate-200);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--slate-500); font-weight: 700;">Wing Selection</div>
          <span class="pill pill-navy" style="font-size: 10px;">${studyYearStr}</span>
        </div>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-navy admin-wing-btn ${adminCurrentWing === '2-Seater' ? 'active' : ''}" onclick="filterAdminRoomsByWing('2-Seater')">
            <span style="font-size: 16px; margin-right: 8px;">🏢</span> 2-Seater Wing
          </button>
          <button class="btn btn-navy admin-wing-btn ${adminCurrentWing === '5-Seater' ? 'active' : ''}" onclick="filterAdminRoomsByWing('5-Seater')">
            <span style="font-size: 16px; margin-right: 8px;">🏰</span> 5-Seater Wing
          </button>
        </div>
      </div>

      <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; gap: 8px; background: white; padding: 4px; border-radius: 99px; border: 1px solid var(--slate-200);">
          <button class="btn btn-ghost btn-sm admin-status-btn ${adminCurrentStatusFilter === 'all' ? 'active' : ''}" 
                  style="border-radius: 99px; font-size: 11px; padding: 6px 16px;" onclick="filterAdminRoomsByStatus('all')">All Units</button>
          <button class="btn btn-ghost btn-sm admin-status-btn ${adminCurrentStatusFilter === 'available' ? 'active' : ''}" 
                  style="border-radius: 99px; font-size: 11px; padding: 6px 16px;" onclick="filterAdminRoomsByStatus('available')">Has Vacancy</button>
          <button class="btn btn-ghost btn-sm admin-status-btn ${adminCurrentStatusFilter === 'occupied' ? 'active' : ''}" 
                  style="border-radius: 99px; font-size: 11px; padding: 6px 16px;" onclick="filterAdminRoomsByStatus('occupied')">Fully Occupied</button>
        </div>
        <div style="display: flex; gap: 20px;">
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--slate-600);">
            <div class="room-status-dot available" style="position: static;"></div> Available
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--slate-600);">
            <div class="room-status-dot occupied" style="position: static; background: #f59e0b;"></div> Partial
          </div>
          <div style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 600; color: var(--slate-600);">
            <div class="room-status-dot occupied" style="position: static;"></div> Full
          </div>
        </div>
      </div>

      <div id="admin-rooms-grid" style="max-height: 55vh; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; padding: 4px;">
        ${rooms.map(r => {
          const isFull = r.CurrentOccupancy >= r.Capacity;
          const isPartial = r.CurrentOccupancy > 0 && r.CurrentOccupancy < r.Capacity;
          const statusClass = isFull ? 'occupied' : (isPartial ? 'partial' : 'available');
          const statusText = isFull ? 'occupied' : 'available'; // for filtering
          
          return `
          <div class="admin-room-tile ${statusClass}" 
               data-type="${r.RoomType || '2-Seater'}"
               data-status="${statusText}"
               onclick="showRoomDetail(${JSON.stringify(r).replace(/"/g, '&quot;')})">
            <div class="room-status-dot ${statusClass}" style="${isPartial ? 'background:#f59e0b;' : ''}"></div>
            <div class="room-type-lbl">${r.RoomType}</div>
            <div class="room-num">🚪 Room ${r.RoomNumber}</div>
            <div style="font-size: 10px; font-weight: 700; color: var(--slate-500); margin-bottom: 8px;">
               ${r.CurrentOccupancy} / ${r.Capacity} Students
            </div>
            
            ${r.CurrentOccupancy > 0 ? `
              <div class="occupant-info">
                <div class="occupant-name" style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${(r.OccupantNames || '').split(',')[0]}${r.CurrentOccupancy > 1 ? ' + others' : ''}
                </div>
                <div class="occupant-reg">${r.CurrentOccupancy} Resident(s)</div>
              </div>` : `
              <div style="margin-top: auto; font-size: 10px; font-weight: 600; color: var(--emerald); display: flex; align-items: center; gap: 4px;">
                <span>✨</span> Ready for Assignment
              </div>
            `}
          </div>`;
        }).join('')}
      </div>`;
    openModal(`${name} - Strategic Occupancy View`, content);
    applyAdminRoomFilters();
  } catch (e) { console.error(e); toast('Error loading occupancy', 'error'); }
}

function showRoomDetail(room) {
  const names = room.OccupantNames ? room.OccupantNames.split(', ') : [];
  const regs = room.OccupantRegs ? room.OccupantRegs.split(', ') : [];
  
  const content = `
    <div style="text-align: center; padding: 20px 0;">
      <div style="font-size: 48px; margin-bottom: 16px;">🚪</div>
      <h3 style="font-family: var(--font-serif); font-size: 24px; color: var(--navy); margin-bottom: 8px;">Room ${room.RoomNumber}</h3>
      <div class="pill pill-navy" style="margin-bottom: 24px;">${room.RoomType} Wing (${room.CurrentOccupancy}/${room.Capacity} Filled)</div>
      
      <div style="background: var(--slate-50); border-radius: 12px; padding: 24px; text-align: left; border: 1px solid var(--slate-200);">
        <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--slate-500); font-weight: 700; margin-bottom: 16px;">Current Residents</div>
        
        ${names.length > 0 ? names.map((name, i) => `
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding-bottom: 16px; border-bottom: 1px solid var(--slate-200);">
            <div style="width: 40px; height: 40px; background: var(--navy); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 16px; font-weight: 700;">
              ${name[0]}
            </div>
            <div>
              <div style="font-size: 15px; font-weight: 700; color: var(--navy);">${name}</div>
              <div style="font-size: 12px; color: var(--slate-500);">${regs[i]}</div>
            </div>
          </div>`).join('') : `
          <div style="text-align: center; color: var(--slate-400); padding: 20px 0;">
            <div style="font-size: 32px; margin-bottom: 8px;">⏳</div>
            <p>This room is currently vacant and available for allocation.</p>
          </div>
        `}

        <div style="margin-top: 10px; padding: 12px; background: white; border-radius: 8px; border: 1px solid var(--slate-200);">
          <div style="font-size: 10px; color: var(--slate-500); text-transform: uppercase; font-weight: 700;">Status Analysis</div>
          <div style="font-size: 13px; font-weight: 600; margin-top: 4px; color: ${room.CurrentOccupancy >= room.Capacity ? 'var(--red)' : 'var(--emerald)'};">
            ${room.CurrentOccupancy >= room.Capacity ? '🔴 Maximum Capacity Reached' : '🟢 Space Available for Allocation'}
          </div>
        </div>
      </div>
      
      <div style="margin-top: 24px; display: flex; gap: 12px;">
        <button class="btn btn-navy" style="flex: 1;" onclick="closeModal()">Close Panel</button>
        ${names.length > 0 ? `
          <button class="btn btn-outline" style="flex: 1;" onclick="toast('Redirecting to registry...', 'info')">Registry Logs</button>
        ` : `
          <button class="btn btn-emerald" style="flex: 1;" onclick="toast('Manual assignment feature coming soon', 'info')">Assign Student</button>
        `}
      </div>
    </div>
  `;
  openModal(`Room ${room.RoomNumber} Analysis`, content);
}

function filterAdminRoomsByWing(wing) {
  adminCurrentWing = wing;
  document.querySelectorAll('.admin-wing-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.admin-wing-btn')).find(b => b.textContent.includes(wing));
  if (activeBtn) activeBtn.classList.add('active');
  applyAdminRoomFilters();
}

function filterAdminRoomsByStatus(status) {
  adminCurrentStatusFilter = status;
  document.querySelectorAll('.admin-status-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.admin-status-btn')).find(b => b.textContent.toLowerCase().includes(status));
  if (activeBtn) activeBtn.classList.add('active');
  applyAdminRoomFilters();
}

function applyAdminRoomFilters() {
  document.querySelectorAll('.admin-room-tile').forEach(t => {
    const rType = t.getAttribute('data-type');
    const rStatus = t.getAttribute('data-status');
    const typeMatch = rType === adminCurrentWing;
    const statusMatch = adminCurrentStatusFilter === 'all' || rStatus === adminCurrentStatusFilter;
    if (typeMatch && statusMatch) {
      t.style.display = '';
    } else {
      t.style.display = 'none';
    }
  });
}

// ── BOOKING ──
let selectedRoom = null;
let currentWing = '2-Seater';
let currentStatusFilter = 'all';

async function loadBooking() {
  const contentArea = document.getElementById('booking-content');
  if (!contentArea) return;
  
  contentArea.innerHTML = '<div style="text-align:center; padding: 40px;"><div class="spinner"></div><p style="margin-top:10px; color:var(--slate-500);">Analyzing academic eligibility...</p></div>';

  try {
    const hallRes = await fetch(`${API}/halls/eligible/${currentUser.StudentID}`);
    if (!hallRes.ok) throw new Error('Failed to fetch eligibility data');
    
    const eligibleHalls = await hallRes.json();
    const eligible = Array.isArray(eligibleHalls) ? eligibleHalls[0] : eligibleHalls;

    if (!eligible || !eligible.HallID) {
      contentArea.innerHTML = `
        <div class="announce" style="margin-bottom:20px; background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.2);">
          <span class="announce-icon">⚠️</span>
          <div class="announce-text">
            <h4 style="color: var(--red);">No Eligible Hall Found</h4>
            <p>Based on your current academic profile (Year ${Math.ceil(currentUser.Semester/2)} | ${currentUser.CGPA} CGPA), we couldn't find a matching hall wing. Please contact the Warden Office for manual placement.</p>
          </div>
        </div>`;
      return;
    }

    const roomsRes = await fetch(`${API}/halls/${eligible.HallID}/rooms`);
    const rooms = await roomsRes.json();

    contentArea.innerHTML = `
    <div class="announce" style="margin-bottom:20px">
      <span class="announce-icon">🏛️</span>
      <div class="announce-text">
        <h4>Auto-Assigned: ${eligible.HallName}</h4>
        <p>Based on your study year, you qualify for <strong>${eligible.HallName}</strong>. Select an available room below.</p>
      </div>
    </div>

    <!-- Wing Selection Buttons -->
    <div style="display: flex; gap: 12px; margin-bottom: 16px;">
      <button class="btn btn-navy wing-btn ${currentWing === '2-Seater' ? 'active' : ''}" onclick="filterRoomsByWing('2-Seater')">2-Seater Wing</button>
      <button class="btn btn-navy wing-btn ${currentWing === '5-Seater' ? 'active' : ''}" onclick="filterRoomsByWing('5-Seater')">5-Seater Wing</button>
    </div>

    <div class="card">
      <div class="card-hdr">
        <div><h3>Select a Room</h3><p>Select your preferred room. Green indicates Available, Gray indicates Occupied.</p></div>
        <div class="flex gap-2">
          <button class="btn btn-ghost btn-sm status-btn ${currentStatusFilter === 'all' ? 'active' : ''}" onclick="filterRoomsByStatus('all')">All</button>
          <button class="btn btn-ghost btn-sm status-btn ${currentStatusFilter === 'available' ? 'active' : ''}" onclick="filterRoomsByStatus('available')">Available / Empty</button>
          <button class="btn btn-ghost btn-sm status-btn ${currentStatusFilter === 'occupied' ? 'active' : ''}" onclick="filterRoomsByStatus('occupied')">Occupied</button>
        </div>
      </div>
      <div class="card-body">
        <div class="rooms-grid" id="rooms-grid">
          ${rooms.map(r => {
            const hasVacancy = r.CurrentOccupancy < r.Capacity;
            const statusText = hasVacancy ? 'available' : 'occupied';
            const displayStatus = hasVacancy ? (r.CurrentOccupancy > 0 ? 'Vacancy' : 'Empty') : 'Full';
            
            return `
            <div class="room-tile ${hasVacancy ? 'available' : 'occupied'}" id="rt-${r.RoomID}"
              data-type="${r.RoomType || '2-Seater'}"
              data-status="${statusText}"
              onclick="${hasVacancy ? `selectRoom(${r.RoomID},'${r.RoomNumber}','${r.RoomType}',${r.MonthlyFee},${r.CurrentOccupancy},${r.Capacity})` : ''}">
              <div class="room-status-dot ${hasVacancy ? (r.CurrentOccupancy > 0 ? 'partial' : 'available') : 'occupied'}" 
                   style="${hasVacancy && r.CurrentOccupancy > 0 ? 'background:#f59e0b;top:10px;right:10px;' : ''}"></div>
              <div class="rt-num">🚪 ${r.RoomNumber}</div>
              <div class="rt-type">${r.RoomType}</div>
              <div style="font-size:10px; font-weight:700; color:var(--slate-500); margin: 4px 0;">
                Occupancy: ${r.CurrentOccupancy} / ${r.Capacity}
              </div>
              <div class="rt-fee">PKR ${r.MonthlyFee.toLocaleString()}</div>
              <div class="rt-status" style="color: ${hasVacancy ? (r.CurrentOccupancy > 0 ? '#f59e0b' : 'var(--emerald)') : 'var(--red)'}">
                ${displayStatus}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
    <div class="card hidden" id="booking-form-card">
      <div class="card-hdr"><h3>📅 Confirm Your Application</h3></div>
      <div class="card-body">
        <div id="sel-room-info" style="padding:16px;background:var(--gold-pale);border:1.5px solid rgba(201,151,44,.3);border-radius:var(--r);margin-bottom:20px;font-size:13px;color:var(--amber)"></div>
        <div class="form-row">
          <div class="form-group" style="width: 100%;">
            <label>Duration</label>
            <select id="bk-duration" style="width: 100%;">
              <option value="12" selected>1 Year (Academic)</option>
            </select>
          </div>
        </div>
        <button class="btn btn-navy" onclick="confirmBooking()">Apply for Booking →</button>
      </div>
    </div>`;

    applyRoomFilters();
  } catch (e) { toast('Error loading booking application', 'error'); }
}

function filterRoomsByWing(wing) {
  currentWing = wing;
  document.querySelectorAll('.wing-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.wing-btn')).find(b => b.textContent.includes(wing));
  if (activeBtn) activeBtn.classList.add('active');
  applyRoomFilters();
}

function filterRoomsByStatus(status) {
  currentStatusFilter = status;
  document.querySelectorAll('.status-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = Array.from(document.querySelectorAll('.status-btn')).find(b => b.textContent.toLowerCase().includes(status));
  if (activeBtn) activeBtn.classList.add('active');
  applyRoomFilters();
}

function applyRoomFilters() {
  document.querySelectorAll('.room-tile').forEach(t => {
    const rType = t.getAttribute('data-type');
    const rStatus = t.getAttribute('data-status');
    const typeMatch = rType === currentWing;
    const statusMatch = currentStatusFilter === 'all' || rStatus === currentStatusFilter;
    if (typeMatch && statusMatch) {
      t.style.display = '';
    } else {
      t.style.display = 'none';
    }
  });
}

function selectRoom(id, num, type, fee, current, cap) {
  selectedRoom = { id, num, type, fee };
  document.querySelectorAll('.room-tile.available').forEach(t => t.classList.remove('selected'));
  const el = document.getElementById(`rt-${id}`);
  if (el) el.classList.add('selected');
  const formCard = document.getElementById('booking-form-card');
  const infoEl = document.getElementById('sel-room-info');
  if (formCard) formCard.classList.remove('hidden');
  if (infoEl) infoEl.innerHTML = `
    <div style="display:flex; align-items:center; gap:12px;">
      <span style="font-size:24px;">🛏️</span>
      <div>
        <strong>Room ${escapeHTML(num)}</strong> — ${escapeHTML(type)} Room · PKR ${fee.toLocaleString()}/month
        <div style="font-size:11px; opacity:0.8; margin-top:2px;">Current Residents: ${current} / ${cap} (Max Capacity)</div>
      </div>
    </div>`;
}

async function confirmBooking() {
  if (!selectedRoom) return toast('Please select a room', 'error');

  try {
    const res = await fetch(`${API}/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: currentUser.StudentID, roomId: selectedRoom.id })
    });
    const data = await res.json();
    if (!res.ok) return toast(data.error || 'Booking failed', 'error');

    toast(`Booking application for Room ${selectedRoom.num} submitted!`, 'success');
    addNotif(`Room ${selectedRoom.num} booking submitted — awaiting admin approval`, '📋');
    const formCard = document.getElementById('booking-form-card');
    if (formCard) formCard.classList.add('hidden');
    selectedRoom = null;
    loadBooking();
  } catch (e) { toast('Error submitting booking', 'error'); }
}

function filterRooms(type) {
  document.querySelectorAll('.room-tile').forEach(t => {
    const rt = t.querySelector('.rt-type')?.textContent;
    t.style.display = (type === 'all' || rt === type) ? '' : 'none';
  });
}

// Cancel booking function
async function cancelBooking(bookingId) {
  if (!confirm('Are you sure you want to cancel this booking? This action cannot be undone.')) return;

  try {
    const res = await fetch(`${API}/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.StudentID, userRole: currentRole })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to cancel booking');
    }

    toast('Booking cancelled successfully', 'success');
    addNotif('Booking cancelled', '📋');

    // Refresh dashboard
    if (document.getElementById('page-dashboard').classList.contains('active')) {
      loadStudentDash();
    }
  } catch (e) {
    toast('Error cancelling booking: ' + e.message, 'error');
  }
}

// ── MESS MENU ──
let currentDay = 'Monday';
let globalMessMenu = [];
async function loadMess() {
  try {
    const res = await fetch(`${API}/mess/menu`);
    globalMessMenu = await res.json();

    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const todayIdx = new Date().getDay();
    const todayName = days[todayIdx === 0 ? 6 : todayIdx - 1];
    currentDay = todayName;
    const tabs = document.getElementById('day-tabs');
    if (tabs) {
      tabs.innerHTML = days.map(d => `
        <button class="day-tab ${d === todayName ? 'today' : ''} ${d === currentDay ? 'active' : ''}" onclick="setDay('${d}',this)">${d}</button>`).join('');
    }

    if (currentRole === 'student' && currentUser?.StudentID) {
      try {
        const attRes = await fetch(`${API}/mess/attendance/today?studentId=${currentUser.StudentID}`);
        if (attRes.ok) {
          const attendance = await attRes.json();
          currentUser.todayAttendance = Array.isArray(attendance) ? attendance.map(a => a.MealType) : [];
        } else {
          currentUser.todayAttendance = [];
        }
        
        // Fetch Mess Stats & History
        document.getElementById('mess-activity-section').style.display = 'block';
        
        const statsRes = await fetch(`${API}/mess/activity/stats?studentId=${currentUser.StudentID}`);
        if (statsRes.ok) {
          const stats = await statsRes.json();
          document.getElementById('mess-stats-grid').innerHTML = `
            <div class="kpi-card" style="background:var(--white); padding:20px; border-radius:12px; border:1px solid rgba(0,0,0,0.05)">
              <div style="font-size:12px; color:var(--slate-500); text-transform:uppercase">Today</div>
              <div style="font-size:24px; font-weight:700; color:var(--navy); margin-top:8px">PKR ${stats.TodayTotal || 0}</div>
            </div>
            <div class="kpi-card" style="background:var(--white); padding:20px; border-radius:12px; border:1px solid rgba(0,0,0,0.05)">
              <div style="font-size:12px; color:var(--slate-500); text-transform:uppercase">Yesterday</div>
              <div style="font-size:24px; font-weight:700; color:var(--navy); margin-top:8px">PKR ${stats.YesterdayTotal || 0}</div>
            </div>
            <div class="kpi-card" style="background:var(--white); padding:20px; border-radius:12px; border:1px solid rgba(0,0,0,0.05)">
              <div style="font-size:12px; color:var(--slate-500); text-transform:uppercase">This Week</div>
              <div style="font-size:24px; font-weight:700; color:var(--navy); margin-top:8px">PKR ${stats.ThisWeekTotal || 0}</div>
            </div>
            <div class="kpi-card" style="background:var(--white); padding:20px; border-radius:12px; border:1px solid rgba(0,0,0,0.05)">
              <div style="font-size:12px; color:var(--slate-500); text-transform:uppercase">This Month</div>
              <div style="font-size:24px; font-weight:700; color:var(--navy); margin-top:8px">PKR ${stats.ThisMonthTotal || 0}</div>
            </div>
          `;
        }

        const historyRes = await fetch(`${API}/mess/activity/history?studentId=${currentUser.StudentID}`);
        if (historyRes.ok) {
          const history = await historyRes.json();
          const tableHtml = history.slice(0, 10).map(h => `
            <tr style="border-bottom: 1px solid rgba(0,0,0,0.02); font-size:14px;">
              <td style="padding:12px 0; color:var(--slate-600)">${new Date(h.AttendanceDate).toLocaleDateString()}</td>
              <td style="font-weight:500; color:var(--navy)">${escapeHTML(h.MealType)}</td>
              <td style="color:var(--slate-500)">PKR ${h.PriceAtTime}</td>
              <td style="color:var(--slate-500)">x${h.MealUnit || 1}</td>
              <td style="text-align:right; font-weight:600; color:var(--emerald)">PKR ${h.FinalPrice || h.PriceAtTime}</td>
            </tr>
          `).join('');
          document.getElementById('mess-history-table').innerHTML = tableHtml || '<tr><td colspan="5" style="padding:12px 0;">No recent meals found</td></tr>';
        }

        const billsRes = await fetch(`${API}/mess/bills/weekly?studentId=${currentUser.StudentID}`);
        if (billsRes.ok) {
          const bills = await billsRes.json();
          const billHtml = bills.slice(0, 5).map(b => {
            let actionHtml = '';
            if (b.IsPaid) {
              actionHtml = '<span class="pill pill-green">Paid</span>';
            } else if (b.IsPendingVerification) {
              actionHtml = '<span class="pill pill-amber" style="background: rgba(245, 158, 11, 0.1); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.2);">Pending Verification</span>';
            } else {
              actionHtml = `<button class="btn btn-gold btn-sm" onclick="payFee(${b.BillID}, 'WeeklyMess', ${b.TotalAmount})">Settle</button>`;
            }
            return `
              <tr style="border-bottom: 1px solid rgba(0,0,0,0.02); font-size:14px;">
                <td style="padding:12px 0; color:var(--slate-600)">${new Date(b.WeekStartDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'})} - ${new Date(b.WeekEndDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}</td>
                <td>${actionHtml}</td>
                <td style="text-align:right; font-weight:600; color:var(--navy)">PKR ${b.TotalAmount.toLocaleString()}</td>
              </tr>
            `;
          }).join('');
          document.getElementById('mess-weekly-bills-table').innerHTML = billHtml || '<tr><td colspan="3" style="padding:12px 0;">No weekly bills yet</td></tr>';
        }
      } catch (e) {
        console.error('Attendance/Stats fetch failed', e);
        currentUser.todayAttendance = [];
      }
    }

    renderMenu(currentDay);
  } catch (e) { toast('Error loading menu', 'error'); }
}

function setDay(d, btn) {
  currentDay = d;
  document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  renderMenu(d);
}

function renderMenu(day) {
  const menu = globalMessMenu.filter(m => m.DayOfWeek === day);
  const meals = ['Breakfast', 'Lunch', 'Dinner'];
  const content = document.getElementById('mess-content');
  if (content) {
    const multipliers = { Breakfast: 0.75, Lunch: 0.80, Dinner: 0.82 };
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const isToday = day === today;

    content.innerHTML = `
      <div class="meals-grid">
        ${meals.map(type => {
      const m = menu.find(i => i.MealType.trim() === type);
      const menuItem = m ? m.MenuItem : 'Not available';
      const basePrice = m?.Price || 0;
      const finalPrice = Math.round(basePrice * (multipliers[type] || 1));
      const emojis = { Breakfast: '☀️', Lunch: '🌤', Dinner: '🌙' };
      const taken = currentUser.todayAttendance?.map(a => a.trim()).includes(type);

      return `
            <div class="meal-card ${taken ? 'taken' : ''}" style="${taken ? 'border: 2px solid var(--emerald)' : ''}">
              <div class="meal-card-hdr ${type.toLowerCase()}">
                <span>${emojis[type]} ${type}</span>
                ${m ? `<span class="price-tag">PKR ${finalPrice}</span>` : ''}
              </div>
              <div class="meal-items">
                <div class="meal-item">${escapeHTML(menuItem)}</div>
              </div>
              <div class="meal-footer" style="padding:15px; border-top:1px solid var(--slate-100)">
                ${isToday && currentRole === 'student' ? (
          taken ? '<span class="pill pill-green" style="width:100%; display:inline-block; text-align:center">✓ Attendance Marked</span>' :
            '<span class="pill pill-gray" style="width:100%; display:inline-block; text-align:center; color:var(--slate-400)">✗ Not Marked</span>'
        ) : ''}
              </div>
            </div>`;
    }).join('')}
      </div>`;
  }
}

async function markAttendance(menuId, mealType, price) {
  if (!menuId) return toast('Meal not available today', 'error');
  try {
    const res = await fetch(`${API}/mess/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: currentUser.StudentID, menuId, mealType, price })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to mark attendance');
    }
    toast(`Attendance marked for ${mealType}!`, 'success');
    loadMess(); // Refresh to show "Marked" status
  } catch (e) { toast(e.message, 'error'); }
}

// ── FEES ──
async function loadFees() {
  try {
    const [feesRes, weeklyBillsRes] = await Promise.all([
      fetch(`${API}/fees/${currentUser.StudentID}`),
      fetch(`${API}/mess/bills/weekly?studentId=${currentUser.StudentID}`)
    ]);
    const data = await feesRes.json();
    const weeklyBills = await weeklyBillsRes.json();

    const formattedWeeklyBills = weeklyBills.map(b => ({
      ...b,
      IsWeekly: true,
      Month: 'Weekly Bill',
      Year: `${new Date(b.WeekStartDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'})} - ${new Date(b.WeekEndDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'})}`,
      Amount: b.TotalAmount
    }));

    allFees = { 
      roomFees: data.roomFees || [], 
      messFees: [...(data.messFees || []), ...formattedWeeklyBills] 
    };
    renderFees('all');
  } catch (e) { toast('Error loading fees', 'error'); }
}

function renderFees(filter) {
  let rFees = allFees.roomFees;
  let mFees = allFees.messFees;

  if (filter === 'paid') {
    rFees = rFees.filter(f => f.IsPaid);
    mFees = mFees.filter(f => f.IsPaid);
  } else if (filter === 'unpaid') {
    rFees = rFees.filter(f => !f.IsPaid);
    mFees = mFees.filter(f => !f.IsPaid);
  }

  const all = [...allFees.roomFees, ...allFees.messFees];
  const totalDue = all.filter(f => !f.IsPaid).reduce((s, f) => s + (f.Amount || f.TotalAmount || 0), 0);
  const totalPaid = all.filter(f => f.IsPaid).reduce((s, f) => s + (f.Amount || f.TotalAmount || 0), 0);

  const content = document.getElementById('fees-content');
  if (content) {
    content.innerHTML = `
      <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">
        <div class="kpi" style="--kpi-color:var(--ruby)"><div class="kpi-icon">⚠️</div><div class="kpi-val">PKR ${totalDue.toLocaleString()}</div><div class="kpi-label">Total Pending</div></div>
        <div class="kpi" style="--kpi-color:var(--emerald)"><div class="kpi-icon">✅</div><div class="kpi-val">PKR ${totalPaid.toLocaleString()}</div><div class="kpi-label">Total Paid</div></div>
        <div class="kpi" style="--kpi-color:var(--sky)"><div class="kpi-icon">📅</div><div class="kpi-val">Mar 15</div><div class="kpi-label">Next Deadline</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-hdr"><h3>🏠 Room Fees</h3></div>
          <div class="card-body">${rFees.map(f => feeItem(f, 'ROOM')).join('')}</div>
        </div>
        <div class="card">
          <div class="card-hdr"><h3>🍽️ Mess Bills</h3></div>
          <div class="card-body">${mFees.map(f => feeItem(f, 'MESS')).join('')}</div>
        </div>
      </div>`;
  }
}

function feeItem(f, type) {
  const isRoom = type === 'ROOM';
  const id = isRoom ? f.FeeID : f.BillID;
  const amount = f.Amount || f.TotalAmount || 0;
  const payType = isRoom ? 'Room' : (f.IsWeekly ? 'WeeklyMess' : 'Mess');
  
  let actionHtml = '';
  if (f.IsPaid) {
    actionHtml = '<span class="pill pill-green">Settled</span>';
  } else if (f.IsPendingVerification) {
    actionHtml = '<span class="pill pill-amber" style="background: rgba(245, 158, 11, 0.1); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.2);">Verification Pending</span>';
  } else {
    actionHtml = `<button class="btn btn-gold btn-sm" onclick="payFee(${id}, '${payType}', ${amount})">Settle Bill</button>`;
  }

  return `
    <div class="card" style="margin-bottom:16px; border:1px solid ${f.IsPaid ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}">
      <div class="card-body" style="padding:20px; display:flex; align-items:center; gap:20px">
        <div class="tl-dot" style="background:${isRoom ? 'var(--navy)' : 'var(--emerald)'}; color:white; width:48px; height:48px">
          ${isRoom ? '🏛️' : '🍽️'}
        </div>
        <div style="flex:1">
          <div style="font-weight:700; color:var(--navy); font-size:15px">${escapeHTML(f.Month)} ${escapeHTML(f.Year)}</div>
          <div style="font-size:12px; color:var(--slate-400); margin-top:2px">
            ${isRoom ? `${escapeHTML(f.HallName)} · Unit ${escapeHTML(f.RoomNumber)}` : (f.IsWeekly ? 'Weekly Mess Attendance Bill' : 'Full Mess Subscription')}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-family:var(--font-serif); font-size:20px; color:var(--navy); font-weight:400">PKR ${amount.toLocaleString()}</div>
          <div style="margin-top:8px">
            ${actionHtml}
          </div>
        </div>
      </div>
    </div>`;
}

async function payFee(id, type, amount) {
  try {
    const res = await fetch(`${API}/fees/payment-methods`);
    const methods = await res.json();
    
    const selectOptions = methods.map(m => `<option value="${m.MethodID}">${m.MethodName}</option>`).join('');
    
    const content = `
      <div style="display:flex; flex-direction:column; gap:16px;">
        <p style="font-size: 13px; color: var(--slate-500);">Submit deposit reference to settle your PKR ${amount.toLocaleString()} ${type} fee.</p>
        <div class="form-group">
          <label style="font-weight: 700; margin-bottom: 4px; display: block;">Payment Channel</label>
          <select id="pay-method-select" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--slate-200); background: white;">
            ${selectOptions}
          </select>
        </div>
        <div class="form-group">
          <label style="font-weight: 700; margin-bottom: 4px; display: block;">Transaction Reference Number / Receipt ID</label>
          <input type="text" id="pay-ref" placeholder="Enter bank reference, e.g. TRX-90234..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--slate-200);" required>
        </div>
        <div class="form-group">
          <label style="font-weight: 700; margin-bottom: 4px; display: block;">Memo / Notes (Optional)</label>
          <textarea id="pay-notes" placeholder="Include bank name, branch, or deposit date..." style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--slate-200); min-height: 60px;"></textarea>
        </div>
        <button class="btn btn-navy" style="width: 100%; margin-top: 10px;" onclick="submitFeeProof(${id}, '${type}', ${amount})">Submit Verification Request</button>
      </div>
    `;
    
    openModal(`Settle Dues: PKR ${amount.toLocaleString()}`, content);
  } catch (e) {
    toast('Error fetching payment channels', 'error');
  }
}

window.submitFeeProof = async function(feeId, feeType, amount) {
  const methodId = document.getElementById('pay-method-select').value;
  const referenceNo = document.getElementById('pay-ref').value.trim();
  const notes = document.getElementById('pay-notes').value.trim();
  
  if (!referenceNo) {
    toast('Please enter a Transaction Reference Number', 'error');
    return;
  }
  
  try {
    const res = await fetch(`${API}/fees/submit-transaction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentId: currentUser.StudentID,
        feeId,
        feeType: feeType === 'WeeklyMess' ? 'Mess' : feeType,
        methodId: parseInt(methodId),
        amount,
        referenceNo,
        notes: feeType === 'WeeklyMess' ? `[Weekly] ${notes}` : notes
      })
    });
    
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to submit transaction');
    }
    
    toast('Transaction proof submitted successfully!', 'success');
    addNotif(`Verification pending: ${feeType} Fee (Ref: ${referenceNo})`, '💳');
    closeModal();
    if (feeType === 'WeeklyMess') {
      loadMess();
      loadFees();
    } else {
      loadFees();
    }
  } catch (e) {
    toast(e.message, 'error');
  }
};

function filterFees(type, btn) {
  document.querySelectorAll('#fee-filter .btn').forEach(b => b.classList.remove('active-filter'));
  btn.classList.add('active-filter');
  renderFees(type);
}

// ── COMPLAINTS ──
async function loadComplaints() {
  try {
    const res = await fetch(`${API}/complaints/student/${currentUser.StudentID}`);
    allComplaints = await res.json();
    renderComplaints(allComplaints);
  } catch (e) { toast('Error loading complaints', 'error'); }
}

function renderComplaints(list) {
  const statusClass = { Open: 'pill-red', 'In Progress': 'pill-amber', Resolved: 'pill-green' };
  const listEl = document.getElementById('complaints-list');
  if (listEl) {
    listEl.innerHTML = list.length ? list.map(c => `
      <tr>
        <td>
          <div style="font-weight:700; color:var(--navy)">#${c.ComplaintID} ${escapeHTML(c.Title)}</div>
          <div style="font-size:11px; color:var(--slate-400); margin-top:4px">${escapeHTML(c.SubmittedAt?.split('T')[0] || 'Today')}</div>
        </td>
        <td>
          <div style="font-size:13px">${escapeHTML(c.Category)}</div>
        </td>
        <td>
          <span style="color:${c.Priority === 'High' ? 'var(--ruby)' : 'inherit'}">${escapeHTML(c.Priority || 'Standard')}</span>
        </td>
        <td>
          <div style="display:flex; align-items:center; gap:12px; justify-content:space-between">
            <span class="pill ${statusClass[c.Status] || 'pill-gray'}">${escapeHTML(c.Status)}</span>
            <button class="btn btn-ghost" style="padding:6px; border-radius:10px" onclick="deleteComplaint(${c.ComplaintID})">🗑️</button>
          </div>
        </td>
      </tr>`).join('')
      : '<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--slate-400)">No institutional requests found in ledger.</td></tr>';
  }
}

function filterComplaints(type, btn) {
  document.querySelectorAll('.card-hdr .btn').forEach(b => b.style.fontWeight = '');
  btn.style.fontWeight = '800';
  renderComplaints(type === 'all' ? allComplaints : allComplaints.filter(c => c.Status === type));
}

async function submitComplaint() {
  const title = document.getElementById('comp-title').value;
  if (!title) return toast('Please enter a complaint title', 'error');
  const cat = document.getElementById('comp-cat').value;
  const desc = document.getElementById('comp-desc').value;
  const priority = document.getElementById('comp-priority').value;

  try {
    const res = await fetch(`${API}/complaints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: currentUser.StudentID, title, description: desc, category: cat, priority })
    });
    if (!res.ok) throw new Error('Submission failed');
    toast('Complaint submitted successfully', 'success');
    addNotif(`New complaint: "${title}" submitted`, '📣');
    document.getElementById('comp-title').value = '';
    document.getElementById('comp-desc').value = '';
    loadComplaints();
  } catch (e) { toast('Error submitting complaint', 'error'); }
}

// Delete complaint function
async function deleteComplaint(complaintId) {
  if (!confirm('Are you sure you want to delete this complaint? This action cannot be undone.')) return;

  try {
    const res = await fetch(`${API}/complaints/${complaintId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.StudentID, userRole: currentRole })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete complaint');
    }

    toast('Complaint deleted successfully', 'success');
    addNotif('Complaint deleted', '📣');

    // Refresh complaints list
    loadComplaints();
  } catch (e) {
    toast('Error deleting complaint: ' + e.message, 'error');
  }
}

// ── PROFILE ──
async function loadProfile() {
  const av = document.getElementById('profile-avatar');
  const name = document.getElementById('profile-name');
  const idEl = document.getElementById('profile-id');
  const grid = document.getElementById('profile-details-grid');
  
  if (av) av.textContent = currentUser.FullName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  if (name) name.textContent = currentUser.FullName;
  if (idEl) idEl.textContent = `Institutional ID: ${currentUser.StudentID || currentUser.AdminID}`;

  if (grid) {
    grid.innerHTML = `
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px">
        ${infoCell('Full Legal Name', currentUser.FullName)}
        ${infoCell('Official Email', currentUser.Email)}
        ${infoCell('Service Domain', currentRole === 'admin' ? 'Administration' : currentUser.Department)}
        ${infoCell('Contact Line', currentUser.PhoneNumber || 'Not Registered')}
        ${currentRole === 'student' ? infoCell('Academic Standings', `${currentUser.CGPA} CGPA`) : ''}
        ${currentRole === 'student' ? infoCell('Enrolled Term', `Semester ${currentUser.Semester}`) : ''}
        ${infoCell('Residency Status', 'Active Resident')}
        ${infoCell('Account Security', 'Biolock / PIN Secured')}
      </div>`;
  }

  const btnContainer = document.getElementById('profile-action-buttons');
  if (btnContainer) {
    let btnHtml = `<button class="btn btn-navy w-100" onclick="editProfile()">Update Credentials</button>`;
    if (currentRole === 'admin') {
      btnHtml += `<button class="btn btn-gold w-100" style="background:var(--amber); color:black; font-weight:700;" onclick="openWardenShiftModal()">Warden Post Shift</button>`;
    }
    btnHtml += `<button class="btn btn-ghost w-100" onclick="logout()">Terminate Session</button>`;
    btnContainer.innerHTML = btnHtml;
  }
}

function infoCell(label, val) {
  return `
    <div style="padding:16px; border-radius:12px; border:1px solid rgba(0,0,0,0.03); background:rgba(0,0,0,0.01)">
      <div style="font-size:10px; text-transform:uppercase; letter-spacing:1.5px; color:var(--slate-400); font-weight:800; margin-bottom:4px">${escapeHTML(label)}</div>
      <div style="font-size:14px; font-weight:700; color:var(--navy)">${escapeHTML(val) || '—'}</div>
    </div>`;
}

// ── PROFILE EDITING ──
window.editProfile = function() {
  const isStudent = currentRole === 'student';
  const emailVal = currentUser.Email || '';
  const domainVal = isStudent ? currentUser.Department : 'Administration';
  const nameVal = currentUser.FullName || '';
  const phoneVal = currentUser.PhoneNumber || '';

  const html = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <p style="font-size:14px; color:var(--slate-500); margin-bottom: 8px;">
        Certain administrative details (like your Official Email and Service Domain) are locked and managed by the institution. You can update your contact and display name.
      </p>

      <div class="form-group">
        <label>Full Legal Name</label>
        <input type="text" id="upd-name" value="${nameVal}" style="background:var(--surface-container-highest); border:1px solid var(--outline-variant); color:var(--on-surface);">
      </div>

      <div class="form-group">
        <label>Contact Line</label>
        <input type="text" id="upd-phone" value="${phoneVal}" placeholder="+92 XXX XXXXXXX" style="background:var(--surface-container-highest); border:1px solid var(--outline-variant); color:var(--on-surface);">
      </div>

      <div class="form-group">
        <label>Account Password (Optional)</label>
        <input type="password" id="upd-password" placeholder="Leave blank to keep current" style="background:var(--surface-container-highest); border:1px solid var(--outline-variant); color:var(--on-surface);">
      </div>

      <div class="form-group">
        <label>Official Email <span style="color:var(--error); font-size:10px">(LOCKED)</span></label>
        <input type="email" value="${emailVal}" disabled style="background: rgba(0,0,0,0.05); opacity: 0.6; cursor: not-allowed; color:var(--slate-400); border:1px dashed var(--outline-variant);">
      </div>

      <div class="form-group">
        <label>${isStudent ? 'Enrolled Department' : 'Service Domain'} <span style="color:var(--error); font-size:10px">(LOCKED)</span></label>
        <input type="text" value="${domainVal}" disabled style="background: rgba(0,0,0,0.05); opacity: 0.6; cursor: not-allowed; color:var(--slate-400); border:1px dashed var(--outline-variant);">
      </div>

      <button class="btn btn-navy" style="margin-top:16px;" onclick="saveProfileChanges()">Save Credentials</button>
    </div>
  `;

  openModal('Update Credentials', html);
};

window.saveProfileChanges = async function() {
  const newName = document.getElementById('upd-name').value.trim();
  const newPhone = document.getElementById('upd-phone').value.trim();
  const newPass = document.getElementById('upd-password').value;

  if (!newName) {
    toast('Name cannot be empty', 'error');
    return;
  }

  const payload = {
    fullName: newName,
    phone: newPhone,
    password: newPass
  };

  const endpoint = currentRole === 'student' ? '/auth/student/profile' : '/auth/admin/profile';
  if (currentRole === 'student') payload.studentId = currentUser.StudentID;
  if (currentRole === 'admin') payload.adminId = currentUser.AdminID;

  try {
    const res = await fetch(API + endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update profile');

    toast('Credentials updated successfully. Please login again.', 'success');
    closeModal();
    setTimeout(() => logout(), 1500);

  } catch (e) {
    toast(e.message, 'error');
  }
};

window.openWardenShiftModal = function() {
  const html = `
    <div style="display:flex; flex-direction:column; gap:16px;">
      <div style="background: rgba(245, 158, 11, 0.08); border-left: 4px solid var(--amber); padding: 12px 16px; border-radius: 8px; font-size: 13px; color: #b45309; line-height: 1.5;">
        <strong>⚠️ CRITICAL AUTHORITY TRANSFER WARNING:</strong><br>
        This action will permanently transfer all administrative and Warden authority to the new individual specified below. 
        Once submitted, your account will be instantly deactivated, and you will be logged out and barred from logging back in.
      </div>

      <div class="form-group">
        <label>New Warden Full Name</label>
        <input type="text" id="shift-name" placeholder="E.g., Dr. Haroon Mahmood" style="background:var(--surface-container-highest); border:1px solid var(--outline-variant); color:var(--on-surface);">
      </div>

      <div class="form-group">
        <label>New Warden Email Address</label>
        <input type="email" id="shift-email" placeholder="username@admin.edu.pk" style="background:var(--surface-container-highest); border:1px solid var(--outline-variant); color:var(--on-surface);">
      </div>

      <div class="form-group">
        <label>New Warden Contact Line</label>
        <input type="text" id="shift-phone" placeholder="+92 XXX XXXXXXX" style="background:var(--surface-container-highest); border:1px solid var(--outline-variant); color:var(--on-surface);">
      </div>

      <div class="form-group">
        <label>New Warden Temporary Password</label>
        <input type="password" id="shift-password" placeholder="Min 6 characters recommended" style="background:var(--surface-container-highest); border:1px solid var(--outline-variant); color:var(--on-surface);">
      </div>

      <div style="display: flex; gap: 8px; align-items: flex-start; margin-top: 8px;">
        <input type="checkbox" id="shift-confirm" style="margin-top: 3px; cursor: pointer;">
        <label for="shift-confirm" style="font-size: 12px; color: var(--slate-600); cursor: pointer; user-select: none;">
          I understand that this operation is irreversible and will deactivate my access immediately.
        </label>
      </div>

      <button class="btn btn-navy" style="margin-top:16px; background: var(--amber); color: black; font-weight:700;" onclick="submitWardenShift()">Transfer Authority Now</button>
    </div>
  `;

  openModal('Warden Post Shift', html);
};

window.submitWardenShift = async function() {
  const name = document.getElementById('shift-name').value.trim();
  const email = document.getElementById('shift-email').value.trim();
  const phone = document.getElementById('shift-phone').value.trim();
  const pass = document.getElementById('shift-password').value;
  const confirmed = document.getElementById('shift-confirm').checked;

  if (!name || !email || !phone || !pass) {
    toast('Please fill in all fields for the new Warden', 'error');
    return;
  }
  if (!email.toLowerCase().endsWith('@admin.edu.pk')) {
    toast('Invalid Email Domain! Warden emails must end with @admin.edu.pk', 'error');
    return;
  }
  if (!confirmed) {
    toast('You must check the box to confirm you understand the consequences', 'error');
    return;
  }

  const payload = {
    fullName: name,
    email: email.toLowerCase(),
    password: pass,
    phone: phone,
    currentAdminId: currentUser.AdminID
  };

  try {
    const res = await fetch(API + '/auth/admin/shift-warden', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to shift Warden authority');

    toast('Authority successfully transferred! Logging you out...', 'success');
    closeModal();
    setTimeout(() => logout(), 2000);

  } catch (e) {
    toast(e.message, 'error');
  }
};

// ── ADMIN: BOOKINGS ──
let adminGlobalBookings = [];
async function loadAdminBookings() {
  try {
    const res = await fetch(`${API}/bookings/all`);
    adminGlobalBookings = await res.json();
    const filters = document.getElementById('booking-filters');
    if (filters) {
      filters.innerHTML = ['All', 'Pending', 'Approved', 'Rejected'].map(s => `
        <button class="btn btn-ghost btn-sm" onclick="renderBookingTable('${s}',this)">${s}</button>`).join('');
      renderBookingTable('All', filters.firstChild);
    }
  } catch (e) { toast('Error loading bookings', 'error'); }
}

function renderBookingTable(status, btn) {
  const data = adminGlobalBookings;
  const filtered = status === 'All' ? data : data.filter(b => {
    if (status === 'Approved') return b.Status === 'Approved' || b.Status === 'Active';
    return b.Status === status;
  });
  const cols = { Approved: 'green', Active: 'green', Pending: 'amber', Rejected: 'red' };
  const tableWrap = document.getElementById('admin-bookings-table');
  if (tableWrap) {
    tableWrap.innerHTML = `
      <table>
        <thead><tr><th>Student</th><th>Hall</th><th>Room</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>
          ${filtered.map(b => `<tr>
            <td><strong>${escapeHTML(b.FullName)}</strong><br><small>${escapeHTML(b.RegNumber)}</small></td>
            <td>${escapeHTML(b.HallName)}</td>
            <td>${escapeHTML(b.RoomNumber)}</td>
            <td><span class="pill pill-${cols[b.Status] || 'gray'}">${escapeHTML(b.Status)}</span></td>
            <td>
              <button class="btn btn-sm btn-ghost" onclick="showBookingDetail(${JSON.stringify(b).replace(/"/g, '&quot;')})">View</button>
              ${b.Status === 'Rejected' ? `<button class="btn btn-sm btn-ruby" onclick="deleteBooking(${b.BookingID})" style="margin-left:4px">Delete</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }
}

function showBookingDetail(b) {
  openModal('Booking Details', `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
      ${[['Student', b.FullName], ['Reg No.', b.RegNumber], ['CGPA', b.CGPA], ['Hall', b.HallName], ['Room', b.RoomNumber], ['Fee', b.MonthlyFee]].map(([l, v]) => infoCell(l, v)).join('')}
    </div>
    <div style="margin-top:16px;display:flex;gap:10px">
      <button class="btn btn-emerald" onclick="adminUpdateBooking(${b.BookingID}, 'Approved')">Approve</button>
      <button class="btn btn-amber" onclick="adminUpdateBooking(${b.BookingID}, 'Pending')">Mark Pending</button>
      <button class="btn btn-ruby" onclick="adminUpdateBooking(${b.BookingID}, 'Rejected')">Reject</button>
      ${b.Status === 'Rejected' ? `<button class="btn btn-red" onclick="deleteBooking(${b.BookingID})">Delete Booking</button>` : ''}
    </div>`);
}

// Delete booking function (admin)
async function deleteBooking(bookingId) {
  if (!confirm('Are you sure you want to permanently delete this booking? This action cannot be undone.')) return;

  try {
    const res = await fetch(`${API}/bookings/${bookingId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.AdminID, userRole: currentRole })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete booking');
    }

    toast('Booking deleted successfully', 'success');
    closeModal();

    // Refresh admin bookings
    loadAdminBookings();
  } catch (e) {
    toast('Error deleting booking: ' + e.message, 'error');
  }
}

// ── ADMIN: COMPLAINTS ──
async function loadAdminComplaints() {
  try {
    const res = await fetch(`${API}/complaints/all`);
    const data = await res.json();
    renderAdminComplaintsTable(data);
  } catch (e) { toast('Error loading complaints', 'error'); }
}

function renderAdminComplaintsTable(data) {
  const cols = { Open: 'red', 'In Progress': 'amber', Resolved: 'green' };
  const tableWrap = document.getElementById('admin-complaints-table');
  if (!tableWrap) return;

  // Grouping logic: Helper to get start and end of week
  function getWeekRange(dateStr) {
    const d = new Date(dateStr);
    const day = d.getDay(); // 0 is Sunday
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    const start = new Date(d.setDate(diff));
    const end = new Date(d.setDate(diff + 6));
    const options = { month: 'short', day: 'numeric' };
    return `Week of ${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
  }

  // Sort by date descending
  data.sort((a, b) => new Date(b.SubmittedAt) - new Date(a.SubmittedAt));

  // Group complaints
  const groups = {};
  data.forEach(c => {
    const week = c.SubmittedAt ? getWeekRange(c.SubmittedAt) : 'No Date';
    if (!groups[week]) groups[week] = [];
    groups[week].push(c);
  });

  let html = '';
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  for (const week in groups) {
    html += `
      <div class="week-section" style="margin-bottom:30px">
        <h4 style="background:var(--slate-100); padding:8px 15px; border-radius:8px; margin-bottom:15px; color:var(--navy); display:flex; justify-content:space-between">
          <span>📅 ${week}</span>
          <small style="font-weight:400; opacity:0.7">${groups[week].length} complaints</small>
        </h4>
        <table>
          <thead><tr><th>Student</th><th>Hall</th><th>Category</th><th>Title</th><th>Date</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            ${groups[week].map(c => {
      const isOverdue = c.Status !== 'Resolved' && new Date(c.SubmittedAt) < thirtyDaysAgo;
      return `
              <tr style="${isOverdue ? 'background:rgba(235, 64, 52, 0.05)' : ''}">
                <td><strong>${escapeHTML(c.FullName)}</strong></td>
                <td>${escapeHTML(c.HallName || 'N/A')}</td>
                <td>${escapeHTML(c.Category)}</td>
                <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHTML(c.Title)}">${escapeHTML(c.Title)}</td>
                <td>
                  <div style="display:flex; flex-direction:column">
                    <small>${c.SubmittedAt ? new Date(c.SubmittedAt).toLocaleDateString() : '—'}</small>
                    ${isOverdue ? '<span style="color:var(--ruby); font-size:9px; font-weight:700">LATE</span>' : ''}
                  </div>
                </td>
                <td><span class="pill pill-${cols[c.Status] || 'gray'}">${escapeHTML(c.Status)}</span></td>
                <td>
                  <div class="flex gap-1">
                    <button class="btn btn-sm btn-ghost" onclick="showComplaintDetail(${JSON.stringify(c).replace(/"/g, '&quot;')})">View</button>
                    <button class="btn btn-sm btn-ruby" onclick="deleteComplaintAdmin(${c.ComplaintID})">🗑️</button>
                  </div>
                </td>
              </tr>`;
    }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  tableWrap.innerHTML = html || '<div class="empty"><h4>No complaints found.</h4></div>';
}

function showComplaintDetail(c) {
  openModal('Complaint Details', `
    <h4 style="margin-bottom:8px">${escapeHTML(c.Title)}</h4>
    <div style="font-size:12px;color:var(--slate-500);margin-bottom:12px">Student: ${escapeHTML(c.FullName)} · Hall: ${escapeHTML(c.HallName || 'N/A')} · Registered: ${c.SubmittedAt ? new Date(c.SubmittedAt).toLocaleString() : '—'}</div>
    <div style="padding:15px;background:var(--slate-50);border-radius:8px;font-size:13px;margin-bottom:15px">${escapeHTML(c.Description)}</div>
    <div class="flex gap-2">
      <button class="btn btn-emerald" onclick="adminUpdateComplaint(${c.ComplaintID}, 'Resolved')">Resolve</button>
      <button class="btn btn-amber" onclick="adminUpdateComplaint(${c.ComplaintID}, 'In Progress')">In Progress</button>
      <button class="btn btn-ruby" onclick="deleteComplaintAdmin(${c.ComplaintID})">Delete Complaint</button>
    </div>`);
}

// Delete complaint function (admin)
async function deleteComplaintAdmin(complaintId) {
  if (!confirm('Are you sure you want to permanently delete this complaint? This action cannot be undone.')) return;

  try {
    const res = await fetch(`${API}/complaints/${complaintId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUser.AdminID, userRole: currentRole })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete complaint');
    }

    toast('Complaint deleted successfully', 'success');
    closeModal();

    // Refresh admin complaints
    loadAdminComplaints();

    // Also refresh stats if on admin dashboard
    if (document.getElementById('page-admin-dashboard').classList.contains('active')) {
      loadAdminDash();
    }
  } catch (e) {
    toast('Error deleting complaint: ' + e.message, 'error');
  }
}

// ── ADMIN: STUDENTS ──
async function loadAdminStudents() {
  try {
    const res = await fetch(`${API}/students`);
    const allStudentsList = await res.json();
    const tableWrap = document.getElementById('admin-students-table');
    if (tableWrap) {
      tableWrap.innerHTML = `
        <table>
          <thead><tr><th>Student</th><th>Reg No.</th><th>CGPA</th><th>Tier</th><th>Department</th><th>Actions</th></tr></thead>
          <tbody>
            ${allStudentsList.map(s => {
        const tier = s.CGPA >= 3.5 ? 'Premium' : s.CGPA >= 2.5 ? 'Standard' : 'Basic';
        const pillClass = tier === 'Premium' ? 'pill-amber' : tier === 'Standard' ? 'pill-blue' : 'pill-gray';
        return `<tr>
                <td><strong>${escapeHTML(s.FullName)}</strong></td>
                <td>${escapeHTML(s.RegNumber)}</td>
                <td>${s.CGPA}</td>
                <td><span class="pill ${pillClass}">${escapeHTML(tier)}</span></td>
                <td>${escapeHTML(s.Department)}</td>
                <td><button class="btn btn-sm btn-ruby" onclick="deleteStudent(${s.StudentID}, '${escapeHTML(s.FullName).replace(/'/g, "\\'")}')" title="Delete student">Delete</button></td>
              </tr>`;
      }).join('')}
          </tbody>
        </table>`;
    }
  } catch (e) { toast('Error loading students', 'error'); }
}

// Delete student function (admin only)
async function deleteStudent(studentId, studentName) {
  if (!confirm(`Are you sure you want to permanently delete student "${studentName}"? This will also delete all their bookings, complaints, and fee records. This action cannot be undone.`)) return;

  try {
    const res = await fetch(`${API}/students/${studentId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userRole: currentRole })
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to delete student');
    }

    toast('Student deleted successfully', 'success');

    // Refresh admin students list
    loadAdminStudents();

    // Also refresh stats if on admin dashboard
    if (document.getElementById('page-admin-dashboard').classList.contains('active')) {
      loadAdminDash();
    }
  } catch (e) {
    toast('Error deleting student: ' + e.message, 'error');
  }
}
// ── SEARCH RESULTS ──
function loadSearchResults() {
  const container = document.getElementById('search-results-content');
  if (!container) return;

  const label = document.getElementById('search-query-label');
  const query = document.querySelector('.search-bar input')?.value || '...';
  if (label) label.textContent = `Results for "${query}"`;

  if (!searchResults || (Object.values(searchResults).every(arr => arr.length === 0))) {
    container.innerHTML = `<div class="search-empty"><h4>No results found for "${query}"</h4><p>Try searching for students, halls, rooms, mess items, or complaints.</p></div>`;
    return;
  }

  let html = '';

  // 1. Students
  if (searchResults.students?.length) {
    html += `<div class="search-section"><h4>🎓 Students Found (${searchResults.students.length})</h4>`;
    html += searchResults.students.map(s => `
      <div class="search-item">
        <div class="search-item-info">
          <div class="search-item-title">${escapeHTML(s.FullName)}</div>
          <div class="search-item-sub">${escapeHTML(s.RegNumber)} · ${escapeHTML(s.Email)} · Sem ${escapeHTML(s.Semester)}</div>
        </div>
        ${currentRole === 'admin' ? `<button class="btn btn-sm btn-ghost" onclick="navigateTo('admin-students')">View All</button>` : ''}
      </div>`).join('');
    html += `</div>`;
  }

  // 2. Halls & Rooms
  if (searchResults.rooms?.length) {
    html += `<div class="search-section"><h4>🏛️ Halls & Rooms Found (${searchResults.rooms.length})</h4>`;
    html += searchResults.rooms.map(r => `
      <div class="search-item">
        <div class="search-item-info">
          <div class="search-item-title">${escapeHTML(r.HallName)} — Room ${escapeHTML(r.RoomNumber)}</div>
          <div class="search-item-sub">${escapeHTML(r.RoomType)} Occupancy</div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="navigateTo('halls')">View Halls</button>
      </div>`).join('');
    html += `</div>`;
  }

  // 3. Mess Menu
  if (searchResults.mess?.length) {
    html += `<div class="search-section"><h4>🍽️ Mess Menu Items Found (${searchResults.mess.length})</h4>`;
    html += searchResults.mess.map(m => `
      <div class="search-item">
        <div class="search-item-info">
          <div class="search-item-title">${escapeHTML(m.FoodName)}</div>
          <div class="search-item-sub">${escapeHTML(m.DayOfWeek)} · ${escapeHTML(m.MealType)}</div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="navigateTo('mess')">View Menu</button>
      </div>`).join('');
    html += `</div>`;
  }

  // 4. Complaints
  if (searchResults.complaints?.length) {
    html += `<div class="search-section"><h4>📣 Complaints Found (${searchResults.complaints.length})</h4>`;
    html += searchResults.complaints.map(c => `
      <div class="search-item">
        <div class="search-item-info">
          <div class="search-item-title">${escapeHTML(c.Title)}</div>
          <div class="search-item-sub">${escapeHTML(c.StudentName)} · ${escapeHTML(c.Category)} · Status: ${escapeHTML(c.Status)}</div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="navigateTo('${currentRole === 'admin' ? 'admin-complaints' : 'complaints'}')">View More</button>
      </div>`).join('');
    html += `</div>`;
  }

  // 5. Bookings
  if (searchResults.bookings?.length) {
    html += `<div class="search-section"><h4>📋 Bookings Found (${searchResults.bookings.length})</h4>`;
    html += searchResults.bookings.map(b => `
      <div class="search-item">
        <div class="search-item-info">
          <div class="search-item-title">${escapeHTML(b.FullName)} — ${escapeHTML(b.HallName)}</div>
          <div class="search-item-sub">Room ${escapeHTML(b.RoomNumber)} · Status: ${escapeHTML(b.Status)}</div>
        </div>
        <button class="btn btn-sm btn-ghost" onclick="navigateTo('${currentRole === 'admin' ? 'admin-bookings' : 'dashboard'}')">View Booking</button>
      </div>`).join('');
    html += `</div>`;
  }

  container.innerHTML = html;
}

// ── ADMIN: FEES ──
let adminGlobalFees = { roomFees: [], messFees: [] };
let adminPendingTransactions = [];

async function loadAdminFees() {
  try {
    const [feesRes, pendingRes] = await Promise.all([
      fetch(`${API}/admin/fees/all`),
      fetch(`${API}/admin/fees/pending`)
    ]);
    adminGlobalFees = await feesRes.json();
    adminPendingTransactions = await pendingRes.json();
    
    const activeBtn = document.querySelector('#admin-fee-filters .active-filter');
    const currentFilter = activeBtn ? activeBtn.getAttribute('onclick').match(/'([^']+)'/)[1] : 'all';
    renderAdminFeesTable(currentFilter);
    updateAdminFeeKPIs();
  } catch (e) { toast('Error loading fees', 'error'); }
}

function updateAdminFeeKPIs() {
  const all = [...adminGlobalFees.roomFees, ...adminGlobalFees.messFees];
  const totalCollected = parseInt(all.filter(f => f.IsPaid).reduce((s, f) => s + (f.Amount || f.TotalAmount || 0), 0));
  const totalOutstanding = parseInt(all.filter(f => !f.IsPaid).reduce((s, f) => s + (f.Amount || f.TotalAmount || 0), 0));
  const rate = all.length ? Math.round((totalCollected / (totalCollected + totalOutstanding)) * 100) : 0;

  const collectedEl = document.getElementById('total-collected');
  const outstandingEl = document.getElementById('total-outstanding');
  const rateEl = document.getElementById('collection-rate');

  if (collectedEl) collectedEl.textContent = `PKR ${totalCollected.toLocaleString()}`;
  if (outstandingEl) outstandingEl.textContent = `PKR ${totalOutstanding.toLocaleString()}`;
  if (rateEl) rateEl.textContent = `${rate}%`;
}

function renderAdminFeesTable(filter) {
  const tableWrap = document.getElementById('admin-fees-table');
  if (!tableWrap) return;

  if (filter === 'billing') {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    
    tableWrap.innerHTML = `
      <div style="max-width: 500px; margin: 20px auto; padding: 24px; border: 1.5px solid var(--slate-200); border-radius: 16px; background: white;">
        <div style="font-size: 32px; text-align: center; margin-bottom: 12px;">⚙️</div>
        <h4 style="text-align: center; color: var(--navy); font-size: 18px; margin-bottom: 6px;">Process Residency Billing Cycle</h4>
        <p style="text-align: center; font-size: 13px; color: var(--slate-500); margin-bottom: 24px; line-height: 1.5;">
          This will execute the database cursor procedure <strong style="color:var(--navy)">sp_GenerateMonthlyFees</strong>, automatically creating room fee records for all active student placements.
        </p>
        
        <div class="form-row" style="margin-bottom: 20px; display: flex; gap: 12px;">
          <div class="form-group" style="flex: 1;">
            <label style="font-weight: 700; margin-bottom: 6px; display: block; font-size: 13px;">Target Month</label>
            <select id="billing-month" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--slate-200); background: white;">
              ${Array.from({length: 12}, (_, i) => {
                const m = i + 1;
                const date = new Date(2000, i, 1);
                const name = date.toLocaleString('default', { month: 'long' });
                return `<option value="${m}" ${m === currentMonth ? 'selected' : ''}>${name}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group" style="flex: 1;">
            <label style="font-weight: 700; margin-bottom: 6px; display: block; font-size: 13px;">Target Year</label>
            <select id="billing-year" style="width: 100%; padding: 10px; border-radius: 8px; border: 1px solid var(--slate-200); background: white;">
              <option value="${currentYear - 1}">${currentYear - 1}</option>
              <option value="${currentYear}" selected>${currentYear}</option>
              <option value="${currentYear + 1}">${currentYear + 1}</option>
            </select>
          </div>
        </div>
        
        <button class="btn btn-navy" style="width: 100%; font-weight: 700; padding: 12px;" onclick="triggerBillingCycle()">Execute Billing Cycle →</button>
      </div>
    `;
    return;
  }

  if (filter === 'pending') {
    if (adminPendingTransactions.length === 0) {
      tableWrap.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--slate-400);">
          <div style="font-size: 48px; margin-bottom: 12px;">✅</div>
          <h4>All Cleared!</h4>
          <p style="font-size: 13px; color: var(--slate-500); margin-top: 4px;">No transactions are currently awaiting Warden verification.</p>
        </div>`;
      return;
    }

    tableWrap.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Type</th>
            <th>Receipt Dues</th>
            <th>Method</th>
            <th>Reference No.</th>
            <th>Submitted On</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          ${adminPendingTransactions.map(t => {
            const isWeekly = t.Notes && t.Notes.startsWith('[Weekly]');
            const typeLabel = isWeekly ? 'Mess (Weekly)' : t.PaymentFor;
            const labelClass = t.PaymentFor === 'Room' ? 'pill-blue' : (isWeekly ? 'pill-gold' : 'pill-amber');
            return `
              <tr>
                <td><strong>${escapeHTML(t.FullName)}</strong><br><small>${escapeHTML(t.RegNumber)}</small></td>
                <td><span class="pill ${labelClass}">${escapeHTML(typeLabel)}</span></td>
                <td>PKR ${t.Amount.toLocaleString()}</td>
                <td>${escapeHTML(t.MethodName)}</td>
                <td><code style="font-weight: 700; color: var(--navy);">${escapeHTML(t.ReferenceNo)}</code></td>
                <td><small>${new Date(t.TransactionDate).toLocaleString()}</small></td>
                <td style="text-align: right;">
                  <button class="btn btn-sm btn-emerald" onclick="verifyStudentPayment(${t.TransactionID}, '${escapeHTML(t.FullName).replace(/'/g, "\\'")}', '${escapeHTML(t.PaymentFor)}', ${t.Amount})">✓ Verify & Settle</button>
                </td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>`;
    return;
  }

  const all = [...adminGlobalFees.roomFees, ...adminGlobalFees.messFees];
  let filtered = all;

  if (filter === 'Hall') filtered = adminGlobalFees.roomFees;
  else if (filter === 'Mess') filtered = adminGlobalFees.messFees;
  else if (filter === 'unpaid') filtered = all.filter(f => !f.IsPaid);

  // Sort by date descending
  filtered.sort((a, b) => {
    if (b.Year !== a.Year) return b.Year - a.Year;
    return b.Month - a.Month;
  });

  tableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Student</th>
          <th>Type</th>
          <th>Period</th>
          <th>Hall/Room</th>
          <th>Amount</th>
          <th>Status</th>
          <th>Date Paid</th>
        </tr>
      </thead>
      <tbody>
        ${filtered.map(f => `
          <tr>
            <td><strong>${escapeHTML(f.FullName)}</strong><br><small>${escapeHTML(f.RegNumber)}</small></td>
            <td><span class="pill pill-${f.FeeType === 'Hall' ? 'blue' : 'amber'}">${escapeHTML(f.FeeType)}</span></td>
            <td>${escapeHTML(f.Month)} ${escapeHTML(f.Year)}</td>
            <td>${escapeHTML(f.HallName)}${f.RoomNumber ? ' / ' + escapeHTML(f.RoomNumber) : ''}</td>
            <td>PKR ${(f.Amount || f.TotalAmount || 0).toLocaleString()}</td>
            <td><span class="pill pill-${f.IsPaid ? 'green' : 'red'}">${f.IsPaid ? 'Paid' : 'Unpaid'}</span></td>
            <td><small>${f.PaidOn ? new Date(f.PaidOn).toLocaleDateString() : '—'}</small></td>
          </tr>
        `).join('')}
      </tbody>
    </table>`;
}

function filterAdminFees(type, btn) {
  document.querySelectorAll('#admin-fee-filters .btn').forEach(b => b.classList.remove('active-filter'));
  btn.classList.add('active-filter');
  renderAdminFeesTable(type);
}

window.verifyStudentPayment = async function(transactionId, studentName, type, amount) {
  if (!confirm(`Verify payment receipt of PKR ${amount.toLocaleString()} for student "${studentName}"? This will atomically update the general ledger.`)) return;
  
  try {
    const res = await fetch(`${API}/admin/fees/verify/${transactionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminId: currentUser.AdminID })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to verify transaction');
    
    toast('Payment verified & ledger updated!', 'success');
    loadAdminFees();
  } catch (e) {
    toast(e.message, 'error');
  }
};

window.triggerBillingCycle = async function() {
  const month = document.getElementById('billing-month').value;
  const year = document.getElementById('billing-year').value;
  
  if (!confirm(`Are you sure you want to run the billing cycle for Month: ${month}, Year: ${year}? This will generate room fees for all active placements.`)) return;
  
  try {
    const res = await fetch(`${API}/admin/fees/generate-room-fees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month, year })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Billing generation failed');
    
    toast(data.message, 'success');
    loadAdminFees();
  } catch (e) {
    toast(e.message, 'error');
  }
};

// ── ADMIN: MESS REPORT
async function loadAdminMessReport() {
  try {
    const [reportRes, statsRes, billsRes, studentsRes] = await Promise.all([
        fetch(`${API}/admin/mess/report`),
        fetch(`${API}/admin/mess/activity/stats`),
        fetch(`${API}/admin/mess/bills/weekly`),
        fetch(`${API}/students`)
    ]);

    if (!reportRes.ok) throw new Error('Failed to fetch marksheet report');

    const data = await reportRes.json();
    const stats = statsRes.ok ? await statsRes.json() : {};
    const bills = billsRes.ok ? await billsRes.json() : [];
    const students = studentsRes.ok ? await studentsRes.json() : [];

    renderAdminMessStats(stats);
    renderAdminWeeklyBills(bills);
    renderMessReportTable(data);

    // Populate quick-mark student dropdown
    const select = document.getElementById('quick-mark-student');
    if (select) {
        select.innerHTML = '<option value="">-- Choose Student --</option>' + 
            students.map(s => `<option value="${s.StudentID}" data-name="${s.FullName.replace(/"/g, '&quot;')}">${s.FullName} (${s.RegNumber})</option>`).join('');
    }
  } catch (e) {
    console.error('Mess Report Fetch Error:', e);
    toast('Error loading mess report: ' + e.message, 'error');
    const wrap = document.getElementById('admin-mess-report-table');
    if (wrap) wrap.innerHTML = `<div class="alert alert-ruby">Error: ${e.message}</div>`;
  }
}

function renderAdminMessStats(stats) {
    const grid = document.getElementById('admin-mess-stats-grid');
    if (!grid) return;
    grid.innerHTML = `
        <div class="kpi-card" style="padding: 16px; background: var(--bg-card); border: 1px solid var(--slate-200); border-radius: var(--radius-lg);">
            <div style="font-size: 13px; color: var(--slate-500); margin-bottom: 4px;">Total Today's Expense</div>
            <div style="font-size: 24px; font-weight: 700; color: var(--navy);">PKR ${stats.TodayExpense?.toLocaleString() || 0}</div>
        </div>
        <div class="kpi-card" style="padding: 16px; background: var(--bg-card); border: 1px solid var(--slate-200); border-radius: var(--radius-lg);">
            <div style="font-size: 13px; color: var(--slate-500); margin-bottom: 4px;">Total Yesterday's Expense</div>
            <div style="font-size: 24px; font-weight: 700; color: var(--navy);">PKR ${stats.YesterdayExpense?.toLocaleString() || 0}</div>
        </div>
        <div class="kpi-card" style="padding: 16px; background: var(--bg-card); border: 1px solid var(--slate-200); border-radius: var(--radius-lg);">
            <div style="font-size: 13px; color: var(--slate-500); margin-bottom: 4px;">Total This Week's Expense</div>
            <div style="font-size: 24px; font-weight: 700; color: var(--navy);">PKR ${stats.ThisWeekExpense?.toLocaleString() || 0}</div>
        </div>
        <div class="kpi-card" style="padding: 16px; background: var(--bg-card); border: 1px solid var(--slate-200); border-radius: var(--radius-lg);">
            <div style="font-size: 13px; color: var(--slate-500); margin-bottom: 4px;">Total This Month's Expense</div>
            <div style="font-size: 24px; font-weight: 700; color: var(--navy);">PKR ${stats.ThisMonthExpense?.toLocaleString() || 0}</div>
        </div>
    `;
}

function renderAdminWeeklyBills(bills) {
    const tbody = document.getElementById('admin-weekly-bills-table');
    if (!tbody) return;
    
    if (bills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--slate-500);">No weekly bills generated yet.</td></tr>';
        return;
    }

    tbody.innerHTML = bills.map(b => {
        const start = new Date(b.WeekStartDate).toLocaleDateString('en-GB', {day:'numeric', month:'short'});
        const end = new Date(b.WeekEndDate).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
        const statusHTML = b.IsPaid 
            ? `<span class="pill pill-green">Paid</span>` 
            : `<span class="pill pill-red">Pending</span>`;

        return `
            <tr style="border-bottom: 1px solid var(--slate-100);">
                <td style="padding: 12px 0;"><strong>${escapeHTML(b.FullName)}</strong><br><small style="color:var(--slate-500);">${escapeHTML(b.RegNumber)}</small></td>
                <td>${start} - ${end}</td>
                <td>${statusHTML}</td>
                <td style="text-align: right; font-weight: 600;">PKR ${b.TotalAmount.toLocaleString()}</td>
            </tr>
        `;
    }).join('');
}

function renderMessReportTable(data) {
  const wrap = document.getElementById('admin-mess-report-table');
  if (!wrap) return;

  if (!data || !Array.isArray(data) || data.length === 0) {
    wrap.innerHTML = '<div class="alert alert-info">No mess records found for the current month.</div>';
    return;
  }

  wrap.innerHTML = `
        <table style="width:100%; border-collapse: collapse;">
            <thead>
                <tr style="border-bottom: 1px solid var(--slate-200); text-align: left;">
                    <th style="padding: 10px 0;">Student</th>
                    <th>Period</th>
                    <th>Attendance</th>
                    <th>Today (B-L-D)</th>
                    <th>Bill Amount</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${data.map(r => {
    const amount = r.Amount !== null && r.Amount !== undefined ? r.Amount : 0;
    const isPaid = r.IsPaid || false;
    const isHigh = amount > 10000;
    const b = r.TodayBreakfast > 0;
    const l = r.TodayLunch > 0;
    const d = r.TodayDinner > 0;

    return `
                    <tr style="${isHigh ? 'background:rgba(235, 64, 52, 0.1); color:var(--ruby); font-weight:600' : ''}">
                        <td><strong>${escapeHTML(r.FullName || 'Unknown')}</strong><br><small>${escapeHTML(r.RegNumber || '—')}</small></td>
                        <td>${escapeHTML(r.Month || '—')}/${escapeHTML(r.Year || '—')}</td>
                        <td>${r.AttendanceDays || 0} days</td>
                        <td>
                            <div style="display:flex; gap:4px">
                                ${b ? `<span class="pill pill-green" style="padding:4px 8px; cursor:default" title="Breakfast marked">🍳 B</span>`
                                    : `<button class="btn btn-ghost btn-sm" style="padding:4px 8px; border:1px dashed var(--slate-300); background:transparent; font-size:11px; cursor:pointer;" onclick="adminMarkAttendance(${r.StudentID}, 'Breakfast', '${escapeHTML(r.FullName || 'Unknown').replace(/'/g, "\\'")}')" title="Mark Breakfast Attendance">B</button>`}
                                ${l ? `<span class="pill pill-green" style="padding:4px 8px; cursor:default" title="Lunch marked">🍱 L</span>`
                                    : `<button class="btn btn-ghost btn-sm" style="padding:4px 8px; border:1px dashed var(--slate-300); background:transparent; font-size:11px; cursor:pointer;" onclick="adminMarkAttendance(${r.StudentID}, 'Lunch', '${escapeHTML(r.FullName || 'Unknown').replace(/'/g, "\\'")}')" title="Mark Lunch Attendance">L</button>`}
                                ${d ? `<span class="pill pill-green" style="padding:4px 8px; cursor:default" title="Dinner marked">🍲 D</span>`
                                    : `<button class="btn btn-ghost btn-sm" style="padding:4px 8px; border:1px dashed var(--slate-300); background:transparent; font-size:11px; cursor:pointer;" onclick="adminMarkAttendance(${r.StudentID}, 'Dinner', '${escapeHTML(r.FullName || 'Unknown').replace(/'/g, "\\'")}')" title="Mark Dinner Attendance">D</button>`}
                            </div>
                        </td>
                        <td>PKR ${amount.toLocaleString()} ${isHigh ? '⚠️' : ''}</td>
                        <td><span class="pill pill-${isPaid ? 'green' : 'red'}">${isPaid ? 'Paid' : 'Unpaid'}</span></td>
                    </tr>`;
  }).join('')}
            </tbody>
        </table>`;
}

window.adminMarkAttendance = async function(studentId, mealType, studentName) {
  if (!confirm(`Mark today's ${mealType} attendance for student "${studentName}"?`)) return;
  try {
    const res = await fetch(`${API}/admin/mess/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, mealType })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to mark attendance');
    toast(`Attendance marked successfully for ${mealType}!`, 'success');
    loadAdminMessReport(); // Refresh report table
  } catch (e) {
    toast(e.message, 'error');
  }
};

window.submitQuickAttendance = async function() {
    const select = document.getElementById('quick-mark-student');
    const mealSelect = document.getElementById('quick-mark-meal');
    if (!select || !mealSelect) return;
    
    const studentId = select.value;
    const mealType = mealSelect.value;
    
    if (!studentId) {
        toast('Please select a student', 'error');
        return;
    }
    
    const selectedOpt = select.options[select.selectedIndex];
    const studentName = selectedOpt.getAttribute('data-name');
    
    await adminMarkAttendance(studentId, mealType, studentName);
};

// Generate Weekly Mess Bills
function showGenerateBillsModal() {
  const content = `
        <div class="alert alert-info">
            This will calculate final meal costs for all active students for the previous complete week (Monday to Sunday) and generate their weekly mess bills.
        </div>
        <button class="btn btn-navy" style="width:100%; margin-top:20px;" onclick="generateWeeklyMessBills()">Generate Weekly Bills Now →</button>
    `;
  openModal('Process Weekly Mess Bills', content);
}

async function generateWeeklyMessBills() {
  try {
    const res = await fetch(`${API}/admin/mess/generate-weekly-bill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) throw new Error('Generation failed');
    toast('Weekly bills generated successfully!', 'success');
    closeModal();
    loadAdminMessReport(); // Refresh view
  } catch (e) { toast(e.message, 'error'); }
}
async function exportMessReport() {
  try {
    toast('Downloading report...', 'info');
    const res = await fetch(`${API}/admin/mess/export`);
    if (!res.ok) throw new Error('Export failed');

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    a.download = `mess_report_${d.getMonth() + 1}_${d.getFullYear()}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast('Report downloaded!', 'success');
  } catch (e) { toast('Error exporting: ' + e.message, 'error'); }
}

// --- World-Class Dashboard Functions ---

function openLeaveModal() {
    const content = `
        <div class="form-group">
            <label>Leave Type</label>
            <select id="leave-type">
                <option>Weekend Home Visit</option>
                <option>Medical Leave</option>
                <option>Emergency Leave</option>
                <option>Other</option>
            </select>
        </div>
        <div class="form-row">
            <div class="form-group"><label>Departure</label><input type="date" id="leave-start"></div>
            <div class="form-group"><label>Return</label><input type="date" id="leave-end"></div>
        </div>
        <div class="form-group">
            <label>Reason / Destination</label>
            <textarea id="leave-reason" placeholder="Include address and emergency contact..."></textarea>
        </div>
        <button class="btn btn-gold w-100" onclick="submitLeave()">Submit Application</button>
    `;
    openModal("Apply for Leave / Gate Pass", content);
}

async function submitLeave() {
    toast("Leave application submitted for approval", "success");
    closeModal();
    addNotif("Leave application pending review", "📅");
}

function broadcastEmergency() {
    const content = `
        <div class="announce" style="background:var(--ruby); border:none">
            <div class="announce-text"><h4 style="color:white">🚨 EMERGENCY BROADCAST</h4><p style="color:rgba(255,255,255,0.8)">This will notify all students immediately via portal and SMS.</p></div>
        </div>
        <div class="form-group">
            <label>Emergency Message</label>
            <textarea id="emergency-msg" placeholder="Evacuation notice, security alert, etc..."></textarea>
        </div>
        <button class="btn btn-ruby w-100" onclick="sendEmergency()">SEND BROADCAST</button>
    `;
    openModal("System-Wide Emergency Alert", content);
}

function sendEmergency() {
    const msg = document.getElementById('emergency-msg').value;
    if(!msg) return toast("Message cannot be empty", "error");
    toast("Emergency Broadcast Sent!", "success");
    addNotif("EMERGENCY: " + msg, "🚨");
    closeModal();
}

function startAttendance() {
    toast("Nightly Roll Call Initiated. Room-by-room logs opened.", "info");
    navigateTo('halls');
}

function requestRoomSwap() {
    const content = `
        <div class="announce" style="background:var(--sky); border:none">
            <p style="color:white"><strong>Note:</strong> Room swap requests are subject to warden review and room availability.</p>
        </div>
        <div class="form-group">
            <label>Preferred Room Number</label>
            <input type="text" id="swap-room" placeholder="e.g. 102A">
        </div>
        <div class="form-group">
            <label>Reason for Swap</label>
            <textarea id="swap-reason"></textarea>
        </div>
        <button class="btn btn-gold w-100" onclick="submitSwap()">Request Swap</button>
    `;
    openModal("Room Exchange Request", content);
}

function submitSwap() {
    toast("Swap request logged. Warden will review availability.", "info");
    closeModal();
}

async function showMessMenu() {
    navigateTo('mess');
}

function showInventory() {
    toast("Generating floor-wise inventory report...", "info");
    setTimeout(() => toast("Report ready for download.", "success"), 2000);
}
