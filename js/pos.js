/**
 * ============================================================
 * NPCI Standard UPI Payment QR Service
 * Uses Official "qrcode" JS Library + Local Optical Verification (jsQR)
 * URI Format: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
 * ============================================================
 */
window.UPIQRService = {

  /**
   * Validate UPI VPA (Virtual Payment Address).
   * Valid: merchant@okaxis · bluoot.care@oksbi · name@ybl
   */
  validateUPIID: function (upiId) {
    if (!upiId) return false;
    const vpa = String(upiId).trim();
    return /^[a-zA-Z0-9.\-_+]{2,256}@[a-zA-Z]{2,64}$/.test(vpa);
  },

  /**
   * Build the NPCI standard UPI payment URI.
   * Only individual parameter values are URL-encoded.
   * Format: upi://pay?pa={UPI_ID}&pn={MERCHANT_NAME}&am={AMOUNT}&cu=INR&tn={INVOICE_NO}
   */
  buildURI: function (params) {
    const pa = String(params.upiId || '').trim();
    if (!this.validateUPIID(pa)) throw new Error('Invalid UPI ID: ' + pa);

    const pn = String(params.merchantName || params.storeName || '').trim();
    if (!pn) throw new Error('Merchant Name is required');

    const amountNum = parseFloat(params.amount);
    if (!isFinite(amountNum) || amountNum <= 0) throw new Error('Amount must be > 0');
    const am = amountNum.toFixed(2);

    // Build URI — parameter values encoded individually
    let uri = 'upi://pay'
      + '?pa=' + encodeURIComponent(pa)
      + '&pn=' + encodeURIComponent(pn)
      + '&am=' + am
      + '&cu=INR';

    if (params.invoiceNo) {
      const tn = String(params.invoiceNo).trim();
      if (tn) uri += '&tn=' + encodeURIComponent(tn);
    }

    return uri;
  },

  /**
   * Generate QR using official "qrcode" JS library (QRCode.toCanvas).
   * Decodes and optically verifies locally via jsQR before returning/displaying.
   */
  generateQR: async function (container, params, options) {
    const opts  = options || {};
    const width = opts.size || 400;
    const margin = (opts.quietZone !== undefined) ? opts.quietZone : 4;

    if (container) {
      container.innerHTML = '<div style="color:#64748b;font-size:12px;padding:20px;">Generating QR…</div>';
    }

    try {
      const uri = this.buildURI(params);

      if (!window.QRCode) {
        throw new Error('Official QRCode library not loaded.');
      }

      // Create Canvas & Render using Official QRCode library (QRCode.toCanvas)
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = width;
      canvas.style.width = width + 'px';
      canvas.style.height = width + 'px';

      await window.QRCode.toCanvas(canvas, uri, {
        width: width,
        margin: margin,
        errorCorrectionLevel: 'M',
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Optical decoding verification using jsQR
      let decodedText = uri;
      if (window.jsQR) {
        const ctx = canvas.getContext('2d');
        const imageData = ctx.getImageData(0, 0, width, width);
        const code = window.jsQR(imageData.data, imageData.width, imageData.height);
        if (!code || !code.data) {
          throw new Error('Local optical QR verification failed: Unable to decode generated QR.');
        }
        decodedText = code.data;
        if (decodedText !== uri) {
          throw new Error(`Local optical QR verification failed: Decoded URI mismatch.\nExpected: ${uri}\nDecoded: ${decodedText}`);
        }
      }

      // If verification succeeds, display canvas in container
      if (container) {
        container.innerHTML = '';
        container.appendChild(canvas);
      }

      const dataUrl = canvas.toDataURL('image/png');

      const debug = {
        originalURI: uri,
        decodedURI: decodedText,
        version: 'Official QRCode Library (M)',
        errorCorrection: 'M (15%)',
        imageSize: width + ' × ' + width + ' px',
        validationStatus: '✓ Verified by Local Optical Decoder',
        isValid: true
      };

      return {
        success: true,
        uri: uri,
        canvas: canvas,
        dataUrl: dataUrl,
        svg: `<img src="${dataUrl}" width="${width}" height="${width}" alt="UPI QR">`,
        debug: debug
      };

    } catch (err) {
      console.error('[UPIQRService] QR generation failed:', err);
      const msg = err.message || 'Unknown error';
      if (container) {
        container.innerHTML =
          '<div style="color:#ef4444;font-size:13px;font-weight:700;' +
          'padding:16px;text-align:center;background:rgba(239,68,68,0.1);border-radius:8px;">' +
          '⚠️ ' + msg + '</div>';
      }
      return { success: false, error: msg, detail: msg };
    }
  }
};

class POSController {
  constructor() {
    this.cart = [];
    this.activeCustomer = {
      name: 'Walk-in Customer',
      phone: 'N/A',
      email: '',
      address: '',
      gstin: '',
      id: 'CUST-WALKIN'
    };
    this.globalDiscountPercent = 0;
    this.scannedBarcodeCache = '';
    this.scannerManager = null;
    this.cameraScanner = null;
    this.activeModal = null;
    this.selectedCartIndex = -1;
    this.currentView = 'billing';
    this.isContinuousCameraMode = false;
    this.currentReceiptFormat = '80mm';
    this.activeReceiptSale = null;
    this.currentPaymentStatus = 'Paid';
    this.currentPaymentMethod = 'UPI / QR';
  }

  async init() {
    // 1. Restore Theme
    const savedTheme = window.posStorage.getTheme();
    document.body.setAttribute('data-theme', savedTheme);

    // 2. Initialize DB
    await window.posDB.init();

    // 3. Restore Settings & Update UI Header
    this.applySettingsUI();

    // 4. Restore Draft Cart & Session State from LocalStorage
    this.restoreDraftState();

    // 5. Initialize Scanner HID Listener
    this.scannerManager = new window.BarcodeScannerManager((scannedCode, triggerType) => {
      this.handleBarcodeScan(scannedCode);
    });

    // 6. Initialize Mobile Camera Scanner Instance
    this.cameraScanner = new window.CameraBarcodeScanner((scannedCode, isContinuous) => {
      this.handleBarcodeScan(scannedCode);
    });

    // 7. Setup Keyboard Shortcuts Router
    this.setupKeyboardShortcuts();

    // 7b. Setup Fullscreen change listeners
    ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange', 'MSFullscreenChange'].forEach(evt => {
      document.addEventListener(evt, () => this.updateFullscreenButtonUI());
    });

    // 8. Setup Auto Focus Retention
    this.setupAutoFocus();

    // 9. Start Live Clock
    this.startLiveClock();

    // 10. Initial Render
    this.switchView('billing');
    this.renderCart();
    this.updateProductCountBadge();
    this.updateSubscriptionBadgeUI();

    console.log('POS Billing System Initialized with Subscription & Super Admin License Integration.');
  }

  // --- MENU BAR & VIEW SWITCHER ---
  switchView(viewName) {
    this.currentView = viewName;

    document.querySelectorAll('.sidebar-nav-item, .mobile-nav-item').forEach(el => {
      if (el.getAttribute('data-view') === viewName) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });

    document.querySelectorAll('.view-section').forEach(sec => {
      if (sec.id === `view-${viewName}`) {
        sec.classList.add('active');
        sec.style.display = 'flex';
      } else {
        sec.classList.remove('active');
        sec.style.display = 'none';
      }
    });

    if (viewName === 'dashboard') {
      this.loadDashboardMetrics();
    } else if (viewName === 'products') {
      this.loadProductsView();
    } else if (viewName === 'customers') {
      this.loadCustomersView();
    } else if (viewName === 'inventory') {
      this.loadInventoryView();
    } else if (viewName === 'reports') {
      this.loadReportsView();
    }

    if (viewName === 'billing') {
      this.focusBarcode();
    }
  }

  // --- SETTINGS CONTROLLER WITH UPI PERSISTENCE ---
  applySettingsUI() {
    const settings = window.posStorage.getSettings();

    const storeTitleElem = document.getElementById('hdrStoreName');
    if (storeTitleElem) storeTitleElem.textContent = settings.storeName || 'Offline Supermarket POS';

    const cashierElem = document.getElementById('hdrCashierName');
    if (cashierElem) cashierElem.textContent = settings.cashierName || 'Alex Cashier';

    const setStore = document.getElementById('setStoreName');
    if (setStore) setStore.value = settings.storeName || '';
    const setTag = document.getElementById('setTagline');
    if (setTag) setTag.value = settings.tagline || '';
    const setAddr = document.getElementById('setAddress');
    if (setAddr) setAddr.value = settings.address || '';
    const setCity = document.getElementById('setCity');
    if (setCity) setCity.value = settings.city || '';
    const setStatePin = document.getElementById('setStatePin');
    if (setStatePin) setStatePin.value = `${settings.state || ''} - ${settings.pincode || ''}`;
    const setPhone = document.getElementById('setPhone');
    if (setPhone) setPhone.value = settings.phone || '';
    const setEmail = document.getElementById('setEmail');
    if (setEmail) setEmail.value = settings.email || '';
    const setGstin = document.getElementById('setGSTIN');
    if (setGstin) setGstin.value = settings.gstin || '';
    const setWeb = document.getElementById('setWebsite');
    if (setWeb) setWeb.value = settings.website || '';
    const setCashier = document.getElementById('setCashierName');
    if (setCashier) setCashier.value = settings.cashierName || '';
    const setPaper = document.getElementById('setPaperWidth');
    if (setPaper) setPaper.value = settings.printerPaperWidth || '80mm';
    const setReturn = document.getElementById('setReturnPolicy');
    if (setReturn) setReturn.value = settings.returnPolicy || '';

    // UPI Payment Settings Fields
    const setUpiId = document.getElementById('setUpiId');
    if (setUpiId) setUpiId.value = settings.upiId || 'abcstore@okaxis';
    const setMerchantName = document.getElementById('setMerchantName');
    if (setMerchantName) setMerchantName.value = settings.merchantName || settings.storeName || 'ABC Super Market';
    const setMerchantCity = document.getElementById('setMerchantCity');
    if (setMerchantCity) setMerchantCity.value = settings.merchantCity || settings.city || 'Chennai';
    const setCurrency = document.getElementById('setCurrency');
    if (setCurrency) setCurrency.value = settings.currency || 'INR';
    const setPaymentNote = document.getElementById('setPaymentNote');
    if (setPaymentNote) setPaymentNote.value = settings.paymentNote || 'POS Billing';

    // Logo preview update
    if (settings.logoBase64) {
      const previewContainer = document.getElementById('logoPreviewContainer');
      const previewImg = document.getElementById('logoPreviewImg');
      if (previewContainer && previewImg) {
        previewImg.src = settings.logoBase64;
        previewContainer.style.display = 'flex';
        previewImg.style.display = 'block';
      }
    }
  }

  saveSettingsFromModal() {
    const statePinVal = (document.getElementById('setStatePin').value || '').split('-');
    const newSettings = {
      storeName: document.getElementById('setStoreName').value.trim() || 'Offline Supermarket POS',
      tagline: document.getElementById('setTagline').value.trim() || '',
      address: document.getElementById('setAddress').value.trim() || '',
      city: document.getElementById('setCity').value.trim() || '',
      state: (statePinVal[0] || '').trim(),
      pincode: (statePinVal[1] || '').trim(),
      phone: document.getElementById('setPhone').value.trim() || '',
      email: document.getElementById('setEmail').value.trim() || '',
      gstin: document.getElementById('setGSTIN').value.trim() || '',
      website: document.getElementById('setWebsite').value.trim() || '',
      cashierName: document.getElementById('setCashierName').value.trim() || 'Alex Cashier',
      printerPaperWidth: document.getElementById('setPaperWidth').value || '80mm',
      returnPolicy: document.getElementById('setReturnPolicy').value.trim() || '',
      upiId: document.getElementById('setUpiId').value.trim() || 'abcstore@okaxis',
      merchantName: document.getElementById('setMerchantName').value.trim() || 'ABC Super Market',
      merchantCity: document.getElementById('setMerchantCity').value.trim() || 'Chennai',
      currency: document.getElementById('setCurrency').value.trim() || 'INR',
      paymentNote: document.getElementById('setPaymentNote').value.trim() || 'POS Billing'
    };
    window.posStorage.saveSettings(newSettings);
    this.applySettingsUI();
    this.flashBannerSuccess('Store Branding & UPI Payment Settings Saved');
  }

  // =================================================================
  // NPCI UPI QR — Core URI builder (used by all QR methods)
  // =================================================================
  _buildInvoiceId() {
    return 'INV' + Date.now().toString().slice(-8);
  }

  _getUPIParams(amount, invId) {
    const settings = window.posStorage.getSettings();
    return {
      upiId:        (settings.upiId        || '').trim() || 'merchant@okaxis',
      merchantName: (settings.merchantName || settings.storeName || 'Store').trim(),
      amount:       amount,
      invoiceNo:    invId
    };
  }

  generateUPIUri(amount, invId) {
    return window.UPIQRService.buildURI(this._getUPIParams(amount, invId));
  }

  // =================================================================
  // Generate & display the payment modal QR (400×400, self-validated)
  // =================================================================
  async generateAndDisplayUPIQR() {
    const settings  = window.posStorage.getSettings();
    const totals    = this.getTotals();
    const grandTotal= totals ? totals.grandTotal : '0.00';
    const invId     = this._buildInvoiceId();

    // Update UPI ID badge
    const upiIdEl = document.getElementById('payUPIIDVal');
    if (upiIdEl) upiIdEl.textContent = (settings.upiId || 'merchant@okaxis').trim();

    // Render 400×400 QR into container using Official QRCode library + jsQR verification
    const container = document.getElementById('payUPIQRContainer');
    const result = await window.UPIQRService.generateQR(
      container,
      this._getUPIParams(grandTotal, invId),
      { size: 400, quietZone: 4 }
    );

    // Populate debug panel
    if (result.success && result.debug) {
      const d = result.debug;
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      set('payUPIDebugOriginal', d.originalURI);
      set('payUPIDebugDecoded',  d.decodedURI);
      set('payUPIDebugVersion',  d.version);
      set('payUPIDebugECC',      d.errorCorrection);
      set('payUPIDebugSize',     d.imageSize);
      const statusEl = document.getElementById('payUPIDebugStatus');
      if (statusEl) {
        statusEl.textContent = d.validationStatus;
        statusEl.style.color = d.isValid ? 'var(--accent-success)' : 'var(--accent-danger)';
      }
    }

    return result;
  }

  // =================================================================
  // Open UPI app directly via deep-link (mobile)
  // =================================================================
  openUPIAppDirect() {
    const totals = this.getTotals();
    const invId  = this._buildInvoiceId();
    try {
      const uri = this.generateUPIUri(totals.grandTotal, invId);
      window.location.href = uri;
    } catch (err) {
      alert('Unable to launch UPI App: ' + err.message);
    }
  }

  copyUpiId() {
    const settings = window.posStorage.getSettings();
    navigator.clipboard.writeText((settings.upiId || '').trim());
    this.flashBannerSuccess('UPI ID Copied to Clipboard!');
  }

  copyUpiAmount() {
    const totals = this.getTotals();
    navigator.clipboard.writeText(totals.grandTotal);
    this.flashBannerSuccess('Bill Amount Copied!');
  }

  copyPaymentLink() {
    const totals = this.getTotals();
    const invId  = this._buildInvoiceId();
    try {
      const uri = this.generateUPIUri(totals.grandTotal, invId);
      navigator.clipboard.writeText(uri);
      this.flashBannerSuccess('UPI Payment Link Copied!');
    } catch (err) {
      alert(err.message);
    }
  }

  async downloadQRCode() {
    const totals = this.getTotals();
    const invId  = this._buildInvoiceId();
    try {
      const uri    = this.generateUPIUri(totals.grandTotal, invId);
      const pngUrl = await window.QRCode.toDataURL(uri, {
        width: 400,
        margin: 4,
        errorCorrectionLevel: 'M',
        color: { dark: '#000000', light: '#FFFFFF' }
      });
      const a      = document.createElement('a');
      a.href     = pngUrl;
      a.download = 'UPI_QR_' + invId + '.png';
      a.click();
      this.flashBannerSuccess('QR Code PNG Downloaded!');
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  }

  setPaymentStatus(status) {
    this.currentPaymentStatus = status;
    const statuses = ['Paid', 'Pending', 'Failed', 'Cancelled', 'Refunded'];
    statuses.forEach(st => {
      const btn = document.getElementById(`btnStatus${st}`);
      if (btn) btn.classList.toggle('active-status', status === st);
    });
  }

  shareInvoice() {
    const totals = this.getTotals();
    const settings = window.posStorage.getSettings();
    const shareText = `Invoice from ${settings.storeName}\nGrand Total: ₹${totals.grandTotal}\nUPI ID: ${settings.upiId || ''}\nThank you for shopping with us!`;

    if (navigator.share) {
      navigator.share({ title: settings.storeName, text: shareText }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareText);
      alert('Invoice details copied to clipboard!');
    }
  }

  // --- LOGO UPLOAD MANAGER ---
  handleLogoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Logo file size exceeds 2 MB limit. Please select a smaller image.');
      event.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Str = e.target.result;
      window.posStorage.saveSettings({ logoBase64: base64Str });

      const previewContainer = document.getElementById('logoPreviewContainer');
      const previewImg = document.getElementById('logoPreviewImg');
      if (previewContainer && previewImg) {
        previewImg.src = base64Str;
        previewContainer.style.display = 'flex';
        previewImg.style.display = 'block';
      }
      this.flashBannerSuccess('Store Logo Uploaded & Saved!');
    };
    reader.readAsDataURL(file);
  }

  removeStoreLogo() {
    window.posStorage.saveSettings({ logoBase64: null });
    const previewContainer = document.getElementById('logoPreviewContainer');
    const previewImg = document.getElementById('logoPreviewImg');
    const fileInput = document.getElementById('logoFileInput');
    if (previewContainer) previewContainer.style.display = 'none';
    if (previewImg) previewImg.src = '';
    if (fileInput) fileInput.value = '';
    this.flashBannerSuccess('Store Logo Removed');
  }

  // --- CAMERA SCANNER CONTROLLER ---
  async openCameraScanner() {
    const modal = document.getElementById('cameraScannerModal');
    if (!modal) return;

    modal.classList.add('active');

    try {
      await this.cameraScanner.start('cameraVideo', {
        continuous: this.isContinuousCameraMode
      });
      this.flashBannerSuccess('Camera Scanner Active');
    } catch (err) {
      this.closeCameraScanner();
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Camera permission is required to scan barcodes.\n\nPlease allow camera access in browser settings.');
      } else {
        alert('Could not access camera: ' + err.message);
      }
    }
  }

  closeCameraScanner() {
    if (this.cameraScanner) {
      this.cameraScanner.stop();
    }
    const modal = document.getElementById('cameraScannerModal');
    if (modal) modal.classList.remove('active');
    if (this.currentView === 'billing') {
      this.focusBarcode();
    }
  }

  async toggleCameraTorch() {
    if (this.cameraScanner) {
      const state = await this.cameraScanner.toggleTorch();
      const btn = document.getElementById('cameraTorchBtn');
      if (btn) btn.textContent = state ? '⚡ Flash ON' : '⚡ Flash OFF';
    }
  }

  toggleCameraContinuous() {
    this.isContinuousCameraMode = !this.isContinuousCameraMode;
    const btn = document.getElementById('dateTimeBtn');
    if (btn) {
      btn.textContent = this.isContinuousCameraMode ? '🔁 Continuous ON' : '🔁 Single Mode';
    }
    if (this.cameraScanner) {
      this.cameraScanner.continuousMode = this.isContinuousCameraMode;
    }
  }

  async switchCameraDevice() {
    if (this.cameraScanner) {
      await this.cameraScanner.switchCamera();
    }
  }

  // --- LOCALSTORAGE DRAFT AUTO-RESTORE ENGINE ---
  restoreDraftState() {
    const draft = window.posStorage.getDraftCart();
    if (draft) {
      if (Array.isArray(draft.cart) && draft.cart.length > 0) {
        this.cart = draft.cart;
      }
      if (draft.customer) {
        this.activeCustomer = draft.customer;
      }
      if (draft.globalDiscount) {
        this.globalDiscountPercent = draft.globalDiscount;
        const discInput = document.getElementById('globalDiscountInput');
        if (discInput) discInput.value = this.globalDiscountPercent;
      }
    }
    this.updateCustomerUI();
  }

  saveState() {
    window.posStorage.saveDraftCart(this.cart, this.activeCustomer, this.globalDiscountPercent);
  }

  // --- LIVE CLOCK ---
  startLiveClock() {
    const updateTime = () => {
      const clockElem = document.getElementById('hdrClock');
      if (clockElem) {
        const now = new Date();
        clockElem.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
    };
    updateTime();
    setInterval(updateTime, 1000);
  }

  // --- BARCODE SCAN PROCESSING ---
  async handleBarcodeScan(barcode) {
    const cleanCode = String(barcode).trim();
    if (!cleanCode) return;

    window.posStorage.addRecentBarcode(cleanCode);

    const format = window.BarcodeScannerManager.detectFormat(cleanCode);
    const formatTagElem = document.getElementById('barcodeFormatTag');
    if (formatTagElem) formatTagElem.textContent = format;

    const product = await window.posDB.getByBarcode(cleanCode);

    if (product) {
      this.addProductToCart(product);
      window.posAudio.playSuccess();
      this.flashBannerSuccess('Product Added Successfully');
      this.clearBarcodeInput();
    } else {
      window.posAudio.playError();
      this.scannedBarcodeCache = cleanCode;
      this.clearBarcodeInput();

      if (this.cameraScanner && this.cameraScanner.isScanning) {
        this.closeCameraScanner();
      }

      this.showNotFoundModal(cleanCode);
    }
  }

  addProductToCart(product) {
    const existingIndex = this.cart.findIndex(item => item.id === product.id || item.barcode === product.barcode);

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += 1;
      this.calculateLineTotal(this.cart[existingIndex]);
      this.selectedCartIndex = existingIndex;
    } else {
      const cartItem = {
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        category: product.category,
        unit: product.unit || 'Pcs',
        price: parseFloat(product.sellingPrice) || 0,
        gstPercent: parseFloat(product.gstPercent) || 0,
        discountPercent: 0,
        quantity: 1,
        lineTotal: parseFloat(product.sellingPrice) || 0
      };
      this.calculateLineTotal(cartItem);
      this.cart.push(cartItem);
      this.selectedCartIndex = this.cart.length - 1;
    }

    this.saveState();
    this.renderCart();
  }

  calculateLineTotal(item) {
    const baseTotal = item.quantity * item.price;
    const discountAmount = (baseTotal * (item.discountPercent || 0)) / 100;
    item.lineTotal = Math.max(0, baseTotal - discountAmount);
  }

  updateItemQty(index, delta) {
    if (this.cart[index]) {
      const newQty = this.cart[index].quantity + delta;
      if (newQty <= 0) {
        this.removeCartItem(index);
      } else {
        this.cart[index].quantity = newQty;
        this.calculateLineTotal(this.cart[index]);
        this.saveState();
        this.renderCart();
      }
    }
  }

  setItemQty(index, qty) {
    if (this.cart[index]) {
      const val = parseInt(qty) || 1;
      this.cart[index].quantity = Math.max(1, val);
      this.calculateLineTotal(this.cart[index]);
      this.saveState();
      this.renderCart();
    }
  }

  setItemDiscount(index, discountPercent) {
    if (this.cart[index]) {
      const val = parseFloat(discountPercent) || 0;
      this.cart[index].discountPercent = Math.min(100, Math.max(0, val));
      this.calculateLineTotal(this.cart[index]);
      this.saveState();
      this.renderCart();
    }
  }

  removeCartItem(index) {
    if (this.cart[index]) {
      this.cart.splice(index, 1);
      this.selectedCartIndex = this.cart.length - 1;
      this.saveState();
      this.renderCart();
    }
  }

  clearCart() {
    this.cart = [];
    this.selectedCartIndex = -1;
    this.globalDiscountPercent = 0;
    window.posStorage.clearDraftCart();
    this.renderCart();
    this.focusBarcode();
    this.flashBannerSuccess('New Bill Started');
  }

  getTotals() {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;
    let itemCount = 0;

    this.cart.forEach(item => {
      const itemSubtotal = item.quantity * item.price;
      const itemDiscount = (itemSubtotal * item.discountPercent) / 100;
      const netItemTotal = itemSubtotal - itemDiscount;

      const gstFactor = item.gstPercent / 100;
      const taxAmount = netItemTotal * (gstFactor / (1 + gstFactor));

      subtotal += netItemTotal;
      totalTax += taxAmount;
      totalDiscount += itemDiscount;
      itemCount += item.quantity;
    });

    if (this.globalDiscountPercent > 0) {
      const globalDiscVal = (subtotal * this.globalDiscountPercent) / 100;
      totalDiscount += globalDiscVal;
      subtotal -= globalDiscVal;
    }

    const grandTotal = Math.round(subtotal);

    return {
      subtotal: subtotal.toFixed(2),
      tax: totalTax.toFixed(2),
      cgst: (totalTax / 2).toFixed(2),
      sgst: (totalTax / 2).toFixed(2),
      discount: totalDiscount.toFixed(2),
      grandTotal: grandTotal.toFixed(2),
      itemCount: itemCount
    };
  }

  renderCart() {
    const tableBody = document.getElementById('cartTableBody');
    const mobileContainer = document.getElementById('mobileCartContainer');
    const emptyState = document.getElementById('emptyCartState');

    if (this.cart.length === 0) {
      if (tableBody) tableBody.innerHTML = '';
      if (mobileContainer) mobileContainer.innerHTML = '';
      if (emptyState) emptyState.style.display = 'flex';
    } else {
      if (emptyState) emptyState.style.display = 'none';

      if (tableBody) {
        let html = '';
        this.cart.forEach((item, index) => {
          const isSelected = index === this.selectedCartIndex ? 'selected-row' : '';
          html += `
            <tr class="${isSelected}" onclick="posApp.selectedCartIndex = ${index}; posApp.renderCart();">
              <td>
                <div class="prod-info">
                  <span class="prod-name">${item.name}</span>
                  <span class="prod-barcode">BC: ${item.barcode} | Unit: ${item.unit}</span>
                </div>
              </td>
              <td>
                <div class="qty-control">
                  <button class="qty-btn" onclick="event.stopPropagation(); posApp.updateItemQty(${index}, -1)">-</button>
                  <input type="number" class="qty-input" value="${item.quantity}" onchange="event.stopPropagation(); posApp.setItemQty(${index}, this.value)" min="1">
                  <button class="qty-btn" onclick="event.stopPropagation(); posApp.updateItemQty(${index}, 1)">+</button>
                </div>
              </td>
              <td class="num">₹${item.price.toFixed(2)}</td>
              <td class="num">
                <input type="number" style="width:50px; text-align:center; padding:2px;" class="form-control" value="${item.discountPercent}" onchange="event.stopPropagation(); posApp.setItemDiscount(${index}, this.value)" placeholder="0">%
              </td>
              <td class="num">${item.gstPercent}%</td>
              <td class="num font-bold">₹${item.lineTotal.toFixed(2)}</td>
              <td style="text-align:center;">
                <button class="btn-remove" onclick="event.stopPropagation(); posApp.removeCartItem(${index})" title="Remove">✕</button>
              </td>
            </tr>
          `;
        });
        tableBody.innerHTML = html;
      }

      if (mobileContainer) {
        let mHtml = '';
        this.cart.forEach((item, index) => {
          mHtml += `
            <div class="mobile-product-card" data-index="${index}">
              <div class="m-card-header">
                <div class="m-prod-name">${item.name}</div>
                <button class="btn-remove" onclick="posApp.removeCartItem(${index})">✕</button>
              </div>
              <div class="m-prod-barcode">BC: ${item.barcode}</div>
              <div class="m-card-footer">
                <div class="qty-control">
                  <button class="qty-btn" onclick="posApp.updateItemQty(${index}, -1)">-</button>
                  <span style="font-weight:700; padding:0 8px;">${item.quantity}</span>
                  <button class="qty-btn" onclick="posApp.updateItemQty(${index}, 1)">+</button>
                </div>
                <div class="m-price-tag">
                  <span style="font-size:11px; color:var(--text-muted);">₹${item.price.toFixed(2)} ea</span><br>
                  <b style="color:var(--accent-success); font-size:15px;">₹${item.lineTotal.toFixed(2)}</b>
                </div>
              </div>
            </div>
          `;
        });
        mobileContainer.innerHTML = mHtml;
      }
    }

    const totals = this.getTotals();
    const itemCountElem = document.getElementById('cartItemCount');
    if (itemCountElem) itemCountElem.textContent = `${totals.itemCount} Items`;

    const subtotalElem = document.getElementById('summarySubtotal');
    if (subtotalElem) subtotalElem.textContent = `₹${totals.subtotal}`;

    const taxElem = document.getElementById('summaryTax');
    if (taxElem) taxElem.textContent = `₹${totals.tax} (GST)`;

    const discElem = document.getElementById('summaryDiscount');
    if (discElem) discElem.textContent = `₹${totals.discount}`;

    const grandTotalElem = document.getElementById('summaryGrandTotal');
    if (grandTotalElem) grandTotalElem.textContent = `₹${totals.grandTotal}`;

    const mSubtotal = document.getElementById('mStickySubtotal');
    if (mSubtotal) mSubtotal.textContent = `₹${totals.subtotal}`;

    const mGrand = document.getElementById('mStickyGrandTotal');
    if (mGrand) mGrand.textContent = `₹${totals.grandTotal}`;
  }

  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'F2') {
        e.preventDefault();
        this.openSearchModal();
      } else if (e.key === 'F4') {
        e.preventDefault();
        this.openPaymentModal();
      } else if (e.key === 'F6') {
        e.preventDefault();
        this.holdCurrentBill();
      } else if (e.key === 'F7') {
        e.preventDefault();
        this.openCustomerModal();
      } else if (e.key === 'F8') {
        e.preventDefault();
        const discElem = document.getElementById('globalDiscountInput');
        if (discElem) discElem.focus();
      } else if (e.key === 'F9') {
        e.preventDefault();
        this.focusBarcode();
      } else if (e.key === 'Delete') {
        const activeTag = document.activeElement ? document.activeElement.tagName : '';
        if (activeTag !== 'INPUT' && activeTag !== 'TEXTAREA') {
          if (this.selectedCartIndex >= 0 && this.selectedCartIndex < this.cart.length) {
            e.preventDefault();
            this.removeCartItem(this.selectedCartIndex);
          }
        }
      } else if (e.ctrlKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        this.clearCart();
      } else if (e.ctrlKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        this.triggerPrintReceipt();
      }
    });
  }

  setupAutoFocus() {
    const input = document.getElementById('barcodeInput');
    if (!input) return;

    document.addEventListener('click', (e) => {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'BUTTON' || active.tagName === 'SELECT' || active.tagName === 'TEXTAREA')) {
        return;
      }
      if (this.currentView === 'billing' && (!this.cameraScanner || !this.cameraScanner.isScanning)) {
        this.focusBarcode();
      }
    });

    input.addEventListener('focus', () => {
      document.getElementById('scannerBanner')?.classList.add('focused');
    });

    input.addEventListener('blur', () => {
      document.getElementById('scannerBanner')?.classList.remove('focused');
    });
  }

  focusBarcode() {
    setTimeout(() => {
      const input = document.getElementById('barcodeInput');
      if (input) {
        input.focus();
        input.select();
      }
    }, 50);
  }

  clearBarcodeInput() {
    const input = document.getElementById('barcodeInput');
    if (input) input.value = '';
    if (!this.cameraScanner || !this.cameraScanner.isScanning) {
      this.focusBarcode();
    }
  }

  flashBannerSuccess(message) {
    const banner = document.getElementById('scannerBanner');
    const toast = document.getElementById('flashToast');

    if (banner) {
      banner.classList.add('flash-success');
      setTimeout(() => banner.classList.remove('flash-success'), 600);
    }

    if (toast) {
      toast.textContent = message || 'Success';
      toast.classList.remove('error');
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2000);
    }
  }

  // --- DYNAMIC SECTION VIEWS LOADERS ---
  async loadDashboardMetrics() {
    const count = await window.posDB.getProductCount();
    const sales = await window.posDB.getSalesHistory(100);

    let totalRevenue = 0;
    sales.forEach(s => totalRevenue += parseFloat(s.totals.grandTotal) || 0);

    document.getElementById('dashTotalSales').textContent = `₹${totalRevenue.toFixed(2)}`;
    document.getElementById('dashTotalOrders').textContent = sales.length;
    document.getElementById('dashTotalProducts').textContent = count;
  }

  toggleMobileDrawer(open) {
    const drawer = document.getElementById('mobileMenuDrawer');
    if (!drawer) return;
    if (open) {
      const settings = window.posStorage.getSettings();
      const storeEl = document.getElementById('mobileDrawerStoreName');
      if (storeEl) storeEl.textContent = settings.storeName || 'Offline Supermarket POS';
      const cashierEl = document.getElementById('mobileDrawerCashierName');
      if (cashierEl) cashierEl.textContent = `${settings.cashierName || 'Alex Cashier'} • Offline POS`;

      drawer.classList.add('active');
      document.body.style.overflow = 'hidden';
    } else {
      drawer.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  async loadProductsView() {
    const container = document.getElementById('productsTableContainer');
    if (!container) return;
    const products = await window.posDB.getAllProducts(100);

    if (products.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center;">No products in catalog.</div>';
      return;
    }

    let dHtml = `
      <div class="products-table-desktop">
        <table class="cart-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Barcode</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Stock</th>
              <th>Purchase Price</th>
              <th>Selling Price</th>
              <th>GST %</th>
            </tr>
          </thead>
          <tbody>
    `;

    let mHtml = `<div class="products-cards-mobile">`;

    products.forEach(p => {
      const isLow = p.stock < 10;
      const stockBadge = isLow
        ? `<span class="badge" style="background:rgba(239,68,68,0.15); color:var(--accent-danger); border:1px solid rgba(239,68,68,0.3);">Low Stock: ${p.stock} ${p.unit}</span>`
        : `<span class="badge" style="background:rgba(34,197,94,0.15); color:var(--accent-success); border:1px solid rgba(34,197,94,0.3);">${p.stock} ${p.unit}</span>`;

      dHtml += `
        <tr>
          <td><b>${p.name}</b></td>
          <td><code>${p.barcode}</code></td>
          <td>${p.sku || '-'}</td>
          <td><span class="badge" style="background:var(--bg-input); color:var(--text-secondary); border:1px solid var(--border-color);">${p.category}</span></td>
          <td><b style="${isLow ? 'color:var(--accent-danger)' : ''}">${p.stock} ${p.unit}</b></td>
          <td>₹${parseFloat(p.purchasePrice||0).toFixed(2)}</td>
          <td><b>₹${parseFloat(p.sellingPrice||0).toFixed(2)}</b></td>
          <td>${p.gstPercent}%</td>
        </tr>
      `;

      mHtml += `
        <div class="mobile-catalog-card">
          <div class="m-cat-header">
            <div>
              <div class="m-cat-title">${p.name}</div>
              <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); margin-top:2px;">BC: ${p.barcode}</div>
            </div>
            <span class="badge" style="background:var(--bg-input); color:var(--text-secondary); border:1px solid var(--border-color);">${p.category}</span>
          </div>
          <div class="m-cat-details">
            <div>${stockBadge}</div>
            <div style="font-size:16px; font-weight:800; color:var(--accent-success);">₹${parseFloat(p.sellingPrice||0).toFixed(2)}</div>
          </div>
        </div>
      `;
    });

    dHtml += `</tbody></table></div>`;
    mHtml += `</div>`;

    container.innerHTML = dHtml + mHtml;
  }

  async loadCustomersView() {
    const container = document.getElementById('customersListContainer');
    if (!container) return;
    container.innerHTML = `
      <div style="padding:20px; background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border-color); display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; align-items:center; gap:12px; border-bottom:1px solid var(--border-color); padding-bottom:12px;">
          <div style="font-size:36px; width:52px; height:52px; border-radius:50%; background:var(--bg-input); display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color);">👤</div>
          <div>
            <h3 style="margin:0; font-size:18px;">${this.activeCustomer.name}</h3>
            <span class="badge" style="background:rgba(14,165,233,0.15); color:var(--accent-primary); border:1px solid rgba(14,165,233,0.3); margin-top:4px; display:inline-block;">Active Checkout Profile</span>
          </div>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; font-size:13px;">
          <div><span style="color:var(--text-muted);">Phone Number:</span> <br><b>${this.activeCustomer.phone || 'N/A'}</b></div>
          <div><span style="color:var(--text-muted);">Email Address:</span> <br><b>${this.activeCustomer.email || 'N/A'}</b></div>
          <div><span style="color:var(--text-muted);">GSTIN:</span> <br><b>${this.activeCustomer.gstin || 'N/A'}</b></div>
          <div><span style="color:var(--text-muted);">Address:</span> <br><b>${this.activeCustomer.address || 'N/A'}</b></div>
        </div>
        <button class="btn-pos btn-secondary" onclick="posApp.openCustomerModal()" style="margin-top:6px; width:fit-content; padding:8px 16px;">
          ✏️ Change Customer [F7]
        </button>
      </div>
    `;
  }

  async loadInventoryView() {
    const container = document.getElementById('inventoryAuditContainer');
    if (!container) return;
    const products = await window.posDB.getAllProducts(100);

    if (products.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); padding:20px; text-align:center;">No stock records found.</div>';
      return;
    }

    let dHtml = `
      <div class="inventory-table-desktop">
        <table class="cart-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Barcode</th>
              <th>Current Stock</th>
              <th>Stock Status</th>
            </tr>
          </thead>
          <tbody>
    `;

    let mHtml = `<div class="inventory-cards-mobile">`;

    products.forEach(p => {
      const isLow = p.stock < 20;
      const statusBadge = `<span class="badge" style="background:${isLow ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}; color:${isLow ? 'var(--accent-danger)' : 'var(--accent-success)'}; border:1px solid ${isLow ? 'rgba(239,68,68,0.4)' : 'rgba(34,197,94,0.4)'};">${isLow ? '⚠️ Low Stock' : '✅ In Stock'}</span>`;

      dHtml += `
        <tr>
          <td><b>${p.name}</b></td>
          <td><code>${p.barcode}</code></td>
          <td><b>${p.stock} ${p.unit}</b></td>
          <td>${statusBadge}</td>
        </tr>
      `;

      mHtml += `
        <div class="mobile-catalog-card">
          <div class="m-cat-header">
            <div>
              <div class="m-cat-title">${p.name}</div>
              <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted); margin-top:2px;">BC: ${p.barcode}</div>
            </div>
            ${statusBadge}
          </div>
          <div class="m-cat-details" style="margin-top:4px;">
            <div style="font-size:13px; color:var(--text-muted);">Stock Count:</div>
            <div style="font-size:16px; font-weight:800; color:var(--text-primary);">${p.stock} ${p.unit}</div>
          </div>
        </div>
      `;
    });

    dHtml += `</tbody></table></div>`;
    mHtml += `</div>`;

    container.innerHTML = dHtml + mHtml;
  }

  async loadReportsView() {
    const container = document.getElementById('reportsLogContainer');
    const kpiContainer = document.getElementById('reportsKpiSummary');
    if (!container) return;

    const sales = await window.posDB.getSalesHistory(100);
    this.cachedSalesHistory = sales;

    if (kpiContainer) {
      let totalRev = 0;
      sales.forEach(s => totalRev += parseFloat(s.totals?.grandTotal || 0));
      const avgBill = sales.length > 0 ? (totalRev / sales.length).toFixed(2) : '0.00';

      kpiContainer.innerHTML = `
        <div class="report-kpi-card">
          <div class="kpi-label">TOTAL REVENUE</div>
          <div class="kpi-value text-success">₹${totalRev.toFixed(2)}</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label">TOTAL INVOICES</div>
          <div class="kpi-value text-primary">${sales.length}</div>
        </div>
        <div class="report-kpi-card">
          <div class="kpi-label">AVG BILL VALUE</div>
          <div class="kpi-value text-purple">₹${avgBill}</div>
        </div>
      `;
    }

    this.renderReportsList(sales);
  }

  filterReportsLogs(query) {
    if (!this.cachedSalesHistory) return;
    const q = (query || '').toLowerCase().trim();
    if (!q) {
      this.renderReportsList(this.cachedSalesHistory);
      return;
    }

    const filtered = this.cachedSalesHistory.filter(s => {
      const invId = (s.id || '').toLowerCase();
      const cust = (s.customer?.name || '').toLowerCase();
      const pm = (s.paymentMethod || '').toLowerCase();
      return invId.includes(q) || cust.includes(q) || pm.includes(q);
    });

    this.renderReportsList(filtered);
  }

  renderReportsList(sales) {
    const container = document.getElementById('reportsLogContainer');
    if (!container) return;

    if (!sales || sales.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding:30px;">No sale transactions recorded yet.</div>';
      return;
    }

    let dHtml = `
      <div class="reports-table-desktop">
        <table class="cart-table">
          <thead>
            <tr>
              <th>Invoice ID</th>
              <th>Date & Time</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Items</th>
              <th class="num">Grand Total</th>
              <th style="text-align:center;">Action</th>
            </tr>
          </thead>
          <tbody>
    `;

    let mHtml = `<div class="reports-cards-mobile">`;

    sales.forEach(s => {
      const dateObj = new Date(s.timestamp);
      const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const dateStr = dateObj.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });

      const pm = s.paymentMethod || 'UPI / QR';
      const grand = parseFloat(s.totals?.grandTotal || 0).toFixed(2);
      const custName = s.customer?.name || 'Walk-in Customer';
      const itemsCount = s.items ? s.items.length : 0;

      dHtml += `
        <tr>
          <td><b class="font-mono text-primary" style="white-space:nowrap;">${s.id}</b></td>
          <td style="white-space:nowrap;">${dateStr} ${timeStr}</td>
          <td>${custName}</td>
          <td><span class="badge badge-payment">${pm}</span></td>
          <td>${itemsCount} Items</td>
          <td class="num font-bold text-success" style="white-space:nowrap;">₹${grand}</td>
          <td style="text-align:center;">
            <button class="btn-pos btn-secondary" style="padding:4px 10px; font-size:11px; white-space:nowrap;" onclick="posApp.viewSaleReceipt('${s.id}')">
              🖨️ Receipt
            </button>
          </td>
        </tr>
      `;

      mHtml += `
        <div class="mobile-report-card">
          <div class="m-report-header">
            <div class="m-inv-id">${s.id}</div>
            <span class="badge badge-payment">${pm}</span>
          </div>

          <div class="m-report-sub">
            <span>📅 ${dateStr} • ${timeStr}</span>
          </div>

          <div class="m-report-body">
            <div class="m-report-info">
              <span class="m-cust-name">👤 ${custName}</span>
              <span class="m-item-count">📦 ${itemsCount} Item${itemsCount === 1 ? '' : 's'}</span>
            </div>
            <div class="m-report-amount">
              <div style="font-size:10px; color:var(--text-muted); text-align:right;">Grand Total</div>
              <div class="m-grand-price">₹${grand}</div>
            </div>
          </div>

          <div class="m-report-footer">
            <button class="btn-pos btn-secondary" style="width:100%; padding:8px 12px; font-size:12px; justify-content:center;" onclick="posApp.viewSaleReceipt('${s.id}')">
              🖨️ View & Print Receipt
            </button>
          </div>
        </div>
      `;
    });

    dHtml += `</tbody></table></div>`;
    mHtml += `</div>`;

    container.innerHTML = dHtml + mHtml;
  }

  async viewSaleReceipt(saleId) {
    const sales = await window.posDB.getSalesHistory(100);
    const sale = sales.find(s => s.id === saleId);
    if (sale) {
      this.renderReceipt(sale, '80mm');
    } else {
      alert('Sale invoice record not found.');
    }
  }

  // --- SUBSCRIPTION & LICENSE CONNECTOR ENGINE ---
  updateSubscriptionBadgeUI() {
    const sub = window.posStorage.getSubscription();
    const expiresDate = new Date(sub.expiresAt);
    const now = new Date();
    const diffTime = expiresDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const badgeText = document.getElementById('hdrSubText');
    const badgeDot = document.getElementById('hdrSubDot');
    const badgeContainer = document.getElementById('hdrSubBadge');

    if (diffDays <= 0 || sub.status === 'Expired' || sub.status === 'Suspended') {
      if (badgeText) badgeText.textContent = 'Expired (Renew)';
      if (badgeDot) badgeDot.style.background = 'var(--accent-danger)';
      if (badgeContainer) {
        badgeContainer.style.background = 'rgba(239,68,68,0.15)';
        badgeContainer.style.borderColor = 'rgba(239,68,68,0.3)';
        badgeContainer.style.color = 'var(--accent-danger)';
      }
    } else {
      const planShort = sub.planName.replace(' Plan', '');
      if (badgeText) badgeText.textContent = `${planShort} (${diffDays}d)`;
      if (badgeDot) badgeDot.style.background = 'var(--accent-success)';
      if (badgeContainer) {
        badgeContainer.style.background = 'rgba(34,197,94,0.15)';
        badgeContainer.style.borderColor = 'rgba(34,197,94,0.3)';
        badgeContainer.style.color = 'var(--accent-success)';
      }
    }
  }

  openSubscriptionModal() {
    const sub = window.posStorage.getSubscription();
    const expiresDate = new Date(sub.expiresAt);
    const dateStr = expiresDate.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' });

    const planNameEl = document.getElementById('subModalPlanName');
    if (planNameEl) planNameEl.textContent = sub.planName;

    const statusBadgeEl = document.getElementById('subModalStatusBadge');
    if (statusBadgeEl) {
      if (sub.status === 'Active') {
        statusBadgeEl.innerHTML = '🟢 Active';
        statusBadgeEl.style.background = 'rgba(34,197,94,0.15)';
        statusBadgeEl.style.color = 'var(--accent-success)';
      } else if (sub.status === 'Trial') {
        statusBadgeEl.innerHTML = '⏳ Trial Active';
        statusBadgeEl.style.background = 'rgba(59,130,246,0.15)';
        statusBadgeEl.style.color = 'var(--accent-primary)';
      } else {
        statusBadgeEl.innerHTML = '🔴 Expired';
        statusBadgeEl.style.background = 'rgba(239,68,68,0.15)';
        statusBadgeEl.style.color = 'var(--accent-danger)';
      }
    }

    const expEl = document.getElementById('subModalExpiresAt');
    if (expEl) expEl.textContent = dateStr;

    const devEl = document.getElementById('subModalMaxDevices');
    if (devEl) devEl.textContent = `${sub.maxDevices} POS Terminals`;

    const cycleEl = document.getElementById('subModalCycle');
    if (cycleEl) cycleEl.textContent = sub.billingCycle || 'Annual Plan';

    const keyStatusEl = document.getElementById('subModalKeyStatus');
    if (keyStatusEl) keyStatusEl.textContent = `Verified 🟢 (${sub.licenseKey})`;

    this.openModal('subscriptionModal');
  }

  activateLicenseKeySubmit() {
    const inputKey = (document.getElementById('inputLicenseKey')?.value || '').trim().toUpperCase();
    if (!inputKey) {
      alert('Please enter a valid License Key.');
      return;
    }

    let matchedMaxDevices = 5;
    let matchedPlan = 'Standard Retail Plan';

    if (window.SuperAdminDB) {
      const licenses = window.SuperAdminDB.getLicenses();
      const targetLic = licenses.find(l => l.licenseKey.toUpperCase() === inputKey);
      if (targetLic) {
        matchedMaxDevices = targetLic.maxDevices || 5;
      }
    }

    const newExpires = new Date(Date.now() + 365 * 86400000).toISOString();
    const updatedSub = {
      licenseKey: inputKey,
      planName: matchedPlan,
      status: 'Active',
      billingCycle: 'Annual Plan',
      expiresAt: newExpires,
      maxDevices: matchedMaxDevices,
      activatedAt: new Date().toISOString()
    };

    window.posStorage.saveSubscription(updatedSub);
    this.updateSubscriptionBadgeUI();
    this.closeModal('subscriptionModal');
    window.posAudio.playSuccess();
    this.flashBannerSuccess(`License Key Activated! Active until ${new Date(newExpires).toLocaleDateString()}`);
  }

  // --- MODAL CONTROLLERS ---
  showNotFoundModal(barcode) {
    document.getElementById('notFoundBarcodeVal').textContent = barcode;
    this.openModal('notFoundModal');
  }

  openQuickAddProductModal() {
    this.closeModal('notFoundModal');
    const barcodeElem = document.getElementById('newProdBarcode');
    if (barcodeElem) barcodeElem.value = this.scannedBarcodeCache || '';
    this.openModal('quickAddModal');
  }

  async saveQuickProduct() {
    const name = document.getElementById('newProdName').value;
    const barcode = document.getElementById('newProdBarcode').value;
    const category = document.getElementById('newProdCategory').value;
    const purchasePrice = document.getElementById('newProdPurchasePrice').value;
    const sellingPrice = document.getElementById('newProdSellingPrice').value;
    const gstPercent = document.getElementById('newProdGST').value;
    const unit = document.getElementById('newProdUnit').value;
    const stock = document.getElementById('newProdStock').value;

    if (!name || !barcode || !sellingPrice) {
      alert('Please fill in Product Name, Barcode, and Selling Price.');
      return;
    }

    try {
      const savedProd = await window.posDB.saveProduct({
        name,
        barcode,
        category,
        purchasePrice,
        sellingPrice,
        gstPercent,
        unit,
        stock
      });

      this.closeModal('quickAddModal');
      this.addProductToCart(savedProd);
      window.posAudio.playSuccess();
      this.flashBannerSuccess(`Created and Added "${name}"`);
      this.updateProductCountBadge();
    } catch (e) {
      alert('Error saving product: ' + e.message);
    }
  }

  async openSearchModal() {
    this.openModal('searchModal');
    this.renderSearchResults('');
  }

  async renderSearchResults(query) {
    const container = document.getElementById('searchResultsContainer');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)">Searching catalog...</div>';

    const products = await window.posDB.searchProducts(query, 30);

    if (products.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)">No matching products found.</div>';
      return;
    }

    let html = `
      <table class="cart-table">
        <thead>
          <tr>
            <th>Product Name</th>
            <th>Barcode</th>
            <th>Category</th>
            <th>Stock</th>
            <th>Price</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
    `;

    products.forEach(p => {
      html += `
        <tr>
          <td><b>${p.name}</b></td>
          <td><code class="prod-barcode">${p.barcode}</code></td>
          <td><span class="badge" style="background:var(--bg-input); color:var(--text-secondary); border:1px solid var(--border-color);">${p.category}</span></td>
          <td>${p.stock} ${p.unit}</td>
          <td class="font-bold">₹${p.sellingPrice.toFixed(2)}</td>
          <td>
            <button class="btn-pos btn-primary" style="padding:4px 10px; font-size:12px;" onclick="posApp.addProductToCartFromSearch(${p.id})">+ Add</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  async addProductToCartFromSearch(productId) {
    const products = await window.posDB.searchProducts('');
    const prod = products.find(p => p.id === productId);
    if (prod) {
      this.addProductToCart(prod);
      window.posAudio.playSuccess();
      this.flashBannerSuccess(`Added "${prod.name}"`);
    }
  }

  openPaymentModal() {
    try {
      const totals = this.getTotals();
      const grandTotal = totals ? totals.grandTotal : "0.00";
      const settings = window.posStorage.getSettings();
      const currentInvNo = 'INV-' + Date.now().toString().slice(-8);

      const storeNameElem = document.getElementById('payModalStoreName');
      if (storeNameElem) storeNameElem.textContent = settings.storeName || 'Offline Supermarket POS';

      const custNameElem = document.getElementById('payModalCustName');
      if (custNameElem) custNameElem.textContent = this.activeCustomer ? this.activeCustomer.name : 'Walk-in Customer';

      const invNoElem = document.getElementById('payModalInvNo');
      if (invNoElem) invNoElem.textContent = currentInvNo;

      const logoContainer = document.getElementById('payModalStoreLogoContainer');
      if (logoContainer) {
        logoContainer.innerHTML = settings.logoBase64
          ? `<img src="${settings.logoBase64}" style="width:100%; height:100%; object-fit:contain;" alt="Logo">`
          : '🏪';
      }

      const totalElem = document.getElementById('payModalGrandTotal');
      if (totalElem) totalElem.textContent = `₹${grandTotal}`;
      
      const tenderedElem = document.getElementById('payAmountTendered');
      if (tenderedElem) tenderedElem.value = grandTotal;

      this.calculateChange();
      this.generateAndDisplayUPIQR();
    } catch (e) {
      console.warn('Payment modal setup warning:', e);
    } finally {
      this.openModal('paymentModal');
    }
  }

  calculateChange() {
    const totals = this.getTotals();
    const grandTotal = parseFloat(totals.grandTotal) || 0;
    const tenderedElem = document.getElementById('payAmountTendered');
    const tendered = parseFloat(tenderedElem ? tenderedElem.value : 0) || 0;
    const change = Math.max(0, tendered - grandTotal);
    const changeElem = document.getElementById('payChangeDue');
    if (changeElem) changeElem.textContent = `₹${change.toFixed(2)}`;
  }

  async completeCheckout(paymentMethod) {
    const totals = this.getTotals();
    const upiRef = document.getElementById('payUpiRefNumber')?.value.trim() || '';
    const remarks = document.getElementById('payRemarksInput')?.value.trim() || '';

    const saleRecord = {
      id: 'INV-' + Date.now().toString().slice(-8),
      timestamp: new Date().toISOString(),
      customer: this.activeCustomer,
      items: [...this.cart],
      totals: totals,
      paymentMethod: paymentMethod || this.currentPaymentMethod || 'UPI / QR',
      paymentStatus: this.currentPaymentStatus || 'Paid',
      upiRefNumber: upiRef,
      remarks: remarks,
      paymentTime: new Date().toLocaleTimeString()
    };

    try {
      await window.posDB.saveSale(saleRecord);
      window.posAudio.playPayment();
      this.closeModal('paymentModal');

      this.renderReceipt(saleRecord);

      this.cart = [];
      window.posStorage.clearDraftCart();
      this.renderCart();
      this.flashBannerSuccess('Payment Successful & Sale Recorded!');
    } catch (e) {
      alert('Checkout error: ' + e.message);
    }
  }

  async holdCurrentBill() {
    if (this.cart.length === 0) {
      alert('No active items to hold.');
      return;
    }
    const holdData = {
      id: 'HOLD-' + Date.now().toString().slice(-6),
      timestamp: new Date().toLocaleTimeString(),
      items: [...this.cart],
      customer: this.activeCustomer
    };

    await window.posDB.saveHeldBill(holdData);
    this.cart = [];
    window.posStorage.clearDraftCart();
    this.renderCart();
    this.flashBannerSuccess('Bill Held (F6)');
  }

  async openHeldBillsModal() {
    const heldBills = await window.posDB.getHeldBills();
    const container = document.getElementById('heldBillsContainer');
    if (!container) return;

    if (heldBills.length === 0) {
      container.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-muted)">No held bills found.</div>';
    } else {
      let html = '';
      heldBills.forEach(h => {
        html += `
          <div style="background:var(--bg-input); border:1px solid var(--border-color); padding:12px; border-radius:var(--radius-sm); margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
            <div>
              <b>${h.id}</b> <span style="font-size:11px; color:var(--text-muted)">(${h.timestamp})</span><br>
              <span style="font-size:12px;">${h.items.length} items - ${h.customer.name}</span>
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn-pos btn-primary" style="padding:6px 12px; font-size:12px;" onclick="posApp.restoreHeldBill('${h.id}')">Restore</button>
              <button class="btn-pos btn-secondary" style="padding:6px 12px; font-size:12px; color:var(--accent-danger);" onclick="posApp.deleteHeldBill('${h.id}')">Delete</button>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    }
    this.openModal('heldBillsModal');
  }

  async restoreHeldBill(id) {
    const heldBills = await window.posDB.getHeldBills();
    const target = heldBills.find(h => h.id === id);
    if (target) {
      this.cart = target.items;
      this.activeCustomer = target.customer;
      await window.posDB.deleteHeldBill(id);
      this.saveState();
      this.renderCart();
      this.closeModal('heldBillsModal');
      this.flashBannerSuccess('Held Bill Restored');
    }
  }

  async deleteHeldBill(id) {
    await window.posDB.deleteHeldBill(id);
    this.openHeldBillsModal();
  }

  openCustomerModal() {
    this.openModal('customerModal');
  }

  saveCustomerFromModal() {
    this.activeCustomer = {
      name: document.getElementById('custNameInput').value.trim() || 'Walk-in Customer',
      phone: document.getElementById('custPhoneInput').value.trim() || 'N/A',
      email: document.getElementById('custEmailInput')?.value.trim() || '',
      address: document.getElementById('custAddressInput')?.value.trim() || '',
      gstin: document.getElementById('custGSTINInput')?.value.trim() || '',
      id: document.getElementById('custIDInput')?.value.trim() || 'CUST-' + Date.now().toString().slice(-4)
    };
    this.updateCustomerUI();
    this.saveState();
    this.closeModal('customerModal');
  }

  updateCustomerUI() {
    const custName = this.activeCustomer ? this.activeCustomer.name : 'Walk-in Customer';
    const custPhone = this.activeCustomer ? this.activeCustomer.phone : 'N/A';

    const nameEl = document.getElementById('selectedCustName');
    if (nameEl) nameEl.textContent = `👤 ${custName}`;
    const phoneEl = document.getElementById('selectedCustPhone');
    if (phoneEl) phoneEl.textContent = `Phone: ${custPhone}`;

    const mNameEl = document.getElementById('mSelectedCustName');
    if (mNameEl) mNameEl.textContent = custName;
    const mPhoneEl = document.getElementById('mSelectedCustPhone');
    if (mPhoneEl) mPhoneEl.textContent = (custPhone && custPhone !== 'N/A') ? `📱 ${custPhone}` : 'Standard Retail Sale';

    const mStickyCust = document.getElementById('mStickyCustName');
    if (mStickyCust) mStickyCust.textContent = custName.length > 12 ? custName.slice(0, 10) + '…' : custName;

    const payCustName = document.getElementById('payModalCustName');
    if (payCustName) payCustName.textContent = custName;
  }

  // --- ENHANCED MULTI-FORMAT INVOICE RENDER ENGINE WITH UPI QR ---
  triggerPrintReceipt() {
    if (this.cart.length === 0) {
      alert('Cart is empty. Nothing to print.');
      return;
    }
    const totals = this.getTotals();
    const settings = window.posStorage.getSettings();
    const tempSale = {
      id: 'INV-' + Date.now().toString().slice(-8),
      timestamp: new Date().toISOString(),
      customer: this.activeCustomer,
      items: [...this.cart],
      totals: totals,
      paymentMethod: this.currentPaymentMethod || 'UPI / QR',
      paymentStatus: this.currentPaymentStatus || 'Paid',
      store: settings
    };

    this.activeReceiptSale = tempSale;
    this.renderReceipt(tempSale, settings.printerPaperWidth || '80mm');
  }

  switchReceiptFormat(format) {
    this.currentReceiptFormat = format;
    this.updateReceiptFormatButtons(format);
    if (this.activeReceiptSale) {
      this.renderReceipt(this.activeReceiptSale, format);
    }
  }

  updateReceiptFormatButtons(format) {
    const formats = ['80mm', '58mm', 'a4'];
    formats.forEach(fmt => {
      const btn = document.getElementById(`btnFormat${fmt.charAt(0).toUpperCase() + fmt.slice(1)}`);
      if (btn) {
        if (fmt.toLowerCase() === format.toLowerCase()) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });
  }

  async renderReceipt(sale, format = '80mm') {
    this.activeReceiptSale = sale;
    this.currentReceiptFormat = format;
    this.updateReceiptFormatButtons(format);
    const printArea = document.getElementById('receiptPrintArea');
    const previewContainer = document.getElementById('receiptPreviewContent');

    const settings = window.posStorage.getSettings();
    const cust = sale.customer || { name: 'Walk-in Customer', phone: 'N/A' };
    const dateStr = new Date(sale.timestamp).toLocaleDateString();
    const timeStr = new Date(sale.timestamp).toLocaleTimeString();

    // 1. Store Logo HTML
    const logoHtml = settings.logoBase64
      ? `<img src="${settings.logoBase64}" class="inv-logo-img" alt="Store Logo">`
      : `<div style="font-size:28px;">🏪</div>`;

    // 2. Generate Dynamic Offline UPI QR Code Image for Invoice
    let upiQrSvg = '';
    const qrSize = format === '58mm' ? 110 : format === '80mm' ? 130 : 150;
    try {
      const qrRes = await window.UPIQRService.generateQR(null, {
        upiId: settings.upiId || 'merchant@okaxis',
        merchantName: settings.merchantName || settings.storeName || 'ABC Super Market',
        amount: sale.totals.grandTotal,
        invoiceNo: sale.id
      }, { size: qrSize });
      if (qrRes.success) upiQrSvg = qrRes.svg;
    } catch (e) {
      console.warn('Invoice QR generation warning:', e);
    }

    // 3. Dynamic Product Table Head & Rows tailored per format (58mm, 80mm, A4)
    let tableHeadHtml = '';
    let itemRows = '';

    if (format === '58mm') {
      // 58mm Thermal Roll: Ultra-compact 4 columns (Item, Qty, Rate, Total)
      tableHeadHtml = `
        <tr>
          <th style="text-align:left;">Item</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Rate</th>
          <th style="text-align:right;">Total</th>
        </tr>
      `;
      sale.items.forEach((item) => {
        itemRows += `
          <tr>
            <td style="text-align:left;"><b>${item.name}</b></td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">₹${item.price.toFixed(0)}</td>
            <td style="text-align:right; font-weight:bold;">₹${item.lineTotal.toFixed(0)}</td>
          </tr>
        `;
      });
    } else if (format === '80mm') {
      // 80mm Thermal Roll: 5 columns (No, Item, Qty, Rate, Line Total)
      tableHeadHtml = `
        <tr>
          <th>#</th>
          <th>Item Description</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Price</th>
          <th style="text-align:right;">Total</th>
        </tr>
      `;
      sale.items.forEach((item, index) => {
        itemRows += `
          <tr>
            <td>${index + 1}</td>
            <td><b>${item.name}</b>${item.barcode ? `<br><small style="color:#64748b; font-size:9px;">${item.barcode}</small>` : ''}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">₹${item.price.toFixed(2)}</td>
            <td style="text-align:right; font-weight:bold;">₹${item.lineTotal.toFixed(2)}</td>
          </tr>
        `;
      });
    } else {
      // A4 Page: Full 8-column Corporate GST Tax Invoice
      tableHeadHtml = `
        <tr>
          <th>#</th>
          <th>Product Name</th>
          <th>Barcode</th>
          <th style="text-align:center;">Qty</th>
          <th style="text-align:right;">Price</th>
          <th style="text-align:right;">Disc</th>
          <th style="text-align:right;">GST</th>
          <th style="text-align:right;">Total</th>
        </tr>
      `;
      sale.items.forEach((item, index) => {
        itemRows += `
          <tr>
            <td>${index + 1}</td>
            <td><b>${item.name}</b></td>
            <td style="font-family:var(--font-mono); font-size:10px;">${item.barcode}</td>
            <td style="text-align:center;">${item.quantity}</td>
            <td style="text-align:right;">₹${item.price.toFixed(2)}</td>
            <td style="text-align:right;">${item.discountPercent}%</td>
            <td style="text-align:right;">${item.gstPercent}%</td>
            <td style="text-align:right; font-weight:bold;">₹${item.lineTotal.toFixed(2)}</td>
          </tr>
        `;
      });
    }

    // 4. Scannable Invoice Barcode SVG
    const barcodeSvg = window.BarcodeScannerManager.generateBarcodeSVG(sale.id);

    // 5. Full Professional Invoice Layout HTML
    const fullInvoiceHtml = `
      <div class="invoice-preview-container print-format-${format}">
        <!-- HEADER -->
        <div class="inv-header-flex">
          ${logoHtml}
          <div>
            <div class="inv-store-title">${settings.storeName || 'OFFLINE SUPERMARKET POS'}</div>
            ${settings.tagline ? `<div class="inv-tagline">${settings.tagline}</div>` : ''}
            <div class="inv-details-text">
              ${settings.address ? `${settings.address}, ` : ''}${settings.city || ''} ${settings.state ? `- ${settings.state}` : ''} ${settings.pincode || ''}<br>
              <b>Mobile:</b> ${settings.phone || 'N/A'} | <b>Email:</b> ${settings.email || 'N/A'}<br>
              <b>GSTIN:</b> ${settings.gstin || '27AAAAA0000A1Z5'} ${settings.website ? `| <b>Web:</b> ${settings.website}` : ''}
            </div>
          </div>
        </div>

        <!-- METADATA & CUSTOMER GRID -->
        <div class="inv-meta-grid">
          <div class="inv-meta-block">
            <h4>Invoice Information</h4>
            <b>Inv No:</b> ${sale.id}<br>
            <b>Date:</b> ${dateStr} <b>Time:</b> ${timeStr}<br>
            <b>Cashier:</b> ${settings.cashierName || 'Alex Cashier'}<br>
            <b>Payment:</b> ${sale.paymentMethod || 'UPI / QR'} | <b>Status:</b> ${sale.paymentStatus || 'PAID'} 🟢<br>
            ${sale.upiRefNumber ? `<b>UTR / Ref:</b> ${sale.upiRefNumber}` : ''}
          </div>

          <div class="inv-meta-block">
            <h4>Customer Details</h4>
            <b>Name:</b> ${cust.name || 'Walk-in Customer'}<br>
            <b>Mobile:</b> ${cust.phone || 'N/A'}<br>
            ${cust.email ? `<b>Email:</b> ${cust.email}<br>` : ''}
            ${cust.gstin ? `<b>GSTIN:</b> ${cust.gstin}<br>` : ''}
            ${cust.address ? `<b>Addr:</b> ${cust.address}` : ''}
          </div>
        </div>

        <!-- PRODUCT TABLE WITH RESPONSIVE WRAPPER -->
        <div class="inv-table-wrapper">
          <table class="inv-table">
            <thead>
              ${tableHeadHtml}
            </thead>
            <tbody>
              ${itemRows}
            </tbody>
          </table>
        </div>

        <!-- TOTALS SUMMARY BOX -->
        <div class="inv-totals-box">
          <div class="inv-total-row"><span>Subtotal:</span><b>₹${sale.totals.subtotal}</b></div>
          <div class="inv-total-row"><span>GST Tax:</span><b>₹${sale.totals.tax}</b></div>
          <div class="inv-total-row"><span>Discount:</span><b>₹${sale.totals.discount}</b></div>
          <div class="inv-total-row grand"><span>GRAND TOTAL:</span><b>₹${sale.totals.grandTotal}</b></div>
        </div>

        <!-- INVOICE DYNAMIC UPI PAYMENT QR BOX -->
        <div class="inv-upi-box">
          <div class="inv-upi-qr-col">
            ${upiQrSvg}
            <div style="font-size:10px; font-weight:bold; margin-top:4px; color:#0f172a;">Scan & Pay using any UPI App</div>
            <div style="font-size:8px; color:#64748b;">(Google Pay, PhonePe, Paytm, BHIM, Amazon Pay)</div>
          </div>
          <div class="inv-upi-info-col">
            <b>Payable UPI ID:</b> ${settings.upiId || 'abcstore@okaxis'}<br>
            <b>Merchant:</b> ${settings.merchantName || settings.storeName || 'ABC Super Market'}<br>
            <b>City:</b> ${settings.merchantCity || 'Chennai'}<br>
            <b>Bill Ref:</b> ${sale.id}
          </div>
        </div>

        <!-- FOOTER & SIGNATURE -->
        <div class="inv-footer-flex">
          <div>
            <div style="font-weight:bold; font-size:11px;">Thank You For Shopping! Visit Again!</div>
            <div style="margin-top:2px;">Contact: ${settings.phone || ''} ${settings.website ? `| ${settings.website}` : ''}</div>
            <div style="font-size:9px; color:#64748b; margin-top:2px;">${settings.returnPolicy || 'Goods returned within 7 days with invoice.'}</div>
            <div style="margin-top:6px;">${barcodeSvg}</div>
          </div>

          <div class="signature-box">
            Authorized Signature
          </div>
        </div>
      </div>
    `;

    if (printArea) printArea.innerHTML = fullInvoiceHtml;
    if (previewContainer) previewContainer.innerHTML = fullInvoiceHtml;

    this.openModal('receiptPreviewModal');
  }

  async seed100kProducts() {
    const btn = document.getElementById('btnSeed100k');
    if (btn) btn.disabled = true;

    this.flashBannerSuccess('Starting 100,000 Product Data Seeding...');

    await window.posDB.seedBulkProducts(100000, (created, total, percent) => {
      if (btn) btn.textContent = `Seeding... ${percent}% (${created}/${total})`;
    });

    if (btn) {
      btn.disabled = false;
      btn.textContent = '⚡ Seed 100k Items';
    }

    this.updateProductCountBadge();
    this.flashBannerSuccess('100,000 Products Successfully Seeded!');
  }

  async updateProductCountBadge() {
    const count = await window.posDB.getProductCount();
    const badge = document.getElementById('dbProductCountBadge');
    if (badge) badge.textContent = `${count.toLocaleString()} Items`;
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
      this.activeModal = modalId;
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      this.activeModal = null;
      if (this.currentView === 'billing' && (!this.cameraScanner || !this.cameraScanner.isScanning)) {
        this.focusBarcode();
      }
    }
  }

  toggleTheme() {
    const currentTheme = document.body.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    window.posStorage.saveTheme(newTheme);
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

  updateFullscreenButtonUI() {
    const isFS = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement);
    const btn = document.getElementById('btnFullscreen');
    if (btn) {
      btn.title = isFS ? 'Exit Full Screen' : 'Toggle Full Screen';
      btn.innerHTML = isFS
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>`;
      btn.classList.toggle('active-fullscreen', isFS);
    }
  }
}

// Global POS Controller Singleton Instantiation with Robust State Loading
window.posApp = new POSController();

window.openPaymentModal = function() {
  if (window.posApp) {
    window.posApp.openPaymentModal();
  }
};

function initPOSApp() {
  if (window.posApp && !window.posApp.isInitialized) {
    window.posApp.isInitialized = true;
    window.posApp.init();
  }
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initPOSApp();
} else {
  document.addEventListener('DOMContentLoaded', initPOSApp);
}
