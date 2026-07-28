/**
 * ============================================================
 * SUPER ADMIN DATABASE & REPOSITORY ENGINE (admin-db.js)
 * Manages Businesses, Subscriptions, Plans, Payments, Licenses & Audit Logs
 * Supports Supabase Client Live Connection + Pre-seeded Storage Fallback
 * ============================================================
 */
window.SuperAdminDB = {
  dbKeys: {
    businesses: 'super_admin_businesses',
    subscriptions: 'super_admin_subscriptions',
    plans: 'super_admin_plans',
    payments: 'super_admin_payments',
    licenses: 'super_admin_licenses',
    auditLogs: 'super_admin_audit_logs',
    notifications: 'super_admin_notifications'
  },

  /**
   * Initialize Local Repository Data with Rich Initial Seed Dataset
   */
  init() {
    if (!localStorage.getItem(this.dbKeys.plans)) {
      const seedPlans = [
        { id: 'plan_starter', name: 'Starter POS', monthlyPrice: 499, yearlyPrice: 4999, trialDays: 14, features: ['1 Device', 'Offline Billing', 'Thermal Receipt', 'Basic Reports'], deviceLimit: 1, displayOrder: 1, active: true },
        { id: 'plan_standard', name: 'Standard Retail', monthlyPrice: 999, yearlyPrice: 9999, trialDays: 14, features: ['3 Devices', 'Inventory Audit', 'UPI Payment QR', 'GST Reports'], deviceLimit: 3, displayOrder: 2, active: true },
        { id: 'plan_premium', name: 'Premium Supermarket', monthlyPrice: 1999, yearlyPrice: 19999, trialDays: 14, features: ['10 Devices', 'Multi-Store', '100k Catalog Support', 'Priority Support'], deviceLimit: 10, displayOrder: 3, active: true },
        { id: 'plan_enterprise', name: 'Enterprise Custom', monthlyPrice: 4999, yearlyPrice: 49999, trialDays: 30, features: ['Unlimited Devices', 'Custom Logo & Branding', 'Dedicated Manager', 'Custom API Integration'], deviceLimit: 99, displayOrder: 4, active: true }
      ];
      localStorage.setItem(this.dbKeys.plans, JSON.stringify(seedPlans));
    }

    if (!localStorage.getItem(this.dbKeys.businesses)) {
      const now = new Date();
      const seedBusinesses = [
        { id: 'biz_101', name: 'Apex Supermarket', ownerName: 'Rajesh Kumar', email: 'apex@posstore.com', phone: '+91 9876543210', city: 'Mumbai', status: 'Active', createdAt: new Date(now - 45*86400000).toISOString() },
        { id: 'biz_102', name: 'Metro Fresh Hypermarket', ownerName: 'Sanjay Gupta', email: 'metro@supermarket.in', phone: '+91 9812345678', city: 'Delhi', status: 'Active', createdAt: new Date(now - 30*86400000).toISOString() },
        { id: 'biz_103', name: 'Sunrise Organic Mart', ownerName: 'Priya Sharma', email: 'priya@sunrisemart.com', phone: '+91 9988776655', city: 'Bangalore', status: 'Trial', createdAt: new Date(now - 7*86400000).toISOString() },
        { id: 'biz_104', name: 'Express Retail Pharmacy', ownerName: 'Dr. Amit Patel', email: 'info@expresspharma.com', phone: '+91 9765432109', city: 'Ahmedabad', status: 'Expired', createdAt: new Date(now - 90*86400000).toISOString() },
        { id: 'biz_105', name: 'Green Grocery & Spices', ownerName: 'Venkatesh Rao', email: 'green@grocery.com', phone: '+91 9845012345', city: 'Chennai', status: 'Suspended', createdAt: new Date(now - 120*86400000).toISOString() }
      ];
      localStorage.setItem(this.dbKeys.businesses, JSON.stringify(seedBusinesses));
    }

    if (!localStorage.getItem(this.dbKeys.subscriptions)) {
      const now = new Date();
      const seedSubscriptions = [
        { id: 'sub_201', businessId: 'biz_101', planId: 'plan_premium', status: 'Active', billingCycle: 'Yearly', startDate: new Date(now - 45*86400000).toISOString(), expiresAt: new Date(Date.now() + 320*86400000).toISOString() },
        { id: 'sub_202', businessId: 'biz_102', planId: 'plan_standard', status: 'Active', billingCycle: 'Monthly', startDate: new Date(now - 30*86400000).toISOString(), expiresAt: new Date(Date.now() + 15*86400000).toISOString() },
        { id: 'sub_203', businessId: 'biz_103', planId: 'plan_standard', status: 'Trial', billingCycle: 'Monthly', startDate: new Date(now - 7*86400000).toISOString(), expiresAt: new Date(Date.now() + 7*86400000).toISOString() },
        { id: 'sub_204', businessId: 'biz_104', planId: 'plan_starter', status: 'Expired', billingCycle: 'Monthly', startDate: new Date(now - 90*86400000).toISOString(), expiresAt: new Date(now - 5*86400000).toISOString() },
        { id: 'sub_205', businessId: 'biz_105', planId: 'plan_starter', status: 'Suspended', billingCycle: 'Monthly', startDate: new Date(now - 120*86400000).toISOString(), expiresAt: new Date(now - 10*86400000).toISOString() }
      ];
      localStorage.setItem(this.dbKeys.subscriptions, JSON.stringify(seedSubscriptions));
    }

    if (!localStorage.getItem(this.dbKeys.payments)) {
      const now = new Date();
      const seedPayments = [
        { id: 'pay_301', businessId: 'biz_101', invoiceNo: 'INV-SUB-1001', amount: 19999, paymentMethod: 'UPI / QR', utrRef: 'UTR320984719283', status: 'Verified', createdAt: new Date(now - 45*86400000).toISOString(), verifiedAt: new Date(now - 45*86400000).toISOString() },
        { id: 'pay_302', businessId: 'biz_102', invoiceNo: 'INV-SUB-1002', amount: 999, paymentMethod: 'Bank Transfer', utrRef: 'NEFT98765432', status: 'Verified', createdAt: new Date(now - 30*86400000).toISOString(), verifiedAt: new Date(now - 30*86400000).toISOString() },
        { id: 'pay_303', businessId: 'biz_103', invoiceNo: 'INV-SUB-1003', amount: 999, paymentMethod: 'UPI / QR', utrRef: 'UPI4455667788', status: 'Pending Verification', createdAt: new Date(now - 1*86400000).toISOString(), verifiedAt: null },
        { id: 'pay_304', businessId: 'biz_104', invoiceNo: 'INV-SUB-1004', amount: 499, paymentMethod: 'Card', utrRef: 'CARD88776655', status: 'Pending Verification', createdAt: new Date().toISOString(), verifiedAt: null }
      ];
      localStorage.setItem(this.dbKeys.payments, JSON.stringify(seedPayments));
    }

    if (!localStorage.getItem(this.dbKeys.licenses)) {
      const now = new Date();
      const seedLicenses = [
        { id: 'lic_401', businessId: 'biz_101', licenseKey: 'POS-APEX-9988-7766-1011', maxDevices: 10, activeDevices: 4, status: 'Active', expiresAt: new Date(Date.now() + 320*86400000).toISOString() },
        { id: 'lic_402', businessId: 'biz_102', licenseKey: 'POS-METR-5544-3322-9900', maxDevices: 3, activeDevices: 2, status: 'Active', expiresAt: new Date(Date.now() + 15*86400000).toISOString() },
        { id: 'lic_403', businessId: 'biz_103', licenseKey: 'POS-SUNR-1122-3344-5566', maxDevices: 3, activeDevices: 1, status: 'Trial', expiresAt: new Date(Date.now() + 7*86400000).toISOString() },
        { id: 'lic_404', businessId: 'biz_104', licenseKey: 'POS-EXPR-8877-6655-4433', maxDevices: 1, activeDevices: 0, status: 'Expired', expiresAt: new Date(now - 5*86400000).toISOString() }
      ];
      localStorage.setItem(this.dbKeys.licenses, JSON.stringify(seedLicenses));
    }

    if (!localStorage.getItem(this.dbKeys.auditLogs)) {
      const now = new Date();
      const seedLogs = [
        { id: 'log_01', timestamp: new Date(now - 2*3600000).toISOString(), adminEmail: 'admin@posbilling.com', action: 'SUBSCRIPTION_RENEW', targetBusiness: 'Apex Supermarket', ipAddress: '192.168.1.50', userAgent: 'Chrome/Win11', oldValue: 'Expired: 2026-06-01', newValue: 'Extended to: 2027-06-01' },
        { id: 'log_02', timestamp: new Date(now - 1*3600000).toISOString(), adminEmail: 'admin@posbilling.com', action: 'PAYMENT_VERIFY', targetBusiness: 'Metro Fresh Hypermarket', ipAddress: '192.168.1.50', userAgent: 'Chrome/Win11', oldValue: 'Pending Verification', newValue: 'Verified (₹999)' }
      ];
      localStorage.setItem(this.dbKeys.auditLogs, JSON.stringify(seedLogs));
    }
  },

  // Helper Methods
  _getData(key) {
    this.init();
    return JSON.parse(localStorage.getItem(key) || '[]');
  },

  _saveData(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
  },

  /**
   * Audit Logging Engine
   */
  recordAuditLog(details) {
    const logs = this._getData(this.dbKeys.auditLogs);
    const session = window.SuperAdminAuth ? window.SuperAdminAuth.getSession() : null;

    const newLog = {
      id: 'log_' + Date.now(),
      timestamp: new Date().toISOString(),
      adminEmail: session ? session.user.email : 'admin@posbilling.com',
      action: details.action || 'ADMIN_ACTION',
      targetBusiness: details.targetBusiness || 'System',
      ipAddress: details.ipAddress || '127.0.0.1 (Local System)',
      userAgent: navigator.userAgent.slice(0, 50),
      oldValue: details.oldValue || 'N/A',
      newValue: details.newValue || 'N/A'
    };

    logs.unshift(newLog);
    if (logs.length > 500) logs.pop();
    this._saveData(this.dbKeys.auditLogs, logs);
  },

  // --- BUSINESSES REPOSITORY ---
  getBusinesses() { return this._getData(this.dbKeys.businesses); },
  
  saveBusiness(biz) {
    const list = this.getBusinesses();
    const idx = list.findIndex(b => b.id === biz.id);
    if (idx > -1) {
      const oldStatus = list[idx].status;
      list[idx] = { ...list[idx], ...biz };
      this.recordAuditLog({
        action: 'BUSINESS_UPDATE',
        targetBusiness: biz.name,
        oldValue: `Status: ${oldStatus}`,
        newValue: `Updated details (Status: ${biz.status})`
      });
    } else {
      biz.id = biz.id || 'biz_' + Date.now();
      biz.createdAt = new Date().toISOString();
      list.unshift(biz);
      this.recordAuditLog({
        action: 'BUSINESS_CREATE',
        targetBusiness: biz.name,
        oldValue: 'None',
        newValue: `Created Business: ${biz.name}`
      });
    }
    this._saveData(this.dbKeys.businesses, list);
    return biz;
  },

  updateBusinessStatus(id, newStatus) {
    const list = this.getBusinesses();
    const target = list.find(b => b.id === id);
    if (target) {
      const oldStatus = target.status;
      target.status = newStatus;
      this._saveData(this.dbKeys.businesses, list);
      this.recordAuditLog({
        action: `BUSINESS_${newStatus.toUpperCase()}`,
        targetBusiness: target.name,
        oldValue: oldStatus,
        newValue: newStatus
      });
    }
  },

  deleteBusiness(id) {
    const list = this.getBusinesses();
    const target = list.find(b => b.id === id);
    if (target) {
      const filtered = list.filter(b => b.id !== id);
      this._saveData(this.dbKeys.businesses, filtered);
      this.recordAuditLog({
        action: 'BUSINESS_DELETE',
        targetBusiness: target.name,
        oldValue: target.status,
        newValue: 'Deleted'
      });
    }
  },

  // --- SUBSCRIPTIONS REPOSITORY ---
  getSubscriptions() { return this._getData(this.dbKeys.subscriptions); },

  updateSubscription(sub) {
    const list = this.getSubscriptions();
    const idx = list.findIndex(s => s.id === sub.id);
    if (idx > -1) {
      const oldSub = list[idx];
      list[idx] = { ...oldSub, ...sub };
      this._saveData(this.dbKeys.subscriptions, list);
      this.recordAuditLog({
        action: 'SUBSCRIPTION_MODIFY',
        targetBusiness: sub.businessId,
        oldValue: `Status: ${oldSub.status}, Expires: ${new Date(oldSub.expiresAt).toLocaleDateString()}`,
        newValue: `Status: ${sub.status}, Expires: ${new Date(sub.expiresAt).toLocaleDateString()}`
      });
    }
  },

  // --- PLANS REPOSITORY ---
  getPlans() { return this._getData(this.dbKeys.plans); },

  savePlan(plan) {
    const list = this.getPlans();
    const idx = list.findIndex(p => p.id === plan.id);
    if (idx > -1) {
      list[idx] = { ...list[idx], ...plan };
    } else {
      plan.id = plan.id || 'plan_' + Date.now();
      list.push(plan);
    }
    this._saveData(this.dbKeys.plans, list);
    this.recordAuditLog({
      action: 'PLAN_SAVE',
      targetBusiness: 'SYSTEM_PLAN',
      oldValue: 'N/A',
      newValue: `Plan: ${plan.name} (Monthly: ₹${plan.monthlyPrice})`
    });
  },

  deletePlan(id) {
    const list = this.getPlans().filter(p => p.id !== id);
    this._saveData(this.dbKeys.plans, list);
  },

  // --- PAYMENTS REPOSITORY ---
  getPayments() { return this._getData(this.dbKeys.payments); },

  verifyPayment(paymentId, status) {
    const list = this.getPayments();
    const target = list.find(p => p.id === paymentId);
    if (target) {
      target.status = status;
      target.verifiedAt = new Date().toISOString();
      this._saveData(this.dbKeys.payments, list);

      // Auto-extend or activate business subscription
      if (status === 'Verified') {
        const subs = this.getSubscriptions();
        const sub = subs.find(s => s.businessId === target.businessId);
        if (sub) {
          sub.status = 'Active';
          sub.expiresAt = new Date(Date.now() + 30*86400000).toISOString();
          this.updateSubscription(sub);
        }
      }

      this.recordAuditLog({
        action: `PAYMENT_${status.toUpperCase()}`,
        targetBusiness: target.businessId,
        oldValue: 'Pending Verification',
        newValue: `${status} (Amount: ₹${target.amount})`
      });
    }
  },

  // --- LICENSES REPOSITORY ---
  getLicenses() { return this._getData(this.dbKeys.licenses); },

  generateLicenseKey(businessId, maxDevices = 3) {
    const prefix = 'POS-LIC-';
    const randomHex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
    const key = `${prefix}${randomHex()}-${randomHex()}-${randomHex()}-${randomHex()}`;

    const list = this.getLicenses();
    const newLicense = {
      id: 'lic_' + Date.now(),
      businessId,
      licenseKey: key,
      maxDevices: parseInt(maxDevices) || 3,
      activeDevices: 0,
      status: 'Active',
      expiresAt: new Date(Date.now() + 365*86400000).toISOString()
    };

    list.unshift(newLicense);
    this._saveData(this.dbKeys.licenses, list);

    this.recordAuditLog({
      action: 'LICENSE_GENERATE',
      targetBusiness: businessId,
      oldValue: 'None',
      newValue: `Key: ${key} (Max Devices: ${maxDevices})`
    });

    return newLicense;
  },

  // --- AUDIT LOGS REPOSITORY ---
  getAuditLogs() { return this._getData(this.dbKeys.auditLogs); }
};
