/**
 * ============================================================
 * POS SUBSCRIPTION & LICENSE SYSTEM (js/subscription-system.js)
 * Manages First Launch Wizard, Startup Flow, AES Encrypted Offline Cache,
 * Dynamic UPI Payments, Software Lock, Notifications & Auto-Sync Engine.
 * ============================================================
 */
class POSSubscriptionSystem {
  constructor() {
    this.deviceFingerprint = this._getOrCreateDeviceId();
    this.gracePeriodDays = 3;
    this.isLocked = false;
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
  }

  /**
   * Get or Generate Unique Hardware/Device ID for device limit enforcement
   */
  _getOrCreateDeviceId() {
    let devId = localStorage.getItem('pos_device_id');
    if (!devId) {
      const randStr = Math.random().toString(36).substring(2, 8).toUpperCase();
      devId = 'DEV-TERMINAL-' + randStr;
      localStorage.setItem('pos_device_id', devId);
    }
    return devId;
  }

  /**
   * Generate Business ID
   */
  _generateBusinessId() {
    return 'BIZ-' + Math.floor(100000 + Math.random() * 900000);
  }

  /**
   * Generate License Key Format: POS-APEX-XXXX-XXXX-XXXX
   */
  _generateLicenseKey() {
    const hex = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1).toUpperCase();
    return `POS-LIC-${hex()}-${hex()}-${hex()}`;
  }

  /**
   * Initialize System on App Startup
   */
  async init() {
    this.setupNetworkListeners();

    // Check if business registration exists locally
    const vault = await window.posLicenseCrypto.loadVault();
    const settings = window.posStorage ? window.posStorage.getSettings() : {};

    if (!vault || !vault.businessId) {
      // FIRST LAUNCH FLOW
      this.showRegistrationWizard();
      return;
    }

    // SOFTWARE STARTUP FLOW
    await this.runStartupValidation(vault);

    // Initial Auto Sync Attempt
    if (this.isOnline) {
      this.syncWithCloud(vault);
    }
  }

  /**
   * Setup Online/Offline Network Listeners & Realtime Broadcaster Sync
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.showToast('📶 Internet connection restored. Initiating auto-sync...', 'success');
      this.validateOnlineAndSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.showToast('📡 You are offline. POS running on local encrypted license.', 'warning');
    });

    this.setupRealtimeSyncListeners();
  }

  /**
   * Listen for Real-Time Broadcast updates from Super Admin Panel
   */
  setupRealtimeSyncListeners() {
    const handleRealtimePayload = async (payload) => {
      if (!payload || !payload.businessId) return;

      const vault = await window.posLicenseCrypto.loadVault();
      if (!vault || vault.businessId !== payload.businessId) return;

      console.log('⚡ Realtime Subscription Event Received:', payload.type, payload);

      if (payload.type === 'ACCOUNT_SUSPENDED') {
        vault.status = 'Suspended';
        await window.posLicenseCrypto.saveVault(vault);
        this.lockPOS(`🔴 Account Suspended by Super Admin: ${payload.reason || 'Policy Enforcement'}`);
        this.showToast('🔴 Your POS account has been suspended by Super Admin.', 'danger');
      } else if (payload.type === 'ACCOUNT_ACTIVATED' || payload.type === 'SUBSCRIPTION_RENEWED') {
        vault.status = 'Active';
        if (payload.expiresAt) vault.expiresAt = payload.expiresAt;
        if (payload.planId) vault.planId = payload.planId;
        await window.posLicenseCrypto.saveVault(vault);
        this.unlockPOS();
        this.showToast(`🟢 Subscription Activated / Renewed! Expires: ${new Date(vault.expiresAt).toLocaleDateString()}`, 'success');
      } else if (payload.type === 'PLAN_CHANGED') {
        vault.planName = payload.planName || vault.planName;
        vault.maxDevices = payload.deviceLimit || vault.maxDevices;
        await window.posLicenseCrypto.saveVault(vault);
        this.showToast(`⚡ Plan updated to ${payload.planName || 'New Plan'} (Max Devices: ${vault.maxDevices})`, 'success');
      } else if (payload.type === 'TRIAL_RESET') {
        vault.status = 'Trial';
        vault.expiresAt = payload.expiresAt;
        await window.posLicenseCrypto.saveVault(vault);
        this.unlockPOS();
        this.showToast(`🔄 Trial Reset! Expires: ${new Date(vault.expiresAt).toLocaleDateString()}`, 'success');
      }

      // Re-run validation to ensure UI consistency
      const freshVault = await window.posLicenseCrypto.loadVault();
      this.validateOfflineVault(freshVault);
    };

    // BroadcastChannel Listener
    if ('BroadcastChannel' in window) {
      const bc = new BroadcastChannel('pos_subscription_sync_channel');
      bc.onmessage = (event) => {
        handleRealtimePayload(event.data);
      };
    }

    // Storage Event Fallback for cross-tab sync
    window.addEventListener('storage', (e) => {
      if (e.key === 'pos_realtime_broadcast_trigger' && e.newValue) {
        try {
          const payload = JSON.parse(e.newValue);
          handleRealtimePayload(payload);
        } catch (err) {}
      }
    });
  }

  /**
   * ============================================================
   * FIRST LAUNCH - BUSINESS REGISTRATION WIZARD
   * ============================================================
   */
  showRegistrationWizard() {
    const modal = document.getElementById('registrationWizardModal');
    if (modal) {
      modal.style.display = 'flex';
      return;
    }

    const wizardHtml = `
      <div class="modal-overlay" id="registrationWizardModal" style="display:flex; z-index:99999; background:rgba(0,0,0,0.85); backdrop-filter:blur(8px);">
        <div class="modal-box" style="max-width:620px; border:2px solid var(--accent-primary, #3b82f6); box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);">
          <div class="modal-header" style="background:linear-gradient(135deg, rgba(59,130,246,0.2), rgba(139,92,246,0.2));">
            <div class="modal-title" style="font-size:18px; display:flex; align-items:center; gap:8px;">
              <span>⚡ Welcome to POS Billing System</span>
            </div>
          </div>
          
          <div class="modal-body" style="padding:20px; display:flex; flex-direction:column; gap:14px;">
            <div style="font-size:13px; color:var(--text-muted, #94a3b8); line-height:1.5; background:var(--bg-input, rgba(255,255,255,0.05)); padding:12px; border-radius:8px;">
              Complete your initial business setup to generate your <b>Business ID</b>, <b>Offline License Key</b>, and activate your <b>14-Day Free Trial</b>.
            </div>

            <form id="wizForm" onsubmit="window.posSubscriptionSystem.handleWizardSubmit(event)" style="display:flex; flex-direction:column; gap:12px;">
              <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="form-group">
                  <label class="form-label">Store / Business Name *</label>
                  <input type="text" id="wizBizName" class="form-control" placeholder="e.g. Apex Supermarket" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Owner Full Name *</label>
                  <input type="text" id="wizOwnerName" class="form-control" placeholder="e.g. Rajesh Kumar" required>
                </div>
              </div>

              <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="form-group">
                  <label class="form-label">Phone Number *</label>
                  <input type="tel" id="wizPhone" class="form-control" placeholder="+91 9876543210" required>
                </div>
                <div class="form-group">
                  <label class="form-label">Email Address *</label>
                  <input type="email" id="wizEmail" class="form-control" placeholder="owner@store.com" required>
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">Business Address *</label>
                <input type="text" id="wizAddress" class="form-control" placeholder="Shop 12, Main Market, Station Road" required>
              </div>

              <div class="form-row" style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                <div class="form-group">
                  <label class="form-label">GSTIN Number (Optional)</label>
                  <input type="text" id="wizGST" class="form-control" placeholder="27AAAAA0000A1Z5" style="text-transform:uppercase;">
                </div>
                <div class="form-group">
                  <label class="form-label">Store Logo (Optional)</label>
                  <input type="file" id="wizLogoFile" class="form-control" accept="image/*" onchange="window.posSubscriptionSystem.handleLogoUpload(this)">
                </div>
              </div>

              <div id="wizLogoPreview" style="display:none; text-align:center; padding:6px;">
                <img id="wizLogoImg" src="" style="max-height:60px; border-radius:6px; border:1px solid #475569;">
              </div>

              <div style="background:rgba(34,197,94,0.1); border:1px solid rgba(34,197,94,0.3); padding:10px; border-radius:8px; font-size:12px; color:#4ade80;">
                🎁 <b>Included:</b> 14-Day Full Premium Access Trial. No credit card required.
              </div>

              <button type="submit" class="btn-pos btn-success" style="padding:12px; font-size:15px; width:100%; justify-content:center; margin-top:6px;">
                🚀 Register Business & Start POS
              </button>
            </form>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', wizardHtml);
  }

  handleLogoUpload(input) {
    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.uploadedLogoBase64 = e.target.result;
        const img = document.getElementById('wizLogoImg');
        const container = document.getElementById('wizLogoPreview');
        if (img && container) {
          img.src = e.target.result;
          container.style.display = 'block';
        }
      };
      reader.readAsDataURL(input.files[0]);
    }
  }

  async handleWizardSubmit(e) {
    e.preventDefault();

    const bizName = document.getElementById('wizBizName').value.trim();
    const ownerName = document.getElementById('wizOwnerName').value.trim();
    const phone = document.getElementById('wizPhone').value.trim();
    const email = document.getElementById('wizEmail').value.trim();
    const address = document.getElementById('wizAddress').value.trim();
    const gstin = document.getElementById('wizGST').value.trim();

    const bizId = this._generateBusinessId();
    const licKey = this._generateLicenseKey();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (14 * 86400000)).toISOString(); // 14 Day Trial

    const licensePayload = {
      businessId: bizId,
      businessName: bizName,
      ownerName: ownerName,
      phone: phone,
      email: email,
      gstin: gstin,
      address: address,
      licenseKey: licKey,
      planName: '14-Day Free Trial',
      status: 'Trial',
      deviceId: this.deviceFingerprint,
      maxDevices: 3,
      createdAt: now.toISOString(),
      expiresAt: expiresAt,
      lastVerification: now.toISOString()
    };

    // Save encrypted vault
    await window.posLicenseCrypto.saveVault(licensePayload);

    // Save business settings to local POS storage
    if (window.posStorage) {
      window.posStorage.saveSettings({
        storeName: bizName,
        phone: phone,
        email: email,
        address: address,
        gstin: gstin,
        logoBase64: this.uploadedLogoBase64 || null
      });

      window.posStorage.saveSubscription({
        licenseKey: licKey,
        planName: '14-Day Free Trial',
        status: 'Trial',
        expiresAt: expiresAt
      });
    }

    // Try cloud registration if online
    if (this.isOnline) {
      this.registerBusinessCloud(licensePayload);
    }

    // Close Modal
    const modal = document.getElementById('registrationWizardModal');
    if (modal) modal.remove();

    this.showToast(`🎉 Welcome ${bizName}! 14-Day Trial Activated successfully.`, 'success');
    this.unlockPOS();
    this.checkTrialNotifications(licensePayload);
  }

  /**
   * Register business profile to Supabase database
   */
  async registerBusinessCloud(payload) {
    try {
      if (window.SuperAdminDB) {
        window.SuperAdminDB.saveBusiness({
          id: payload.businessId,
          name: payload.businessName,
          ownerName: payload.ownerName,
          email: payload.email,
          phone: payload.phone,
          status: 'Trial'
        });

        window.SuperAdminDB.generateLicenseKey(payload.businessId, 3);
      }
    } catch (err) {
      console.warn('Cloud registration queued for auto-sync:', err);
    }
  }

  /**
   * ============================================================
   * SOFTWARE STARTUP & LICENSE VALIDATION FLOW
   * ============================================================
   */
  async runStartupValidation(vault) {
    if (this.isOnline) {
      await this.validateOnlineAndSync(vault);
    } else {
      this.validateOfflineVault(vault);
    }
  }

  /**
   * OFFLINE VALIDATION FLOW
   */
  validateOfflineVault(vault) {
    if (!vault) {
      this.lockPOS('No valid license key found on device. Please register or activate key.');
      return;
    }

    const now = new Date();
    const expiryDate = new Date(vault.expiresAt);
    const graceDate = new Date(expiryDate.getTime() + (this.gracePeriodDays * 86400000));

    if (now <= expiryDate) {
      // License active & valid
      this.unlockPOS();
      this.checkTrialNotifications(vault);
    } else if (now <= graceDate) {
      // Grace period active
      const remainingHours = Math.ceil((graceDate - now) / (3600 * 1000));
      this.showToast(`⚠️ License Expired. Running on ${remainingHours} Hours Grace Period!`, 'warning');
      this.unlockPOS();
    } else {
      // License Expired beyond grace period
      this.lockPOS(`Subscription Expired on ${expiryDate.toLocaleDateString()}. Please renew to continue.`);
    }
  }

  /**
   * ONLINE VALIDATION FLOW
   */
  async validateOnlineAndSync(cachedVault) {
    try {
      const vault = cachedVault || await window.posLicenseCrypto.loadVault();
      if (!vault || !vault.businessId) return;

      // Query SuperAdmin DB or Cloud endpoint
      let cloudSub = null;
      if (window.SuperAdminDB) {
        const subs = window.SuperAdminDB.getSubscriptions();
        cloudSub = subs.find(s => s.businessId === vault.businessId);
      }

      if (cloudSub) {
        const updatedVault = {
          ...vault,
          status: cloudSub.status,
          expiresAt: cloudSub.expiresAt,
          lastVerification: new Date().toISOString()
        };

        await window.posLicenseCrypto.saveVault(updatedVault);

        if (cloudSub.status === 'Active' || cloudSub.status === 'Trial') {
          const expDate = new Date(cloudSub.expiresAt);
          if (new Date() <= expDate) {
            this.unlockPOS();
            this.checkTrialNotifications(updatedVault);
          } else {
            this.lockPOS(`Subscription Expired on ${expDate.toLocaleDateString()}`);
          }
        } else if (cloudSub.status === 'Suspended') {
          this.lockPOS('Account Suspended by Super Admin. Contact Support.');
        } else {
          this.lockPOS('Subscription Expired. Renew now to unlock POS.');
        }
      } else {
        // Fallback to local encrypted vault check
        this.validateOfflineVault(vault);
      }
    } catch (err) {
      console.warn('Online validation check failed, defaulting to encrypted vault:', err);
      const vault = cachedVault || await window.posLicenseCrypto.loadVault();
      this.validateOfflineVault(vault);
    }
  }

  /**
   * ============================================================
   * SOFTWARE LOCK & UNLOCK CONTROLLER
   * ============================================================
   */
  lockPOS(reasonMessage) {
    this.isLocked = true;

    // Create or show Fullscreen Overlay
    let overlay = document.getElementById('posSoftwareLockOverlay');
    if (!overlay) {
      const html = `
        <div id="posSoftwareLockOverlay" style="position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15,23,42,0.95); backdrop-filter:blur(10px); z-index:999999; display:flex; align-items:center; justify-content:center; padding:20px;">
          <div style="max-width:540px; width:100%; background:#1e293b; border:2px solid #ef4444; border-radius:16px; padding:28px; text-align:center; box-shadow:0 25px 50px -12px rgba(239,68,68,0.3); color:#f8fafc;">
            <div style="font-size:48px; margin-bottom:12px;">🔒</div>
            <div style="font-size:22px; font-weight:800; color:#ef4444; margin-bottom:8px;">SOFTWARE LOCKED</div>
            <div id="lockReasonText" style="font-size:14px; color:#cbd5e1; margin-bottom:20px; line-height:1.5;">
              ${reasonMessage || 'Subscription Expired. Please renew your store plan to continue billing.'}
            </div>

            <div style="display:flex; flex-direction:column; gap:10px;">
              <button class="btn-pos btn-success" style="padding:14px; font-size:15px; font-weight:700; width:100%; justify-content:center;" onclick="window.posSubscriptionSystem.openRenewalModal()">
                💳 Renew POS Subscription Now
              </button>
              
              <button class="btn-pos btn-secondary" style="padding:12px; font-size:13px; width:100%; justify-content:center;" onclick="window.posSubscriptionSystem.openSupportModal()">
                💬 Contact Support & Verification
              </button>
            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', html);
    } else {
      const textElem = document.getElementById('lockReasonText');
      if (textElem) textElem.textContent = reasonMessage;
      overlay.style.display = 'flex';
    }

    // Disable Interactive Elements in Main UI
    const payBtn = document.getElementById('payModalGrandTotal');
    if (payBtn) payBtn.style.pointerEvents = 'none';
  }

  unlockPOS() {
    this.isLocked = false;
    const overlay = document.getElementById('posSoftwareLockOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  /**
   * ============================================================
   * TRIAL & EXPIRY NOTIFICATION SYSTEM
   * ============================================================
   */
  async checkTrialNotifications(vault) {
    if (!vault || !vault.expiresAt) return;

    const now = new Date();
    const exp = new Date(vault.expiresAt);
    const diffDays = Math.ceil((exp - now) / 86400000);

    const notificationBanner = document.getElementById('subscriptionNotificationBanner');
    if (diffDays <= 7 && diffDays > 0) {
      const msg = `⚠️ Your POS Subscription / Trial expires in ${diffDays} Day(s) (${exp.toLocaleDateString()}). Renew now to prevent POS lockout.`;
      this.renderTopBanner(msg, 'warning');
    } else if (diffDays <= 0) {
      const msg = `🔴 Your POS Subscription has Expired. Please renew to continue uninterrupted billing.`;
      this.renderTopBanner(msg, 'danger');
    } else if (notificationBanner) {
      notificationBanner.style.display = 'none';
    }
  }

  renderTopBanner(message, type) {
    let banner = document.getElementById('subscriptionNotificationBanner');
    const colorMap = {
      warning: { bg: 'rgba(245, 158, 11, 0.15)', border: '#f59e0b', text: '#fbbf24' },
      danger: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#fca5a5' }
    };
    const c = colorMap[type] || colorMap.warning;

    if (!banner) {
      const html = `
        <div id="subscriptionNotificationBanner" style="background:${c.bg}; border-bottom:1px solid ${c.border}; color:${c.text}; padding:8px 16px; font-size:12px; font-weight:700; display:flex; justify-space-between; align-items:center; z-index:9990;">
          <span id="subBannerMsg">${message}</span>
          <button class="btn-pos btn-secondary" style="padding:2px 8px; font-size:11px;" onclick="window.posSubscriptionSystem.openRenewalModal()">Renew Now ⚡</button>
        </div>
      `;
      document.body.insertAdjacentHTML('afterbegin', html);
    } else {
      const msgElem = document.getElementById('subBannerMsg');
      if (msgElem) msgElem.textContent = message;
      banner.style.display = 'flex';
    }
  }

  /**
   * ============================================================
   * DYNAMIC NPCI UPI QR PAYMENT GENERATOR
   * ============================================================
   */
  async openRenewalModal() {
    let modal = document.getElementById('upiRenewalModal');
    if (!modal) {
      const html = `
        <div class="modal-overlay" id="upiRenewalModal" style="display:flex; z-index:999999;">
          <div class="modal-box" style="max-width:580px;">
            <div class="modal-header">
              <div class="modal-title">⚡ Instant POS Renewal via Dynamic UPI QR</div>
              <button class="icon-btn" onclick="document.getElementById('upiRenewalModal').style.display='none'">✕</button>
            </div>

            <div class="modal-body" style="display:flex; flex-direction:column; gap:14px;">
              
              <!-- PLAN SELECTOR -->
              <div class="form-group">
                <label class="form-label">Select POS Subscription Plan</label>
                <select id="planSelectDropdown" class="form-control" onchange="window.posSubscriptionSystem.updateUPIQR()">
                  <option value="starter_m" data-price="99" data-name="Starter Plan (Monthly)">Starter Plan - ₹99 / Month</option>
                  <option value="starter_y" data-price="999" data-name="Starter Plan (Annual)">Starter Plan - ₹999 / Year (Save ₹189)</option>
                  <option value="standard_m" data-price="199" data-name="Standard Retail (Monthly)" selected>Standard Retail - ₹199 / Month</option>
                  <option value="standard_y" data-price="1999" data-name="Standard Retail (Annual)">Standard Retail - ₹1999 / Year (Save ₹389)</option>
                  <option value="premium_m" data-price="399" data-name="Premium Supermarket (Monthly)">Premium Supermarket - ₹399 / Month</option>
                  <option value="premium_y" data-price="3999" data-name="Premium Supermarket (Annual)">Premium Supermarket - ₹3999 / Year (Save ₹789)</option>
                  <option value="enterprise_y" data-price="7999" data-name="Enterprise Custom (Annual)">Enterprise Custom - ₹7999 / Year</option>
                </select>
              </div>

              <!-- DYNAMIC QR CARD -->
              <div style="background:var(--bg-input, #0f172a); border:1px solid var(--border-color, #334155); border-radius:12px; padding:16px; text-align:center; display:flex; flex-direction:column; align-items:center; gap:10px;">
                <div style="font-size:12px; color:#94a3b8; font-weight:700;">Scan NPCI Dynamic UPI QR to Pay</div>
                
                <div id="renewalQRContainer" style="background:#ffffff; padding:12px; border-radius:10px; min-width:200px; min-height:200px; display:flex; align-items:center; justify-content:center;">
                  <!-- QRCode Injected Here -->
                </div>

                <div style="font-size:14px; font-weight:800; color:#4ade80;" id="renewalPriceTag">
                  Total Payable: ₹199.00
                </div>

                <div style="font-size:12px; color:#cbd5e1;">
                  UPI ID: <code id="renewalUpiId" style="color:#a78bfa; background:rgba(139,92,246,0.15); padding:2px 8px; border-radius:4px;">bluoot.care@oksbi</code>
                </div>

                <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:center;">
                  <button class="btn-pos btn-secondary" onclick="navigator.clipboard.writeText('bluoot.care@oksbi'); window.posSubscriptionSystem.showToast('UPI ID Copied!', 'success');">📋 Copy UPI ID</button>
                  <button class="btn-pos btn-secondary" onclick="window.posSubscriptionSystem.downloadRenewalQR()">📥 Download QR</button>
                </div>
              </div>

              <!-- PAYMENT UTR REFERENCE SUBMISSION -->
              <div style="background:var(--bg-input, #0f172a); border:1px solid var(--border-color, #334155); border-radius:12px; padding:14px; display:flex; flex-direction:column; gap:8px;">
                <label class="form-label">Enter 12-Digit UPI Transaction UTR / Ref No *</label>
                <div style="display:flex; gap:8px;">
                  <input type="text" id="renewalUtrInput" class="form-control font-mono" placeholder="e.g. 320984719283" maxlength="20">
                  <button class="btn-pos btn-primary" onclick="window.posSubscriptionSystem.submitPaymentUTR()" style="white-space:nowrap;">Submit Payment</button>
                </div>
                <div style="font-size:11px; color:#94a3b8;">
                  After paying via GPay/PhonePe/Paytm, enter your UTR number for Super Admin verification & instant activation.
                </div>
              </div>

            </div>
          </div>
        </div>
      `;
      document.body.insertAdjacentHTML('beforeend', html);
    } else {
      modal.style.display = 'flex';
    }

    this.updateUPIQR();
  }

  updateUPIQR() {
    const dropdown = document.getElementById('planSelectDropdown');
    if (!dropdown) return;

    const opt = dropdown.options[dropdown.selectedIndex];
    const price = opt.getAttribute('data-price');
    const planName = opt.getAttribute('data-name');
    const vault = window.posStorage ? window.posStorage.getSettings() : {};

    const priceTag = document.getElementById('renewalPriceTag');
    if (priceTag) priceTag.textContent = `Total Payable: ₹${price}.00 (${planName})`;

    const upiId = 'bluoot.care@oksbi';
    const merchantName = 'POS Subscription Engine';
    const note = `Sub_${vault.storeName || 'POS'}_${Date.now()}`;
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${price}&tn=${encodeURIComponent(note)}&cu=INR`;

    const qrContainer = document.getElementById('renewalQRContainer');
    if (qrContainer) {
      qrContainer.innerHTML = '';
      if (window.QRCode) {
        new window.QRCode(qrContainer, {
          text: upiUri,
          width: 180,
          height: 180,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: window.QRCode.CorrectLevel.H
        });
      } else {
        qrContainer.textContent = upiUri;
      }
    }
  }

  downloadRenewalQR() {
    const canvas = document.querySelector('#renewalQRContainer canvas');
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'POS_Subscription_Payment_QR.png';
      link.href = canvas.toDataURL();
      link.click();
    } else {
      this.showToast('QR Code image unavailable', 'warning');
    }
  }

  async submitPaymentUTR() {
    const utr = document.getElementById('renewalUtrInput').value.trim();
    if (!utr || utr.length < 6) {
      alert('Please enter a valid 12-digit UPI UTR reference number.');
      return;
    }

    const dropdown = document.getElementById('planSelectDropdown');
    const opt = dropdown.options[dropdown.selectedIndex];
    const price = parseFloat(opt.getAttribute('data-price'));
    const planName = opt.getAttribute('data-name');

    const vault = await window.posLicenseCrypto.loadVault();
    const bizId = vault ? vault.businessId : 'BIZ-UNKNOWN';

    if (window.SuperAdminDB) {
      const paymentRecord = {
        id: 'pay_' + Date.now(),
        businessId: bizId,
        invoiceNo: 'INV-SUB-' + Math.floor(1000 + Math.random() * 9000),
        amount: price,
        paymentMethod: 'UPI / QR',
        utrRef: utr,
        status: 'Pending Verification',
        createdAt: new Date().toISOString()
      };

      const payments = window.SuperAdminDB.getPayments();
      payments.unshift(paymentRecord);
      window.SuperAdminDB._saveData(window.SuperAdminDB.dbKeys.payments, payments);
    }

    this.showToast('✅ Payment UTR Submitted! Super Admin verification in progress.', 'success');
    
    const modal = document.getElementById('upiRenewalModal');
    if (modal) modal.style.display = 'none';
  }

  /**
   * Open Support Modal
   */
  openSupportModal() {
    alert('📞 24/7 Super Admin Support Hotline: +91 9876543210\n📧 Email: support@posbilling.com');
  }

  /**
   * Helper Toast Handler
   */
  showToast(message, type = 'info') {
    const toast = document.getElementById('flashToast');
    if (toast) {
      toast.textContent = message;
      toast.className = 'flashToast active';
      setTimeout(() => toast.className = 'flashToast', 3500);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  }

  /**
   * Auto Sync Engine for offline sales, customers, inventory, and licenses
   */
  async syncWithCloud(vault) {
    if (!this.isOnline) return;
    try {
      console.log('⚡ Auto-Sync Engine running in background...');
      // Sync heartbeat and device session
      if (window.SuperAdminDB && vault) {
        const licenses = window.SuperAdminDB.getLicenses();
        const lic = licenses.find(l => l.businessId === vault.businessId);
        if (lic) {
          lic.lastVerifiedAt = new Date().toISOString();
          window.SuperAdminDB._saveData(window.SuperAdminDB.dbKeys.licenses, licenses);
        }
      }
    } catch (e) {
      console.warn('Auto Sync background process warning:', e);
    }
  }
}

// Export singleton
window.posSubscriptionSystem = new POSSubscriptionSystem();

// Auto initialization on DOM Load
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    window.posSubscriptionSystem.init();
  }, 300);
});
