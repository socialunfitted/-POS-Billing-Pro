/**
 * ============================================================
 * SUPER ADMIN DATABASE & REPOSITORY ENGINE (admin-db.js)
 * Manages Businesses, Subscriptions, Plans, Payments, Licenses & Audit Logs
 * Atomic Multi-Entity Database Transactions + Realtime POS Broadcaster
 * ============================================================
 */
window.SuperAdminDB = {
  dbKeys: {
    businesses: 'super_admin_businesses',
    subscriptions: 'super_admin_subscriptions',
    plans: 'super_admin_plans',
    payments: 'super_admin_payments',
    licenses: 'super_admin_licenses',
    renewals: 'super_admin_renewals_history',
    auditLogs: 'super_admin_audit_logs',
    notifications: 'super_admin_notifications'
  },

  /**
   * Broadcast real-time subscription update to connected POS terminals
   */
  broadcastRealtimeSync(payload) {
    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('pos_subscription_sync_channel');
        bc.postMessage({
          ...payload,
          timestamp: new Date().toISOString()
        });
        bc.close();
      }

      // LocalStorage trigger fallback for cross-tab sync
      localStorage.setItem('pos_realtime_broadcast_trigger', JSON.stringify({
        ...payload,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.warn('Realtime broadcast error:', err);
    }
  },

  /**
   * Initialize Local Repository Data with Rich Initial Seed Dataset
   */
  init() {
    if (!localStorage.getItem(this.dbKeys.plans)) {
      const seedPlans = [
        { id: 'plan_starter', name: 'Starter POS', monthlyPrice: 99, yearlyPrice: 999, trialDays: 14, features: ['1 Device', 'Offline Billing', 'Thermal Receipt', 'Basic Reports'], deviceLimit: 1, displayOrder: 1, active: true },
        { id: 'plan_standard', name: 'Standard Retail', monthlyPrice: 199, yearlyPrice: 1999, trialDays: 14, features: ['3 Devices', 'Inventory Audit', 'UPI Payment QR', 'GST Reports'], deviceLimit: 3, displayOrder: 2, active: true },
        { id: 'plan_premium', name: 'Premium Supermarket', monthlyPrice: 399, yearlyPrice: 3999, trialDays: 14, features: ['10 Devices', 'Multi-Store', '100k Catalog Support', 'Priority Support'], deviceLimit: 10, displayOrder: 3, active: true },
        { id: 'plan_enterprise', name: 'Enterprise Custom', monthlyPrice: 799, yearlyPrice: 7999, trialDays: 30, features: ['Unlimited Devices', 'Custom Logo & Branding', 'Dedicated Manager', 'Custom API Integration'], deviceLimit: 99, displayOrder: 4, active: true }
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
        { id: 'pay_301', businessId: 'biz_101', invoiceNo: 'INV-SUB-1001', amount: 3999, paymentMethod: 'UPI / QR', utrRef: 'UTR320984719283', status: 'Verified', createdAt: new Date(now - 45*86400000).toISOString(), verifiedAt: new Date(now - 45*86400000).toISOString() },
        { id: 'pay_302', businessId: 'biz_102', invoiceNo: 'INV-SUB-1002', amount: 199, paymentMethod: 'Bank Transfer', utrRef: 'NEFT98765432', status: 'Verified', createdAt: new Date(now - 30*86400000).toISOString(), verifiedAt: new Date(now - 30*86400000).toISOString() },
        { id: 'pay_303', businessId: 'biz_103', invoiceNo: 'INV-SUB-1003', amount: 199, paymentMethod: 'UPI / QR', utrRef: 'UPI4455667788', status: 'Pending Verification', createdAt: new Date(now - 1*86400000).toISOString(), verifiedAt: null },
        { id: 'pay_304', businessId: 'biz_104', invoiceNo: 'INV-SUB-1004', amount: 99, paymentMethod: 'Card', utrRef: 'CARD88776655', status: 'Pending Verification', createdAt: new Date().toISOString(), verifiedAt: null }
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

    if (!localStorage.getItem(this.dbKeys.renewals)) {
      const seedRenewals = [
        { id: 'ren_501', businessId: 'biz_101', amount: 3999, oldExpiry: new Date(Date.now() - 365*86400000).toISOString(), newExpiry: new Date(Date.now() + 320*86400000).toISOString(), notes: 'Annual Renewal', createdAt: new Date().toISOString() }
      ];
      localStorage.setItem(this.dbKeys.renewals, JSON.stringify(seedRenewals));
    }

    if (!localStorage.getItem(this.dbKeys.auditLogs)) {
      const now = new Date();
      const seedLogs = [
        { id: 'log_01', timestamp: new Date(now - 2*3600000).toISOString(), adminEmail: 'admin@posbilling.com', action: 'SUBSCRIPTION_RENEW', targetBusiness: 'Apex Supermarket', ipAddress: '192.168.1.50', userAgent: 'Chrome/Win11', oldValue: 'Expired: 2026-06-01', newValue: 'Extended to: 2027-06-01' },
        { id: 'log_02', timestamp: new Date(now - 1*3600000).toISOString(), adminEmail: 'admin@posbilling.com', action: 'PAYMENT_VERIFY', targetBusiness: 'Metro Fresh Hypermarket', ipAddress: '192.168.1.50', userAgent: 'Chrome/Win11', oldValue: 'Pending Verification', newValue: 'Verified (₹199)' }
      ];
      localStorage.setItem(this.dbKeys.auditLogs, JSON.stringify(seedLogs));
    }
  },

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

    this.broadcastRealtimeSync({
      type: 'BUSINESS_UPDATED',
      businessId: biz.id,
      status: biz.status
    });

    return biz;
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

  // --- SUBSCRIPTIONS REPOSITORY & ATOMIC TRANSACTIONS ---
  getSubscriptions() { return this._getData(this.dbKeys.subscriptions); },

  // Atomic Custom Subscription Renewal
  renewSubscriptionAtomic(params) {
    const { businessId, planId, cycle, startDate, expiresAt, amount, notes } = params;

    const businesses = this.getBusinesses();
    const subs = this.getSubscriptions();
    const lics = this.getLicenses();
    const payments = this.getPayments();
    const renewals = this._getData(this.dbKeys.renewals);

    const biz = businesses.find(b => b.id === businessId);
    const sub = subs.find(s => s.businessId === businessId);
    const lic = lics.find(l => l.businessId === businessId);

    if (!biz || !sub) throw new Error('Business subscription record not found.');

    const oldExpiry = sub.expiresAt;
    const oldStatus = sub.status;

    // 1. Update Subscription
    sub.status = 'Active';
    if (planId) sub.planId = planId;
    if (cycle) sub.billingCycle = cycle;
    sub.startDate = startDate || new Date().toISOString();
    sub.expiresAt = expiresAt;
    this._saveData(this.dbKeys.subscriptions, subs);

    // 2. Update Business Status
    biz.status = 'Active';
    this._saveData(this.dbKeys.businesses, businesses);

    // 3. Update License Expiry & Status
    if (lic) {
      lic.status = 'Active';
      lic.expiresAt = expiresAt;
      this._saveData(this.dbKeys.licenses, lics);
    }

    // 4. Record Payment Invoice
    const payId = 'pay_' + Date.now();
    const payment = {
      id: payId,
      businessId,
      invoiceNo: 'INV-SUB-' + Math.floor(1000 + Math.random() * 9000),
      amount: parseFloat(amount) || 0,
      paymentMethod: 'Manual Approval',
      utrRef: 'ADMIN_RENEW_' + Date.now(),
      status: 'Verified',
      createdAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString()
    };
    payments.unshift(payment);
    this._saveData(this.dbKeys.payments, payments);

    // 5. Record Renewal History
    const renewalRecord = {
      id: 'ren_' + Date.now(),
      businessId,
      paymentId: payId,
      oldExpiry,
      newExpiry: expiresAt,
      amount: parseFloat(amount) || 0,
      notes: notes || 'Super Admin Renewal',
      createdAt: new Date().toISOString()
    };
    renewals.unshift(renewalRecord);
    this._saveData(this.dbKeys.renewals, renewals);

    // 6. Record Audit Log
    this.recordAuditLog({
      action: 'SUBSCRIPTION_RENEW',
      targetBusiness: biz.name,
      oldValue: `Status: ${oldStatus}, Expiry: ${new Date(oldExpiry).toLocaleDateString()}`,
      newValue: `Status: Active, Expiry: ${new Date(expiresAt).toLocaleDateString()} (₹${amount})`
    });

    // 7. Realtime Broadcast to Business POS
    this.broadcastRealtimeSync({
      type: 'SUBSCRIPTION_RENEWED',
      businessId,
      status: 'Active',
      expiresAt,
      planId: sub.planId,
      licenseKey: lic ? lic.licenseKey : null
    });

    return sub;
  },

  // Atomic Plan Upgrade / Downgrade
  changePlanAtomic(businessId, newPlanId, cycle = 'Monthly') {
    const businesses = this.getBusinesses();
    const subs = this.getSubscriptions();
    const lics = this.getLicenses();
    const plans = this.getPlans();

    const biz = businesses.find(b => b.id === businessId);
    const sub = subs.find(s => s.businessId === businessId);
    const lic = lics.find(l => l.businessId === businessId);
    const plan = plans.find(p => p.id === newPlanId);

    if (!sub || !plan) throw new Error('Subscription or target Plan not found.');

    const oldPlanId = sub.planId;
    sub.planId = newPlanId;
    sub.billingCycle = cycle;
    sub.status = 'Active';
    this._saveData(this.dbKeys.subscriptions, subs);

    if (lic) {
      lic.maxDevices = plan.deviceLimit || 3;
      lic.status = 'Active';
      this._saveData(this.dbKeys.licenses, lics);
    }

    if (biz) {
      biz.status = 'Active';
      this._saveData(this.dbKeys.businesses, businesses);
    }

    this.recordAuditLog({
      action: 'PLAN_CHANGE',
      targetBusiness: biz ? biz.name : businessId,
      oldValue: `Plan: ${oldPlanId}`,
      newValue: `Plan: ${plan.name} (Max Devices: ${plan.deviceLimit})`
    });

    this.broadcastRealtimeSync({
      type: 'PLAN_CHANGED',
      businessId,
      planId: newPlanId,
      planName: plan.name,
      deviceLimit: plan.deviceLimit,
      status: 'Active'
    });
  },

  // Atomic Suspend Business
  suspendBusinessAtomic(businessId, reason = 'Super Admin Action') {
    const businesses = this.getBusinesses();
    const subs = this.getSubscriptions();
    const lics = this.getLicenses();

    const biz = businesses.find(b => b.id === businessId);
    const sub = subs.find(s => s.businessId === businessId);
    const lic = lics.find(l => l.businessId === businessId);

    if (biz) { biz.status = 'Suspended'; this._saveData(this.dbKeys.businesses, businesses); }
    if (sub) { sub.status = 'Suspended'; this._saveData(this.dbKeys.subscriptions, subs); }
    if (lic) { lic.status = 'Suspended'; this._saveData(this.dbKeys.licenses, lics); }

    this.recordAuditLog({
      action: 'BUSINESS_SUSPEND',
      targetBusiness: biz ? biz.name : businessId,
      oldValue: 'Active / Trial',
      newValue: `Suspended (Reason: ${reason})`
    });

    this.broadcastRealtimeSync({
      type: 'ACCOUNT_SUSPENDED',
      businessId,
      status: 'Suspended',
      reason
    });
  },

  // Atomic Activate Business
  activateBusinessAtomic(businessId) {
    const businesses = this.getBusinesses();
    const subs = this.getSubscriptions();
    const lics = this.getLicenses();

    const biz = businesses.find(b => b.id === businessId);
    const sub = subs.find(s => s.businessId === businessId);
    const lic = lics.find(l => l.businessId === businessId);

    if (biz) { biz.status = 'Active'; this._saveData(this.dbKeys.businesses, businesses); }
    if (sub) {
      sub.status = 'Active';
      // Ensure non-expired date
      if (new Date(sub.expiresAt) <= new Date()) {
        sub.expiresAt = new Date(Date.now() + 30*86400000).toISOString();
      }
      this._saveData(this.dbKeys.subscriptions, subs);
    }
    if (lic) {
      lic.status = 'Active';
      lic.expiresAt = sub ? sub.expiresAt : new Date(Date.now() + 30*86400000).toISOString();
      this._saveData(this.dbKeys.licenses, lics);
    }

    this.recordAuditLog({
      action: 'BUSINESS_ACTIVATE',
      targetBusiness: biz ? biz.name : businessId,
      oldValue: 'Suspended / Expired',
      newValue: 'Active'
    });

    this.broadcastRealtimeSync({
      type: 'ACCOUNT_ACTIVATED',
      businessId,
      status: 'Active',
      expiresAt: sub ? sub.expiresAt : null
    });
  },

  // Atomic Reset Trial
  resetTrialAtomic(businessId, days = 14) {
    const subs = this.getSubscriptions();
    const lics = this.getLicenses();
    const businesses = this.getBusinesses();

    const sub = subs.find(s => s.businessId === businessId);
    const lic = lics.find(l => l.businessId === businessId);
    const biz = businesses.find(b => b.id === businessId);

    const now = new Date();
    const newExp = new Date(now.getTime() + (days * 86400000)).toISOString();

    if (sub) { sub.status = 'Trial'; sub.expiresAt = newExp; this._saveData(this.dbKeys.subscriptions, subs); }
    if (lic) { lic.status = 'Trial'; lic.expiresAt = newExp; this._saveData(this.dbKeys.licenses, lics); }
    if (biz) { biz.status = 'Trial'; this._saveData(this.dbKeys.businesses, businesses); }

    this.recordAuditLog({
      action: 'TRIAL_RESET',
      targetBusiness: biz ? biz.name : businessId,
      oldValue: 'Expired / Suspended',
      newValue: `Trial Reset for ${days} Days (Expires: ${new Date(newExp).toLocaleDateString()})`
    });

    this.broadcastRealtimeSync({
      type: 'TRIAL_RESET',
      businessId,
      status: 'Trial',
      expiresAt: newExp
    });
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

  // --- PAYMENTS REPOSITORY & APPROVAL ---
  getPayments() { return this._getData(this.dbKeys.payments); },

  verifyPayment(paymentId, status) {
    const list = this.getPayments();
    const target = list.find(p => p.id === paymentId);
    if (target) {
      target.status = status;
      target.verifiedAt = new Date().toISOString();
      this._saveData(this.dbKeys.payments, list);

      if (status === 'Verified') {
        this.activateBusinessAtomic(target.businessId);
      }

      this.recordAuditLog({
        action: `PAYMENT_${status.toUpperCase()}`,
        targetBusiness: target.businessId,
        oldValue: 'Pending Verification',
        newValue: `${status} (Amount: ₹${target.amount})`
      });

      this.broadcastRealtimeSync({
        type: 'PAYMENT_VERIFIED',
        businessId: target.businessId,
        paymentStatus: status,
        invoiceNo: target.invoiceNo
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

    this.broadcastRealtimeSync({
      type: 'LICENSE_GENERATED',
      businessId,
      licenseKey: key,
      maxDevices
    });

    return newLicense;
  },

  // --- AUDIT LOGS REPOSITORY ---
  getAuditLogs() { return this._getData(this.dbKeys.auditLogs); }
};
