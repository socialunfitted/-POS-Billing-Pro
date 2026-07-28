/**
 * ============================================================
 * SUPER ADMIN DASHBOARD APPLICATION CONTROLLER (admin-app.js)
 * SPA Router, KPI Analytics, Views Renderer, Modals & CSV Exporter
 * ============================================================
 */
class SuperAdminApp {
  constructor() {
    this.currentRoute = '#/dashboard';
    this.activeFilter = 'All';
    this.searchQuery = '';
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.setupTheme();
    this.handleRoute();
    console.log('Super Admin Subscription Management Panel Initialized.');
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

  /**
   * Router Handling with Route Guard
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

    // Highlight menu active state
    document.querySelectorAll('.menu-item').forEach(el => {
      const targetRoute = el.getAttribute('href');
      el.classList.toggle('active', targetRoute === hash);
    });

    const routeTitleMap = {
      '#/dashboard': 'Executive Subscription Dashboard',
      '#/businesses': 'Business Directory & Accounts',
      '#/subscriptions': 'Subscription Lifecycle Manager',
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
          <div class="kpi-sub">🏢 Registered POS Accounts</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">ACTIVE SUBSCRIPTIONS</div>
          <div class="kpi-val" style="color:var(--admin-success);">${activeCount}</div>
          <div class="kpi-sub">🟢 Paying Accounts</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">TRIAL USERS</div>
          <div class="kpi-val" style="color:var(--admin-primary);">${trialCount}</div>
          <div class="kpi-sub">⏳ 14-Day Active Trials</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">EXPIRED / SUSPENDED</div>
          <div class="kpi-val" style="color:var(--admin-danger);">${expiredCount}</div>
          <div class="kpi-sub">🔴 Needs Renewal</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">TOTAL REVENUE</div>
          <div class="kpi-val" style="color:var(--admin-purple);">₹${totalRevenue.toLocaleString()}</div>
          <div class="kpi-sub">💰 Verified Payment Collections</div>
        </div>

        <div class="kpi-card">
          <div class="kpi-title">PENDING VERIFICATIONS</div>
          <div class="kpi-val" style="color:var(--admin-warning);">${pendingPayments}</div>
          <div class="kpi-sub">📥 Awaiting Approval</div>
        </div>
      </div>

      <!-- CHARTS & TABLES -->
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap:20px;">
        <div class="card-box">
          <div class="box-header">
            <div class="box-title">📊 Revenue Growth Trends</div>
          </div>
          <div class="chart-box">
            <canvas id="revenueChartCanvas"></canvas>
          </div>
        </div>

        <div class="card-box">
          <div class="box-header">
            <div class="box-title">🛍️ Plan Popularity Distribution</div>
          </div>
          <div class="chart-box">
            <canvas id="planChartCanvas"></canvas>
          </div>
        </div>
      </div>

      <!-- LATEST REGISTRATIONS TABLE -->
      <div class="card-box">
        <div class="box-header">
          <div class="box-title">📋 Recent Business Registrations</div>
          <a href="#/businesses" class="btn-admin btn-secondary" style="font-size:12px;">View All Businesses →</a>
        </div>
        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Owner Name</th>
                <th>City</th>
                <th>Registered Date</th>
                <th>Account Status</th>
              </tr>
            </thead>
            <tbody>
              ${businesses.slice(0, 5).map(b => `
                <tr>
                  <td><b>${b.name}</b></td>
                  <td>${b.ownerName}</td>
                  <td>${b.city}</td>
                  <td>${new Date(b.createdAt).toLocaleDateString()}</td>
                  <td><span class="status-pill pill-${b.status.toLowerCase()}">${b.status}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    setTimeout(() => {
      this.renderRevenueChart();
      this.renderPlanChart();
    }, 100);
  }

  // --- CHARTS CANVAS RENDERERS ---
  renderRevenueChart() {
    const canvas = document.getElementById('revenueChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 280;

    ctx.clearRect(0, 0, w, h);
    
    // Draw grid background
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    for (let y = 40; y < h; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Gradient Line Chart
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    grad.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    const points = [
      {x: 20, y: h - 50},
      {x: w * 0.2, y: h - 90},
      {x: w * 0.4, y: h - 140},
      {x: w * 0.6, y: h - 110},
      {x: w * 0.8, y: h - 210},
      {x: w - 20, y: h - 240}
    ];

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.lineTo(points[points.length - 1].x, h - 30);
    ctx.lineTo(points[0].x, h - 30);
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw Points
    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
    });
  }

  renderPlanChart() {
    const canvas = document.getElementById('planChartCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = 280;

    const centerX = w / 2;
    const centerY = h / 2;
    const radius = 80;

    const data = [
      { label: 'Starter', val: 40, color: '#3b82f6' },
      { label: 'Standard', val: 35, color: '#10b981' },
      { label: 'Premium', val: 20, color: '#8b5cf6' },
      { label: 'Enterprise', val: 5, color: '#f59e0b' }
    ];

    let total = 0;
    data.forEach(d => total += d.val);

    let startAngle = 0;
    data.forEach(d => {
      const sliceAngle = (d.val / total) * 2 * Math.PI;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
      ctx.arc(centerX, centerY, radius - 30, startAngle + sliceAngle, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = d.color;
      ctx.fill();
      startAngle += sliceAngle;
    });

    // Donut text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('100% Active', centerX, centerY + 5);
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

        <div class="filter-toolbar">
          <div class="filter-chip active" onclick="adminApp.filterBusinesses('All', this)">All Businesses</div>
          <div class="filter-chip" onclick="adminApp.filterBusinesses('Active', this)">Active</div>
          <div class="filter-chip" onclick="adminApp.filterBusinesses('Trial', this)">Trial</div>
          <div class="filter-chip" onclick="adminApp.filterBusinesses('Expired', this)">Expired</div>
          <div class="filter-chip" onclick="adminApp.filterBusinesses('Suspended', this)">Suspended</div>
        </div>

        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Business Name</th>
                <th>Owner & Contact</th>
                <th>City</th>
                <th>Status</th>
                <th>Registered</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="businessesTableBody">
              ${this.renderBusinessesRows(businesses)}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  renderBusinessesRows(list) {
    if (!list || list.length === 0) {
      return `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--admin-text-muted);">No matching business records found.</td></tr>`;
    }

    return list.map(b => `
      <tr>
        <td><b>${b.name}</b><br><span style="font-size:11px; color:var(--admin-text-muted);">ID: ${b.id}</span></td>
        <td><b>${b.ownerName}</b><br><span style="font-size:11px; color:var(--admin-text-sub);">${b.email} • ${b.phone}</span></td>
        <td>${b.city || 'N/A'}</td>
        <td><span class="status-pill pill-${b.status.toLowerCase()}">${b.status}</span></td>
        <td>${new Date(b.createdAt).toLocaleDateString()}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button class="btn-admin btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="adminApp.toggleBusinessStatus('${b.id}')">
              ${b.status === 'Active' ? '⏸️ Suspend' : '▶️ Activate'}
            </button>
            <button class="btn-admin btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="adminApp.openResetLicenseModal('${b.id}')">🔑 Reset License</button>
            <button class="btn-admin btn-danger" style="padding:4px 8px; font-size:11px;" onclick="adminApp.deleteBusiness('${b.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  filterBusinesses(status, chipElem) {
    document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
    if (chipElem) chipElem.classList.add('active');

    const all = window.SuperAdminDB.getBusinesses();
    const filtered = status === 'All' ? all : all.filter(b => b.status === status);
    const body = document.getElementById('businessesTableBody');
    if (body) body.innerHTML = this.renderBusinessesRows(filtered);
  }

  toggleBusinessStatus(id) {
    const list = window.SuperAdminDB.getBusinesses();
    const target = list.find(b => b.id === id);
    if (target) {
      const nxt = target.status === 'Active' ? 'Suspended' : 'Active';
      window.SuperAdminDB.updateBusinessStatus(id, nxt);
      this.showToast(`Business "${target.name}" status updated to ${nxt}`, 'success');
      this.renderBusinessesView();
    }
  }

  deleteBusiness(id) {
    if (confirm('Are you sure you want to delete this business profile?')) {
      window.SuperAdminDB.deleteBusiness(id);
      this.showToast('Business deleted successfully.', 'danger');
      this.renderBusinessesView();
    }
  }

  // --- SUBSCRIPTIONS VIEW ---
  renderSubscriptionsView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const subs = window.SuperAdminDB.getSubscriptions();
    const businesses = window.SuperAdminDB.getBusinesses();
    const plans = window.SuperAdminDB.getPlans();

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header">
          <div class="box-title">📜 Subscription Lifecycle Manager</div>
        </div>

        <div class="table-responsive">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Subscription ID</th>
                <th>Business Name</th>
                <th>Current Plan</th>
                <th>Cycle</th>
                <th>Expires Date</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${subs.map(s => {
                const biz = businesses.find(b => b.id === s.businessId) || { name: 'Unknown Store' };
                const plan = plans.find(p => p.id === s.planId) || { name: 'Starter' };
                return `
                  <tr>
                    <td><b style="font-family:monospace;">${s.id}</b></td>
                    <td><b>${biz.name}</b></td>
                    <td><span class="status-pill pill-trial">${plan.name}</span></td>
                    <td>${s.billingCycle}</td>
                    <td>${new Date(s.expiresAt).toLocaleDateString()}</td>
                    <td><span class="status-pill pill-${s.status.toLowerCase()}">${s.status}</span></td>
                    <td>
                      <div style="display:flex; gap:6px;">
                        <button class="btn-admin btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="adminApp.extendSubscriptionExpiry('${s.id}')">➕ Extend +30 Days</button>
                        <button class="btn-admin btn-primary" style="padding:4px 8px; font-size:11px;" onclick="adminApp.upgradeSubscriptionPlan('${s.id}')">⚡ Upgrade Plan</button>
                      </div>
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

  extendSubscriptionExpiry(subId) {
    const subs = window.SuperAdminDB.getSubscriptions();
    const target = subs.find(s => s.id === subId);
    if (target) {
      const curExp = new Date(target.expiresAt).getTime();
      target.expiresAt = new Date(curExp + 30*86400000).toISOString();
      target.status = 'Active';
      window.SuperAdminDB.updateSubscription(target);
      this.showToast('Subscription expiry extended by 30 days!', 'success');
      this.renderSubscriptionsView();
    }
  }

  upgradeSubscriptionPlan(subId) {
    const subs = window.SuperAdminDB.getSubscriptions();
    const target = subs.find(s => s.id === subId);
    if (target) {
      target.planId = 'plan_premium';
      target.status = 'Active';
      window.SuperAdminDB.updateSubscription(target);
      this.showToast('Upgraded subscription to Premium Supermarket Plan!', 'success');
      this.renderSubscriptionsView();
    }
  }

  // --- PLANS VIEW ---
  renderPlansView() {
    const body = document.getElementById('adminContentBody');
    if (!body) return;

    const plans = window.SuperAdminDB.getPlans();

    body.innerHTML = `
      <div class="card-box">
        <div class="box-header">
          <div class="box-title">💎 Subscription Plan Catalog</div>
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
          <button class="btn-admin btn-secondary" onclick="adminApp.exportPaymentsCSV()">📥 Export CSV</button>
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
                        <button class="btn-admin btn-secondary" style="padding:4px 8px; font-size:11px;" onclick="adminApp.downloadInvoice('${p.id}')">📄 Invoice</button>
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

  downloadInvoice(paymentId) {
    const payments = window.SuperAdminDB.getPayments();
    const target = payments.find(p => p.id === paymentId);
    if (target) {
      alert(`Invoice ${target.invoiceNo} generated!\nAmount: ₹${target.amount}\nUTR: ${target.utrRef}`);
    }
  }

  exportPaymentsCSV() {
    const payments = window.SuperAdminDB.getPayments();
    let csv = 'Invoice No,Business ID,Amount,Payment Method,UTR Ref,Status,Created At\n';
    payments.forEach(p => {
      csv += `"${p.invoiceNo}","${p.businessId}","${p.amount}","${p.paymentMethod}","${p.utrRef}","${p.status}","${p.createdAt}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Payment_Collections_${Date.now()}.csv`;
    a.click();
    this.showToast('Payments Report exported to CSV!', 'success');
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
          <div class="box-title">🔑 License Keys & Device Limits</div>
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
    document.getElementById('adminModalOverlay').classList.add('active');
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
        <div class="box-header">
          <div class="box-title">📈 Revenue Analytics & System Performance</div>
        </div>

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
        <div class="box-header">
          <div class="box-title">🔔 Business Notification Broadcast</div>
        </div>
        <div class="form-group">
          <label class="form-label">Broadcast Message Title</label>
          <input type="text" id="notifTitle" class="form-control" placeholder="e.g. System Maintenance Notice">
        </div>
        <div class="form-group">
          <label class="form-label">Broadcast Content</label>
          <textarea id="notifMsg" class="form-control" style="height:100px;" placeholder="Message to all business clients..."></textarea>
        </div>
        <button class="btn-admin btn-primary" style="width:fit-content;" onclick="adminApp.sendNotificationSubmit()">Broadcast Notification</button>
      </div>
    `;
  }

  sendNotificationSubmit() {
    const title = document.getElementById('notifTitle').value;
    if (!title) {
      alert('Please enter notification title.');
      return;
    }
    window.SuperAdminDB.recordAuditLog({
      action: 'NOTIFICATION_BROADCAST',
      targetBusiness: 'ALL_CLIENTS',
      oldValue: 'None',
      newValue: title
    });
    this.showToast(`Broadcast Message Sent: "${title}"`, 'success');
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
        <div class="box-header">
          <div class="box-title">🛡️ Immutable Security Audit Logs</div>
        </div>

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
        <div class="box-header">
          <div class="box-title">⚙️ Super Admin & Supabase Configuration</div>
        </div>

        <div class="form-group">
          <label class="form-label">Supabase API URL</label>
          <input type="text" id="setSupaUrl" class="form-control" value="${config.url}">
        </div>

        <div class="form-group">
          <label class="form-label">Supabase Anon Key / Service Role JWT</label>
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

    setTimeout(() => {
      toast.remove();
    }, 3500);
  }
}

// Instantiate Admin App Controller
window.adminApp = new SuperAdminApp();
document.addEventListener('DOMContentLoaded', () => {
  window.adminApp.init();
});
