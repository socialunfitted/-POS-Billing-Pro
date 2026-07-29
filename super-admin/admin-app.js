/**
 * ============================================================
 * SUPER ADMIN DASHBOARD APPLICATION CONTROLLER (admin-app.js)
 * Comprehensive Subscriptions Manager, Multi-Filter Search,
 * Atomic Modals, Live KPIs, Realtime Broadcaster & CSV Exporter
 * ============================================================
 */
class SuperAdminApp {
  constructor() {
    this.currentRoute = '#/dashboard';
    this.subFilter = 'All';
    this.subSearchQuery = '';
    this.bizSearchQuery = '';
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.setupTheme();
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
      document.addEventListener(evt, () => this.updateAdminFullscreenUI());
    });
    this.handleRoute();
    console.log('Super Admin Subscription Control Engine Initialized.');
  }

  setupTheme() {
    const savedTheme = localStorage.getItem('super_admin_theme') || 'dark';
    document.body.setAttribute('data-admin-theme', savedTheme);
  }

  toggleTheme() {
    const cur = document.body.getAttribute('data-admin-theme') || 'dark';
    const nxt = cur === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-admin-theme', nxt);
    localStorage.setItem('super_admin_theme', nxt);
    this.showToast(`Theme switched to ${nxt.toUpperCase()} mode`);
  }

  toggleFullscreen() {
    if (!document.fullscreenElement && !document.mozFullScreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(err => console.log('Fullscreen error:', err));
      } else if (docEl.mozRequestFullScreen) {
        docEl.mozRequestFullScreen();
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(err => console.log('Exit fullscreen error:', err));
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    }
  }

  updateAdminFullscreenUI() {
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    const btnText = document.getElementById('btnAdminFullscreenText');
    const btn = document.getElementById('btnAdminFullscreen');
    if (btnText) {
      btnText.textContent = isFS ? 'Exit Full Screen' : 'Full Screen';
    }
    if (btn) {
      btn.title = isFS ? 'Exit Full Screen' : 'Toggle Full Screen';
    }
  }

  /**
   * Router Handling with Authorization Check
   */
  handleRoute() {
    const hash = window.location.hash || '#/dashboard';
    this.currentRoute = hash;

    const authContainer = document.getElementById('adminAuthContainer');
    const mainContainer = document.getElementById('adminMainContainer');

    if (!window.SuperAdminAuth.isAuthenticated()) {
      if (authContainer) authContainer.style.display = 'flex';
      if (mainContainer) mainContainer.style.display = 'none';
      this.renderLoginView();
      return;
    }

    if (authContainer) authContainer.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'flex';

    // Highlight active menu item
    document.querySelectorAll('.menu-item').forEach(el => {
      const targetRoute = el.getAttribute('href');
      el.classList.toggle('active', targetRoute === hash);
    });

    const routeTitleMap = {
      '#/dashboard': 'Executive Subscription Dashboard',
      '#/businesses': 'Business Directory & Accounts',
      '#/subscriptions': 'Subscriptions Master Control Panel',
      '#/plans': 'Plan Catalog & Pricing Matrix',
      '#/payments': 'Payment Verification & Billing Queue',
      '#/licenses': 'License Key & Device Management',
      '#/reports': 'Revenue Analytics & Growth Reports',
      '#/notifications': 'Business Notifications & Alerts',
      '#/audit-log': 'Immutable Security Audit Logs',
      '#/settings': 'Super Admin & Supabase Settings'
    };

    const titleElem = document.getElementById('navPageTitle');
    if (titleElem) titleElem.textContent = routeTitleMap[hash] || 'Super Admin Dashboard';

    // Route dispatch
    if (hash === '#/dashboard') this.renderDashboardView();
    else if (hash === '#/businesses') this.renderBusinessesView();
    else if (hash === '#/subscriptions') this.renderSubscriptionsView();
    else if (hash === '#/plans') this.renderPlansView();
    else if (hash === '#/payments') this.renderPaymentsView();
    else if (hash === '#/licenses') this.renderLicensesView();
    else if (hash === '#/reports') this.renderReportsView();
    else if (hash === '#/notifications') this.renderNotificationsView();
    else if (hash === '#/audit-log') this.renderAuditLogView();
    else if (hash === '#/settings') this.renderSettingsView();
  }

  // --- LOGIN VIEW ---
  renderLoginView() {
    const container = document.getElementById('adminAuthContainer');
    if (!container) return;

    container.innerHTML = `
      <div class="auth-card">
        <div class="auth-logo-group">
          <div class="auth-logo-icon">⚡</div>
          <div>
            <div class="auth-title">Super Admin Portal</div>
            <div class="auth-subtitle">POS Billing Subscription Management System</div>
          </div>
        </div>

        <form id="adminLoginForm" onsubmit="adminApp.handleLoginSubmit(event)" style="display:flex; flex-direction:column; gap:14px;">
          <div class="form-group">
            <label class="form-label">Super Admin Email</label>
            <input type="email" id="loginEmail" class="form-control" value="admin@posbilling.com" placeholder="admin@posbilling.com" required autocomplete="username">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" id="loginPassword" class="form-control" value="SuperAdmin2026!" placeholder="••••••••" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn-admin btn-primary" style="padding:12px; justify-content:center; font-size:14px; margin-top:8px;">
            🔒 Secure Admin Login
          </button>
        </form>

        <div style="font-size:11px; color:var(--admin-text-muted); text-align:center; border-top:1px solid var(--admin-border); padding-top:12px;">
          Default Login: <b>admin@posbilling.com</b> | Pass: <b>SuperAdmin2026!</b>
        </div>
      </div>
    `;
  }

  async handleLoginSubmit(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      await window.SuperAdminAuth.login(email, password);
      this.showToast('Super Admin Authentication Successful!', 'success');
      window.location.hash = '#/dashboard';
      this.handleRoute();
    } catch (err) {
      alert('Authentication Error: ' + err.message);
    }
  }

  // --- DASHBOARD VIEW ---
  renderDashboardView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const businesses = window.SuperAdminDB.getBusinesses();
    const subs = window.SuperAdminDB.getSubscriptions();
    const payments = window.SuperAdminDB.getPayments();

    const activeCount = subs.filter(s => s.status === 'Active').length;
    const trialCount = subs.filter(s => s.status === 'Trial').length;
    const expiredCount = subs.filter(s => s.status === 'Expired').length;
    const pendingPayments = payments.filter(p => p.status === 'Pending Verification').length;

    let totalRevenue = 0;
    payments.filter(p => p.status === 'Verified').forEach(p => totalRevenue += parseFloat(p.amount) || 0);

    body.innerHTML = `
      <!-- KPI CARDS -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-title">TOTAL BUSINESSES</div>
          <div class="kpi-val">${businesses.length}</div>
          <div class="kpi-sub">🏢 Registered Accounts</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">ACTIVE SUBSCRIPTIONS</div>
          <div class="kpi-val" style="color:var(--admin-success);">${activeCount}</div>
          <div class="kpi-sub">🟢 Paying Accounts</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">TRIAL USERS</div>
          <div class="kpi-val" style="color:var(--admin-primary);">${trialCount}</div>
          <div class="kpi-sub">⏳ Active Trials</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">EXPIRED / SUSPENDED</div>
          <div class="kpi-val" style="color:var(--admin-danger);">${expiredCount}</div>
          <div class="kpi-sub">🔴 Needs Renewal</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">TOTAL REVENUE</div>
          <div class="kpi-val" style="color:var(--admin-purple);">₹${totalRevenue.toLocaleString()}</div>
          <div class="kpi-sub">💰 Verified Payments</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">PENDING PAYMENTS</div>
          <div class="kpi-val" style="color:var(--admin-warning);">${pendingPayments}</div>
          <div class="kpi-sub">📥 Awaiting Approval</div>
        </div>
      </div>

      <!-- CHARTS -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <div class="card-box">
          <div class="box-header"><div class="box-title">📊 Revenue Growth Trends</div></div>
          <div class="chart-box"><canvas id="revenueChartCanvas"></canvas></div>
        </div>

        <div class="card-box">
          <div class="box-header"><div class="box-title">🛍️ Plan Popularity Distribution</div></div>
          <div class="chart-box"><canvas id="planChartCanvas"></canvas></div>
        </div>
      </div>
    `;

    setTimeout(() => {
      this.renderRevenueChart();
      this.renderPlanChart();
    }, 100);
  }

  renderRevenueChart() {
    const canvas = document.getElementById('revenueChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 240;

    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    for (let y = 30; y < h; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    const points = [
      {x: 20, y: h - 30}, {x: w * 0.25, y: h - 70}, {x: w * 0.5, y: h - 120},
      {x: w * 0.75, y: h - 100}, {x: w - 20, y: h - 180}
    ];

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.lineTo(points[points.length - 1].x, h - 20);
    ctx.lineTo(points[0].x, h - 20);
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 3; ctx.stroke();
  }

  renderPlanChart() {
    const canvas = document.getElementById('planChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 240;

    const centerX = w / 2, centerY = h / 2, radius = 70;
    const data = [
      { label: 'Starter (₹99)', val: 30, color: '#3b82f6' },
      { label: 'Standard (₹199)', val: 45, color: '#10b981' },
      { label: 'Premium (₹399)', val: 20, color: '#8b5cf6' },
      { label: 'Enterprise (₹799)', val: 5, color: '#f59e0b' }
    ];

    let total = 0; data.forEach(d => total += d.val);
    let startAngle = 0;
    data.forEach(d => {
      const sliceAngle = (d.val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, radius - 25, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      startAngle += sliceAngle;
    });
  }

  // --- BUSINESSES VIEW ---
  renderBusinessesView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const businesses = window.SuperAdminDB.getBusinesses();

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header">
          <div class="box-title">🏢 Business Directory & Accounts</div>
          <button class="btn-admin btn-primary" onclick="adminApp.openCreateBusinessModal()">+ Create Business</button>
        </div>

        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Owner & Contact</th>
                <th>City</th>
                <th>Status</th>
                <th>Registered Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${businesses.map(b => `
                <tr>
                  <td><b>${b.name}</b><br><span style="font-size:11px; color:var(--admin-text-muted);">ID: ${b.id}</span></td>
                  <td><b>${b.ownerName}</b><br><span style="font-size:11px; color:var(--admin-text-sub);">${b.email} • ${b.phone}</span></td>
                  <td>${b.city || 'N/A'}</td>
                  <td><span class="status-pill pill-${b.status.toLowerCase()}">${b.status}</span></td>
                  <td>${new Date(b.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn-admin btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="adminApp.openBusinessDetailsModal('${b.id}')">👁️ View Details</button>
                      <button class="btn-admin btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="adminApp.openCustomSuspendModal('${b.id}')">⏸️ Suspend</button>
                      <button class="btn-admin btn-success" style="padding:4px 8px; font-size:11px;" onclick="adminApp.activateBusiness('${b.id}')">▶️ Activate</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  openBusinessDetailsModal(bizId) {
    const bizList = window.SuperAdminDB.getBusinesses();
    const subList = window.SuperAdminDB.getSubscriptions();
    const licList = window.SuperAdminDB.getLicenses();
    const planList = window.SuperAdminDB.getPlans();

    const biz = bizList.find(b => b.id === bizId);
    const sub = subList.find(s => s.businessId === bizId) || {};
    const lic = licList.find(l => l.businessId === bizId) || {};
    const plan = planList.find(p => p.id === sub.planId) || { name: 'Starter POS', monthlyPrice: 99, yearlyPrice: 999 };

    const modal = document.getElementById('adminModalBox');
    if (!modal || !biz) return;

    modal.innerHTML = `
      <div class="admin-modal-header">
        <div class="box-title">🏢 Business Profile & Embedded Subscription Card</div>
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">✕</button>
      </div>

      <div class="admin-modal-body" style="display:flex; flex-direction:column; gap:14px;">
        <div style="background:var(--admin-card-hover); border:1px solid var(--admin-border); padding:14px; border-radius:8px; display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div><span style="color:var(--admin-text-muted); font-size:11px;">BUSINESS NAME:</span><br><b>${biz.name}</b></div>
          <div><span style="color:var(--admin-text-muted); font-size:11px;">BUSINESS ID:</span><br><b style="font-family:monospace; color:var(--admin-primary);">${biz.id}</b></div>
          <div><span style="color:var(--admin-text-muted); font-size:11px;">OWNER:</span><br><b>${biz.ownerName}</b></div>
          <div><span style="color:var(--admin-text-muted); font-size:11px;">PHONE / EMAIL:</span><br><b>${biz.phone}</b> / ${biz.email}</div>
        </div>

        <!-- EMBEDDED SUBSCRIPTION CARD -->
        <div style="background:linear-gradient(135deg, rgba(59,130,246,0.1), rgba(139,92,246,0.1)); border:1px solid var(--admin-primary); padding:16px; border-radius:10px; display:flex; flex-direction:column; gap:10px;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:11px; color:var(--admin-text-sub); font-weight:700;">CURRENT POS SUBSCRIPTION CARD</div>
              <div style="font-size:18px; font-weight:800; color:var(--admin-primary);">${plan.name}</div>
            </div>
            <span class="status-pill pill-${(sub.status || 'trial').toLowerCase()}">${sub.status || 'Trial'}</span>
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; font-size:12px;">
            <div><span style="color:var(--admin-text-muted);">Monthly Fee:</span> <b>₹${plan.monthlyPrice}</b></div>
            <div><span style="color:var(--admin-text-muted);">Yearly Fee:</span> <b>₹${plan.yearlyPrice}</b></div>
            <div><span style="color:var(--admin-text-muted);">Billing Cycle:</span> <b>${sub.billingCycle || 'Monthly'}</b></div>
            <div><span style="color:var(--admin-text-muted);">Expiration Date:</span> <b>${sub.expiresAt ? new Date(sub.expiresAt).toLocaleDateString() : 'N/A'}</b></div>
            <div><span style="color:var(--admin-text-muted);">License Key:</span> <code style="color:var(--admin-success);">${lic.licenseKey || 'N/A'}</code></div>
            <div><span style="color:var(--admin-text-muted);">Device Limit:</span> <b>${lic.activeDevices || 0} / ${lic.maxDevices || 3}</b></div>
          </div>

          <div style="display:flex; gap:8px; margin-top:6px; flex-wrap:wrap;">
            <button class="btn-admin btn-success" onclick="adminApp.closeModal(); adminApp.openCustomRenewModal('${biz.id}')">💳 Renew Subscription</button>
            <button class="btn-admin btn-primary" onclick="adminApp.closeModal(); adminApp.openCustomUpgradeModal('${biz.id}')">⚡ Change Plan</button>
            <button class="btn-admin btn-secondary" onclick="adminApp.closeModal(); adminApp.openCustomSuspendModal('${biz.id}')">⏸️ Suspend Account</button>
          </div>
        </div>
      </div>
    `;

    this.openModal();
  }

  // --- SUBSCRIPTIONS MASTER VIEW ---
  renderSubscriptionsView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const subs = window.SuperAdminDB.getSubscriptions();
    const businesses = window.SuperAdminDB.getBusinesses();
    const plans = window.SuperAdminDB.getPlans();
    const licenses = window.SuperAdminDB.getLicenses();
    const payments = window.SuperAdminDB.getPayments();

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header">
          <div class="box-title">📜 Subscriptions Master Control Panel</div>
          <div style="display:flex; gap:8px;">
            <button class="btn-admin btn-secondary" onclick="adminApp.exportSubscriptionsCSV()">📥 Export CSV</button>
          </div>
        </div>

        <!-- SEARCH & MULTI-FILTER TOOLBAR -->
        <div style="display:flex; flex-direction:column; gap:12px; margin-bottom:16px;">
          <div class="global-search-bar" style="max-width:100%;">
            <span>🔍</span>
            <input type="text" id="subSearchInput" placeholder="Search Business Name, Business ID, Phone, Email, License Key..." onkeyup="adminApp.filterSubscriptionsTable()">
          </div>

          <div class="filter-toolbar" style="display:flex; flex-wrap:wrap; gap:6px;" id="subFilterContainer">
            <div class="filter-chip active" onclick="adminApp.setSubFilter('All', this)">All</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Trial', this)">Trial</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Active', this)">Active</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Expired', this)">Expired</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Suspended', this)">Suspended</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Starter', this)">Starter</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Standard', this)">Standard</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Premium', this)">Premium</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Enterprise', this)">Enterprise</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Monthly', this)">Monthly</div>
            <div class="filter-chip" onclick="adminApp.setSubFilter('Yearly', this)">Yearly</div>
          </div>
        </div>

        <!-- DATA TABLE -->
        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Business ID</th>
                <th>Owner Name & Contact</th>
                <th>Current Plan</th>
                <th>Cycle</th>
                <th>Status</th>
                <th>Activation Date</th>
                <th>Expiry Date</th>
                <th>Days Left</th>
                <th>License Key</th>
                <th>Payment</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="subscriptionsTableBody">
              ${this.renderSubscriptionsRows(subs, businesses, plans, licenses, payments)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderSubscriptionsRows(subs, businesses, plans, licenses, payments) {
    let list = [...subs];

    // Apply Filter
    if (this.subFilter !== 'All') {
      const f = this.subFilter.toLowerCase();
      list = list.filter(s => {
        const plan = plans.find(p => p.id === s.planId) || {};
        return (
          s.status.toLowerCase() === f ||
          s.billingCycle.toLowerCase() === f ||
          (plan.name && plan.name.toLowerCase().includes(f))
        );
      });
    }

    // Apply Search Query
    if (this.subSearchQuery) {
      const q = this.subSearchQuery.toLowerCase();
      list = list.filter(s => {
        const biz = businesses.find(b => b.id === s.businessId) || {};
        const lic = licenses.find(l => l.businessId === s.businessId) || {};
        return (
          (biz.name && biz.name.toLowerCase().includes(q)) ||
          (biz.id && biz.id.toLowerCase().includes(q)) ||
          (biz.phone && biz.phone.toLowerCase().includes(q)) ||
          (biz.email && biz.email.toLowerCase().includes(q)) ||
          (lic.licenseKey && lic.licenseKey.toLowerCase().includes(q))
        );
      });
    }

    if (list.length === 0) {
      return `<tr><td colspan="12" style="text-align:center; padding:20px; color:var(--admin-text-muted);">No subscription records match criteria.</td></tr>`;
    }

    const now = new Date();

    return list.map(s => {
      const biz = businesses.find(b => b.id === s.businessId) || { name: 'Unknown', ownerName: 'N/A', phone: 'N/A', email: 'N/A' };
      const plan = plans.find(p => p.id === s.planId) || { name: 'Starter POS' };
      const lic = licenses.find(l => l.businessId === s.businessId) || { licenseKey: 'N/A' };
      const pay = payments.find(p => p.businessId === s.businessId) || { status: 'Verified' };

      const expDate = new Date(s.expiresAt);
      const daysLeft = Math.ceil((expDate - now) / 86400000);
      const daysBadgeColor = daysLeft <= 0 ? 'var(--admin-danger)' : (daysLeft <= 7 ? 'var(--admin-warning)' : 'var(--admin-success)');

      return `
        <tr>
          <td><b>${biz.name}</b></td>
          <td><code style="color:var(--admin-primary);">${s.businessId}</code></td>
          <td><b>${biz.ownerName}</b><br><span style="font-size:10px; color:var(--admin-text-muted);">${biz.phone}</span></td>
          <td><span class="status-pill pill-trial">${plan.name}</span></td>
          <td>${s.billingCycle}</td>
          <td><span class="status-pill pill-${s.status.toLowerCase()}">${s.status}</span></td>
          <td style="font-size:11px;">${new Date(s.startDate || s.created_at || now).toLocaleDateString()}</td>
          <td style="font-size:11px;"><b>${expDate.toLocaleDateString()}</b></td>
          <td><b style="color:${daysBadgeColor};">${daysLeft <= 0 ? 'Expired' : `${daysLeft} Days`}</b></td>
          <td><code style="font-size:10px; color:var(--admin-success);">${lic.licenseKey}</code></td>
          <td><span class="status-pill pill-${pay.status === 'Verified' ? 'active' : 'suspended'}">${pay.status}</span></td>
          <td>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">
              <button class="btn-admin btn-success" style="padding:2px 6px; font-size:10px;" onclick="adminApp.openCustomRenewModal('${s.businessId}')">💳 Renew</button>
              <button class="btn-admin btn-primary" style="padding:2px 6px; font-size:10px;" onclick="adminApp.openCustomUpgradeModal('${s.businessId}')">⚡ Change Plan</button>
              <button class="btn-admin btn-secondary" style="padding:2px 6px; font-size:10px;" onclick="adminApp.openCustomSuspendModal('${s.businessId}')">⏸️ Suspend</button>
              <button class="btn-admin btn-secondary" style="padding:2px 6px; font-size:10px;" onclick="adminApp.activateBusiness('${s.businessId}')">▶️ Activate</button>
              <button class="btn-admin btn-secondary" style="padding:2px 6px; font-size:10px;" onclick="adminApp.resetTrial('${s.businessId}')">🔄 Reset Trial</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  setSubFilter(filterVal, chipElem) {
    this.subFilter = filterVal;
    document.querySelectorAll('#subFilterContainer .filter-chip').forEach(c => c.classList.remove('active'));
    if (chipElem) chipElem.classList.add('active');
    this.filterSubscriptionsTable();
  }

  filterSubscriptionsTable() {
    const input = document.getElementById('subSearchInput');
    if (input) this.subSearchQuery = input.value.trim();

    const body = document.getElementById('subscriptionsTableBody');
    if (!body) return;

    const subs = window.SuperAdminDB.getSubscriptions();
    const businesses = window.SuperAdminDB.getBusinesses();
    const plans = window.SuperAdminDB.getPlans();
    const licenses = window.SuperAdminDB.getLicenses();
    const payments = window.SuperAdminDB.getPayments();

    body.innerHTML = this.renderSubscriptionsRows(subs, businesses, plans, licenses, payments);
  }

  // --- CUSTOM RENEWAL MODAL ---
  openCustomRenewModal(bizId) {
    const bizList = window.SuperAdminDB.getBusinesses();
    const subList = window.SuperAdminDB.getSubscriptions();
    const planList = window.SuperAdminDB.getPlans();

    const biz = bizList.find(b => b.id === bizId);
    const sub = subList.find(s => s.businessId === bizId) || {};
    const plan = planList.find(p => p.id === sub.planId) || planList[0];

    const modal = document.getElementById('adminModalBox');
    if (!modal || !biz) return;

    const defaultExp = new Date(Date.now() + 365*86400000).toISOString().split('T')[0];

    modal.innerHTML = `
      <div class="admin-modal-header">
        <div class="box-title">💳 Renew Subscription: ${biz.name}</div>
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">✕</button>
      </div>

      <div class="admin-modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">Billing Cycle</label>
          <select id="renewCycleSelect" class="form-control" onchange="adminApp.updateRenewPriceTag('${plan.id}')">
            <option value="Monthly">Monthly Cycle</option>
            <option value="Yearly" selected>Yearly Cycle (Discounted)</option>
            <option value="Custom">Custom Expiry & Amount</option>
          </select>
        </div>

        <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div class="form-group">
            <label class="form-label">New Expiry Date *</label>
            <input type="date" id="renewExpiryDate" class="form-control" value="${defaultExp}">
          </div>
          <div class="form-group">
            <label class="form-label">Renewal Amount (₹) *</label>
            <input type="number" id="renewAmount" class="form-control" value="${plan.yearlyPrice || 1999}">
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Admin Payment Notes</label>
          <input type="text" id="renewNotes" class="form-control" placeholder="e.g. Received GPay / Bank NEFT Transfer">
        </div>
      </div>

      <div class="admin-modal-footer">
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">Cancel</button>
        <button class="btn-admin btn-success" onclick="adminApp.submitRenewForm('${bizId}')">✓ Renew Subscription & Notify POS</button>
      </div>
    `;

    this.openModal();
  }

  updateRenewPriceTag(planId) {
    const cycle = document.getElementById('renewCycleSelect').value;
    const plans = window.SuperAdminDB.getPlans();
    const plan = plans.find(p => p.id === planId) || plans[0];
    const amountInput = document.getElementById('renewAmount');
    if (!amountInput) return;

    if (cycle === 'Monthly') amountInput.value = plan.monthlyPrice;
    else if (cycle === 'Yearly') amountInput.value = plan.yearlyPrice;
  }

  submitRenewForm(bizId) {
    const cycle = document.getElementById('renewCycleSelect').value;
    const expiresAtDate = document.getElementById('renewExpiryDate').value;
    const amount = document.getElementById('renewAmount').value;
    const notes = document.getElementById('renewNotes').value;

    if (!expiresAtDate) {
      alert('Expiry Date is required.');
      return;
    }

    const isoExpiry = new Date(expiresAtDate + 'T23:59:59').toISOString();

    window.SuperAdminDB.renewSubscriptionAtomic({
      businessId: bizId,
      cycle,
      expiresAt: isoExpiry,
      amount,
      notes
    });

    this.closeModal();
    this.showToast('✅ Subscription Renewed! Realtime update sent to POS.', 'success');
    this.renderSubscriptionsView();
  }

  // --- CUSTOM PLAN UPGRADE / CHANGE MODAL ---
  openCustomUpgradeModal(bizId) {
    const bizList = window.SuperAdminDB.getBusinesses();
    const subList = window.SuperAdminDB.getSubscriptions();
    const planList = window.SuperAdminDB.getPlans();

    const biz = bizList.find(b => b.id === bizId);
    const sub = subList.find(s => s.businessId === bizId) || {};

    const modal = document.getElementById('adminModalBox');
    if (!modal || !biz) return;

    modal.innerHTML = `
      <div class="admin-modal-header">
        <div class="box-title">⚡ Change Plan: ${biz.name}</div>
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">✕</button>
      </div>

      <div class="admin-modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <div class="form-group">
          <label class="form-label">Select Target Subscription Plan</label>
          <select id="upgradePlanSelect" class="form-control">
            ${planList.map(p => `<option value="${p.id}" ${sub.planId === p.id ? 'selected' : ''}>${p.name} (Monthly: ₹${p.monthlyPrice} / Yearly: ₹${p.yearlyPrice}) - Max ${p.deviceLimit} Devices</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Select Billing Cycle</label>
          <select id="upgradeCycleSelect" class="form-control">
            <option value="Monthly" ${sub.billingCycle === 'Monthly' ? 'selected' : ''}>Monthly Billing</option>
            <option value="Yearly" ${sub.billingCycle === 'Yearly' ? 'selected' : ''}>Yearly Billing</option>
          </select>
        </div>
      </div>

      <div class="admin-modal-footer">
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">Cancel</button>
        <button class="btn-admin btn-primary" onclick="adminApp.submitUpgradeForm('${bizId}')">Update Plan & License Devices</button>
      </div>
    `;

    this.openModal();
  }

  submitUpgradeForm(bizId) {
    const newPlanId = document.getElementById('upgradePlanSelect').value;
    const cycle = document.getElementById('upgradeCycleSelect').value;

    window.SuperAdminDB.changePlanAtomic(bizId, newPlanId, cycle);

    this.closeModal();
    this.showToast('⚡ Plan updated! License device limits synchronized.', 'success');
    this.renderSubscriptionsView();
  }

  // --- CUSTOM SUSPENSION MODAL ---
  openCustomSuspendModal(bizId) {
    const bizList = window.SuperAdminDB.getBusinesses();
    const biz = bizList.find(b => b.id === bizId);
    const modal = document.getElementById('adminModalBox');
    if (!modal || !biz) return;

    modal.innerHTML = `
      <div class="admin-modal-header">
        <div class="box-title">⏸️ Suspend Account: ${biz.name}</div>
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">✕</button>
      </div>

      <div class="admin-modal-body" style="display:flex; flex-direction:column; gap:12px;">
        <div style="background:rgba(239,68,68,0.15); border:1px solid var(--admin-danger); padding:10px; border-radius:6px; color:#fca5a5; font-size:12px;">
          ⚠️ <b>Warning:</b> Suspending this business will immediately lock POS Billing, Inventory, Reports, and Products in real-time.
        </div>

        <div class="form-group">
          <label class="form-label">Suspension Reason *</label>
          <input type="text" id="suspendReasonInput" class="form-control" value="Non-Payment / Policy Violation" required>
        </div>
      </div>

      <div class="admin-modal-footer">
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">Cancel</button>
        <button class="btn-admin btn-danger" onclick="adminApp.submitSuspendForm('${bizId}')">Confirm & Lock POS</button>
      </div>
    `;

    this.openModal();
  }

  submitSuspendForm(bizId) {
    const reason = document.getElementById('suspendReasonInput').value.trim();
    window.SuperAdminDB.suspendBusinessAtomic(bizId, reason);
    this.closeModal();
    this.showToast('🔴 Account Suspended & POS locked in real-time.', 'danger');
    if (this.currentRoute === '#/subscriptions') this.renderSubscriptionsView();
    else if (this.currentRoute === '#/businesses') this.renderBusinessesView();
  }

  activateBusiness(bizId) {
    window.SuperAdminDB.activateBusinessAtomic(bizId);
    this.showToast('🟢 Account Activated & POS unlocked in real-time.', 'success');
    if (this.currentRoute === '#/subscriptions') this.renderSubscriptionsView();
    else if (this.currentRoute === '#/businesses') this.renderBusinessesView();
  }

  resetTrial(bizId) {
    window.SuperAdminDB.resetTrialAtomic(bizId, 14);
    this.showToast('🔄 14-Day Free Trial reset for business!', 'success');
    if (this.currentRoute === '#/subscriptions') this.renderSubscriptionsView();
  }

  exportSubscriptionsCSV() {
    const subs = window.SuperAdminDB.getSubscriptions();
    const bizs = window.SuperAdminDB.getBusinesses();
    const plans = window.SuperAdminDB.getPlans();
    const lics = window.SuperAdminDB.getLicenses();

    let csv = 'Business Name,Business ID,Plan,Cycle,Status,Expiry Date,License Key\n';
    subs.forEach(s => {
      const biz = bizs.find(b => b.id === s.businessId) || {};
      const plan = plans.find(p => p.id === s.planId) || {};
      const lic = lics.find(l => l.businessId === s.businessId) || {};
      csv += `"${biz.name || ''}","${s.businessId}","${plan.name || ''}","${s.billingCycle}","${s.status}","${s.expiresAt}","${lic.licenseKey || ''}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Subscriptions_Master_${Date.now()}.csv`;
    a.click();
    this.showToast('Subscriptions Master report exported to CSV!', 'success');
  }

  // --- PLANS VIEW ---
  renderPlansView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const plans = window.SuperAdminDB.getPlans();

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header">
          <div class="box-title">💎 Subscription Plan Catalog & Matrix</div>
          <button class="btn-admin btn-primary" onclick="adminApp.openCreatePlanModal()">+ Create New Plan</button>
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:16px;">
          ${plans.map(p => `
            <div style="background:var(--admin-card-hover); border:1px solid var(--admin-border-accent); border-radius:var(--admin-radius-md); padding:20px; display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="font-size:18px; font-weight:800;">${p.name}</h3>
                <span class="status-pill pill-active">Max ${p.deviceLimit} Devices</span>
              </div>
              <div style="font-size:28px; font-weight:800; color:var(--admin-primary);">₹${p.monthlyPrice} <span style="font-size:12px; color:var(--admin-text-muted);">/ mo</span></div>
              <div style="font-size:13px; color:var(--admin-text-sub);">Yearly: <b>₹${p.yearlyPrice}</b> (${p.trialDays} Days Trial)</div>
              <div style="border-top:1px solid var(--admin-border); padding-top:10px; display:flex; flex-direction:column; gap:6px;">
                ${p.features.map(f => `<div style="font-size:12px; color:var(--admin-text-main);">✓ ${f}</div>`).join('')}
              </div>
              <div style="display:flex; gap:8px; margin-top:8px;">
                <button class="btn-admin btn-secondary" style="flex:1; justify-content:center;" onclick="adminApp.deletePlan('${p.id}')">Delete</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  deletePlan(id) {
    if (confirm('Delete this pricing plan?')) {
      window.SuperAdminDB.deletePlan(id);
      this.showToast('Plan deleted.', 'danger');
      this.renderPlansView();
    }
  }

  // --- PAYMENTS VIEW ---
  renderPaymentsView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const payments = window.SuperAdminDB.getPayments();
    const businesses = window.SuperAdminDB.getBusinesses();

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header">
          <div class="box-title">💳 Payment Verifications & Queue</div>
        </div>

        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Invoice No</th>
                <th>Business Name</th>
                <th>Amount</th>
                <th>Payment Method</th>
                <th>UTR / Ref Code</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${payments.map(p => {
                const biz = businesses.find(b => b.id === p.businessId) || { name: 'Store' };
                const isPending = p.status === 'Pending Verification';
                return `
                  <tr>
                    <td><b style="font-family:monospace;">${p.invoiceNo}</b></td>
                    <td><b>${biz.name}</b></td>
                    <td><b style="color:var(--admin-success);">₹${p.amount}</b></td>
                    <td>${p.paymentMethod}</td>
                    <td><code>${p.utrRef}</code></td>
                    <td><span class="status-pill pill-${isPending ? 'suspended' : 'active'}">${p.status}</span></td>
                    <td>
                      ${isPending ? `
                        <button class="btn-admin btn-success" style="padding:4px 8px; font-size:11px;" onclick="adminApp.verifyPayment('${p.id}', 'Verified')">✓ Verify</button>
                        <button class="btn-admin btn-danger" style="padding:4px 8px; font-size:11px;" onclick="adminApp.verifyPayment('${p.id}', 'Rejected')">✕ Reject</button>
                      ` : `
                        <button class="btn-admin btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="alert('Invoice: ${p.invoiceNo}\\nAmount: ₹${p.amount}')">📄 Invoice</button>
                      `}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  verifyPayment(id, status) {
    window.SuperAdminDB.verifyPayment(id, status);
    this.showToast(`Payment ${status} successfully!`, status === 'Verified' ? 'success' : 'danger');
    this.renderPaymentsView();
  }

  // --- LICENSES VIEW ---
  renderLicensesView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const licenses = window.SuperAdminDB.getLicenses();
    const businesses = window.SuperAdminDB.getBusinesses();

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header">
          <div class="box-title">🔑 License Keys & Devices</div>
          <button class="btn-admin btn-primary" onclick="adminApp.openGenerateLicenseModal()">+ Issue New License</button>
        </div>

        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>License Key</th>
                <th>Business Name</th>
                <th>Active / Max Devices</th>
                <th>Expires Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${licenses.map(l => {
                const biz = businesses.find(b => b.id === l.businessId) || { name: 'Store' };
                return `
                  <tr>
                    <td><b style="font-family:monospace; color:var(--admin-primary);">${l.licenseKey}</b></td>
                    <td><b>${biz.name}</b></td>
                    <td><b>${l.activeDevices} / ${l.maxDevices} Devices</b></td>
                    <td>${new Date(l.expiresAt).toLocaleDateString()}</td>
                    <td><span class="status-pill pill-${l.status.toLowerCase()}">${l.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  openGenerateLicenseModal() {
    const bizList = window.SuperAdminDB.getBusinesses();
    const selectOptions = bizList.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
    const modal = document.getElementById('adminModalBox');
    if (!modal) return;

    modal.innerHTML = `
      <div class="admin-modal-header">
        <div class="box-title">🔑 Issue New License Key</div>
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">✕</button>
      </div>
      <div class="admin-modal-body">
        <div class="form-group">
          <label class="form-label">Select Business</label>
          <select id="licBizId" class="form-control">${selectOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Max Allowed Devices</label>
          <input type="number" id="licMaxDevices" class="form-control" value="5" min="1" max="100">
        </div>
      </div>
      <div class="admin-modal-footer">
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">Cancel</button>
        <button class="btn-admin btn-primary" onclick="adminApp.generateLicenseKeySubmit()">Generate License</button>
      </div>
    `;
    this.openModal();
  }

  generateLicenseKeySubmit() {
    const bizId = document.getElementById('licBizId').value;
    const maxDev = document.getElementById('licMaxDevices').value;
    const newLic = window.SuperAdminDB.generateLicenseKey(bizId, maxDev);
    this.closeModal();
    this.showToast(`New License Issued: ${newLic.licenseKey}`, 'success');
    this.renderLicensesView();
  }

  // --- REPORTS VIEW ---
  renderReportsView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header"><div class="box-title">📈 Revenue Analytics & Performance</div></div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
          <div style="background:var(--admin-card-hover); padding:16px; border-radius:var(--admin-radius-md); border:1px solid var(--admin-border);">
            <div style="font-size:12px; color:var(--admin-text-sub);">ANNUAL REVENUE RUN RATE (ARR)</div>
            <div style="font-size:26px; font-weight:800; color:var(--admin-success); margin-top:4px;">₹ 12,50,000</div>
          </div>
          <div style="background:var(--admin-card-hover); padding:16px; border-radius:var(--admin-radius-md); border:1px solid var(--admin-border);">
            <div style="font-size:12px; color:var(--admin-text-sub);">TRIAL CONVERSION RATE</div>
            <div style="font-size:26px; font-weight:800; color:var(--admin-primary); margin-top:4px;">68.4 %</div>
          </div>
          <div style="background:var(--admin-card-hover); padding:16px; border-radius:var(--admin-radius-md); border:1px solid var(--admin-border);">
            <div style="font-size:12px; color:var(--admin-text-sub);">ANNUAL RENEWAL RATE</div>
            <div style="font-size:26px; font-weight:800; color:var(--admin-purple); margin-top:4px;">92.1 %</div>
          </div>
        </div>
      </div>
    `;
  }

  // --- NOTIFICATIONS VIEW ---
  renderNotificationsView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header"><div class="box-title">🔔 Notification Broadcast</div></div>
        <div class="form-group">
          <label class="form-label">Title</label>
          <input type="text" id="notifTitle" class="form-control" placeholder="e.g. Scheduled Maintenance">
        </div>
        <div class="form-group">
          <label class="form-label">Message</label>
          <textarea id="notifMsg" class="form-control" style="height:80px;" placeholder="Message to clients..."></textarea>
        </div>
        <button class="btn-admin btn-primary" style="width:fit-content;" onclick="adminApp.sendNotificationSubmit()">Broadcast Notification</button>
      </div>
    `;
  }

  sendNotificationSubmit() {
    const title = document.getElementById('notifTitle').value;
    if (!title) { alert('Enter title'); return; }
    window.SuperAdminDB.recordAuditLog({ action: 'NOTIFICATION_BROADCAST', targetBusiness: 'ALL', oldValue: 'None', newValue: title });
    this.showToast(`Broadcast Sent: "${title}"`, 'success');
    document.getElementById('notifTitle').value = '';
    document.getElementById('notifMsg').value = '';
  }

  // --- AUDIT LOG VIEW ---
  renderAuditLogView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const logs = window.SuperAdminDB.getAuditLogs();

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header"><div class="box-title">🛡️ Security Audit Logs</div></div>
        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Admin Email</th>
                <th>Action</th>
                <th>Target Business</th>
                <th>IP / Agent</th>
                <th>Old Value</th>
                <th>New Value</th>
              </tr>
            </thead>
            <tbody>
              ${logs.map(l => `
                <tr>
                  <td style="white-space:nowrap; font-size:11px;">${new Date(l.timestamp).toLocaleString()}</td>
                  <td><b>${l.adminEmail}</b></td>
                  <td><span class="status-pill pill-trial">${l.action}</span></td>
                  <td><b>${l.targetBusiness}</b></td>
                  <td style="font-size:11px; color:var(--admin-text-muted);">${l.ipAddress}</td>
                  <td style="font-size:11px; color:var(--admin-danger);">${l.oldValue}</td>
                  <td style="font-size:11px; color:var(--admin-success);">${l.newValue}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // --- SETTINGS VIEW ---
  renderSettingsView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const config = window.SuperAdminAuth.getSupabaseConfig();

    body.innerHTML = `
      <div class="card-box" style="max-width:650px;">
        <div class="box-header"><div class="box-title">⚙️ Super Admin & Supabase Config</div></div>
        <div class="form-group">
          <label class="form-label">Supabase URL</label>
          <input type="text" id="setSupaUrl" class="form-control" value="${config.url}">
        </div>
        <div class="form-group">
          <label class="form-label">Supabase Anon Key</label>
          <input type="text" id="setSupaKey" class="form-control" value="${config.anonKey}">
        </div>
        <button class="btn-admin btn-success" style="margin-top:10px;" onclick="adminApp.saveSettingsSubmit()">💾 Save Supabase Configuration</button>
      </div>
    `;
  }

  saveSettingsSubmit() {
    const url = document.getElementById('setSupaUrl').value.trim();
    const anonKey = document.getElementById('setSupaKey').value.trim();
    localStorage.setItem('super_admin_supabase_config', JSON.stringify({ url, anonKey }));
    this.showToast('Supabase API Configuration Saved Successfully', 'success');
  }

  // --- GLOBAL UTILITIES ---
  openCreateBusinessModal() {
    const modal = document.getElementById('adminModalBox');
    if (!modal) return;

    modal.innerHTML = `
      <div class="admin-modal-header">
        <div class="box-title">🏢 Register New POS Business</div>
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">✕</button>
      </div>
      <div class="admin-modal-body">
        <div class="form-group">
          <label class="form-label">Business Name *</label>
          <input type="text" id="newBizName" class="form-control" placeholder="e.g. Apex Hypermarket" required>
        </div>
        <div class="form-group">
          <label class="form-label">Owner Name *</label>
          <input type="text" id="newOwnerName" class="form-control" placeholder="e.g. Rajesh Kumar" required>
        </div>
        <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div class="form-group">
            <label class="form-label">Email *</label>
            <input type="email" id="newBizEmail" class="form-control" placeholder="apex@pos.com">
          </div>
          <div class="form-group">
            <label class="form-label">Phone *</label>
            <input type="tel" id="newBizPhone" class="form-control" placeholder="+91 9876543210">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">City</label>
          <input type="text" id="newBizCity" class="form-control" placeholder="Mumbai">
        </div>
      </div>
      <div class="admin-modal-footer">
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">Cancel</button>
        <button class="btn-admin btn-primary" onclick="adminApp.saveNewBusinessSubmit()">Create Business</button>
      </div>
    `;
    this.openModal();
  }

  saveNewBusinessSubmit() {
    const name = document.getElementById('newBizName').value.trim();
    const ownerName = document.getElementById('newOwnerName').value.trim();
    const email = document.getElementById('newBizEmail').value.trim();
    const phone = document.getElementById('newBizPhone').value.trim();
    const city = document.getElementById('newBizCity').value.trim();

    if (!name || !ownerName) {
      alert('Business Name and Owner Name are required.');
      return;
    }

    const newBiz = window.SuperAdminDB.saveBusiness({
      name, ownerName, email, phone, city, status: 'Trial'
    });

    window.SuperAdminDB.generateLicenseKey(newBiz.id, 3);
    this.closeModal();
    this.showToast(`Business "${name}" created with 14-day trial & license key!`, 'success');
    this.renderBusinessesView();
  }

  openCreatePlanModal() {
    const modal = document.getElementById('adminModalBox');
    if (!modal) return;

    modal.innerHTML = `
      <div class="admin-modal-header">
        <div class="box-title">💎 Create Subscription Plan</div>
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">✕</button>
      </div>
      <div class="admin-modal-body">
        <div class="form-group">
          <label class="form-label">Plan Name *</label>
          <input type="text" id="newPlanName" class="form-control" placeholder="e.g. Ultra Retail" required>
        </div>
        <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
          <div class="form-group">
            <label class="form-label">Monthly Price (₹) *</label>
            <input type="number" id="newPlanMonthly" class="form-control" placeholder="199" required>
          </div>
          <div class="form-group">
            <label class="form-label">Yearly Price (₹) *</label>
            <input type="number" id="newPlanYearly" class="form-control" placeholder="1999" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Device Limit</label>
          <input type="number" id="newPlanDeviceLimit" class="form-control" value="5" min="1">
        </div>
      </div>
      <div class="admin-modal-footer">
        <button class="btn-admin btn-secondary" onclick="adminApp.closeModal()">Cancel</button>
        <button class="btn-admin btn-primary" onclick="adminApp.saveNewPlanSubmit()">Save Plan</button>
      </div>
    `;
    this.openModal();
  }

  saveNewPlanSubmit() {
    const name = document.getElementById('newPlanName').value.trim();
    const monthlyPrice = parseFloat(document.getElementById('newPlanMonthly').value) || 99;
    const yearlyPrice = parseFloat(document.getElementById('newPlanYearly').value) || 999;
    const deviceLimit = parseInt(document.getElementById('newPlanDeviceLimit').value) || 3;

    if (!name) { alert('Plan name required.'); return; }

    window.SuperAdminDB.savePlan({
      name, monthlyPrice, yearlyPrice, deviceLimit, trialDays: 14,
      features: [`${deviceLimit} Devices Allowed`, 'Offline Billing', 'Thermal Receipt', 'GST Reports'],
      active: true
    });

    this.closeModal();
    this.showToast(`Plan "${name}" created successfully!`, 'success');
    this.renderPlansView();
  }

  openModal() {
    document.getElementById('adminModalOverlay').classList.add('active');
  }

  closeModal() {
    document.getElementById('adminModalOverlay').classList.remove('active');
  }

  showToast(msg, type = 'info') {
    const container = document.getElementById('adminToastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = msg;
    container.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 3500);
  }
}

// Instantiate App
window.adminApp = new SuperAdminApp();
document.addEventListener('DOMContentLoaded', () => {
  window.adminApp.init();
});
