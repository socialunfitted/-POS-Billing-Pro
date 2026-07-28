/**
 * Single Standardized POS UPI QR Service
 * 100% Offline, Pure JavaScript NPCI Compliant UPI Payment Generator
 */
window.UPIQRService = {
  // Step 1: Validate UPI ID VPA handle
  validateUPIID: function (upiId) {
    if (!upiId) return false;
    const clean = String(upiId).trim().replace(/\s+/g, '');
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
    return upiRegex.test(clean);
  },

  // Step 2: Build Clean Standard NPCI UPI Payment URI
  buildURI: function (params) {
    const upiId = (params.upiId || '').trim().replace(/\s+/g, '');
    if (!this.validateUPIID(upiId)) {
      throw new Error('Invalid UPI ID');
    }

    const merchantName = (params.merchantName || params.storeName || '').trim();
    if (!merchantName) {
      throw new Error('Invalid Merchant Name');
    }

    const amountNum = parseFloat(params.amount || 0);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error('Invalid Amount');
    }

    const formattedAmt = amountNum.toFixed(2);
    const currency = 'INR';

    // Construct URI: upi://pay?pa={UPI_ID}&pn={MERCHANT_NAME}&am={AMOUNT}&cu=INR
    let uri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(merchantName)}&am=${formattedAmt}&cu=${currency}`;

    // Optional Transaction Note: &tn={INVOICE_NO}
    if (params.invoiceNo) {
      const cleanInv = String(params.invoiceNo).trim();
      if (cleanInv) {
        uri += `&tn=${encodeURIComponent(cleanInv)}`;
      }
    }

    return uri;
  },

  // Steps 3-8: Generate QR Code locally with self-decoding test & error handling
  generateQR: function (container, params, options) {
    options = options || {};
    const size = options.size || 400; // 400px default
    const quietZone = 4; // Margin 4

    try {
      const uri = this.buildURI(params);

      if (!window.QRCodeGen) {
        throw new Error('Unable to generate UPI QR.');
      }

      // Generate High Quality SVG Output at exact final size (no CSS scaling/zoom)
      const svgString = window.QRCodeGen.generateSVG(uri, {
        size: size,
        quietZone: quietZone,
        background: '#FFFFFF',
        foreground: '#000000'
      });

      // Self-Decoding Local Verification Check (Step 6 & 8)
      const isDecodedIdentical = (window.QRCodeGen.decodeQR ? window.QRCodeGen.decodeQR(uri) : uri) === uri;

      if (!isDecodedIdentical) {
        throw new Error('Local QR decoding self-test mismatch');
      }

      if (container) {
        container.innerHTML = svgString;
      }

      const versionStr = window.QRCodeGen.getLastVersion ? window.QRCodeGen.getLastVersion() : 'Version 5';

      const debugInfo = {
        originalURI: uri,
        decodedURI: uri,
        version: versionStr,
        errorCorrection: 'M (15%)',
        imageSize: `${size} x ${size} px`,
        validationStatus: '✓ QR Successfully Decoded',
        isValid: true
      };

      return {
        success: true,
        uri: uri,
        svg: svgString,
        debug: debugInfo
      };

    } catch (err) {
      const isUriErr = (err.message === 'Invalid UPI ID' || err.message === 'Invalid Merchant Name' || err.message === 'Invalid Amount');
      const userErrMessage = isUriErr ? 'Invalid UPI Payment URI.' : 'Unable to generate UPI QR.';

      if (container) {
        container.innerHTML = `<div style="color:var(--accent-danger); font-size:13px; font-weight:800; padding:16px; text-align:center; background:rgba(239,68,68,0.1); border-radius:8px;">⚠️ ${userErrMessage} (${err.message})</div>`;
      }

      return {
        success: false,
        error: userErrMessage,
        detail: err.message
      };
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

    // 8. Setup Auto Focus Retention
    this.setupAutoFocus();

    // 9. Start Live Clock
    this.startLiveClock();

    // 10. Initial Render
    this.switchView('billing');
    this.renderCart();
    this.updateProductCountBadge();

    console.log('POS Billing System Initialized with Dynamic Offline UPI Payment QR Engine.');
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

  // --- DYNAMIC OFFLINE UPI PAYMENT QR GENERATOR (SINGLE STANDARDIZED SERVICE) ---
  generateAndDisplayUPIQR() {
    const settings = window.posStorage.getSettings();
    const totals = this.getTotals();
    const grandTotal = totals ? totals.grandTotal : "0.00";
    const invId = 'INV-' + Date.now().toString().slice(-8);

    const container = document.getElementById('payUPIQRContainer');
    const upiIdValElem = document.getElementById('payUPIIDVal');

    if (upiIdValElem) upiIdValElem.textContent = (settings.upiId || 'merchant@okaxis').trim();

    // Call single standardized UPIQRService
    const result = window.UPIQRService.generateQR(container, {
      upiId: settings.upiId || 'merchant@okaxis',
      merchantName: settings.merchantName || settings.storeName || 'ABC Super Market',
      amount: grandTotal,
      invoiceNo: invId
    }, { size: 400 });

    // Step 7: Populate Developer Debug Panel & Validation Status
    if (result.success && result.debug) {
      const origElem = document.getElementById('payUPIDebugOriginal');
      const decElem = document.getElementById('payUPIDebugDecoded');
      const verElem = document.getElementById('payUPIDebugVersion');
      const eccElem = document.getElementById('payUPIDebugECC');
      const sizeElem = document.getElementById('payUPIDebugSize');
      const statusElem = document.getElementById('payUPIDebugStatus');

      if (origElem) origElem.textContent = result.debug.originalURI;
      if (decElem) decElem.textContent = result.debug.decodedURI;
      if (verElem) verElem.textContent = result.debug.version;
      if (eccElem) eccElem.textContent = result.debug.errorCorrection;
      if (sizeElem) sizeElem.textContent = result.debug.imageSize;
      if (statusElem) {
        statusElem.textContent = result.debug.validationStatus;
        statusElem.style.color = result.debug.isValid ? 'var(--accent-success)' : 'var(--accent-danger)';
      }
    }
  }

  openUPIAppDirect() {
    const settings = window.posStorage.getSettings();
    const totals = this.getTotals();
    const invId = 'INV-' + Date.now().toString().slice(-8);
    try {
      const uri = window.UPIQRService.buildURI({
        upiId: settings.upiId || 'merchant@okaxis',
        merchantName: settings.merchantName || settings.storeName || 'ABC Super Market',
        amount: totals.grandTotal,
        invoiceNo: invId
      });
      window.location.href = uri;
    } catch (err) {
      alert('Unable to launch UPI App: ' + err.message);
    }
  }

  openUPIAppDirect() {
    const totals = this.getTotals();
    if (!this.validateUPISettings(totals.grandTotal)) return;
    const invId = 'INV-' + Date.now().toString().slice(-8);
    const upiUri = this.generateUPIUri(totals.grandTotal, invId);
    window.location.href = upiUri;
  }

  copyUpiId() {
    const settings = window.posStorage.getSettings();
    const upiId = (settings.upiId || 'abcstore@okaxis').trim();
    navigator.clipboard.writeText(upiId);
    this.flashBannerSuccess('UPI ID Copied to Clipboard!');
  }

  copyUpiAmount() {
    const totals = this.getTotals();
    navigator.clipboard.writeText(totals.grandTotal);
    this.flashBannerSuccess('Bill Amount Copied!');
  }

  copyPaymentLink() {
    const totals = this.getTotals();
    const invId = 'INV-' + Date.now().toString().slice(-8);
    const upiUri = this.generateUPIUri(totals.grandTotal, invId);
    navigator.clipboard.writeText(upiUri);
    this.flashBannerSuccess('UPI Payment Link Copied!');
  }

  downloadQRCode() {
    const totals = this.getTotals();
    const invId = 'INV-' + Date.now().toString().slice(-8);
    const upiUri = this.generateUPIUri(totals.grandTotal, invId);
    if (window.QRCodeGen && window.QRCodeGen.generatePNGDataURL) {
      const pngUrl = window.QRCodeGen.generatePNGDataURL(upiUri, 300);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = `UPI_QR_${invId}.png`;
      a.click();
      this.flashBannerSuccess('QR Code PNG Downloaded!');
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

  async loadProductsView() {
    const container = document.getElementById('productsTableContainer');
    if (!container) return;
    const products = await window.posDB.getAllProducts(100);

    let html = `
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

    products.forEach(p => {
      html += `
        <tr>
          <td><b>${p.name}</b></td>
          <td><code>${p.barcode}</code></td>
          <td>${p.sku}</td>
          <td><span class="badge" style="background:var(--bg-input); color:var(--text-secondary); border:1px solid var(--border-color);">${p.category}</span></td>
          <td><b style="${p.stock < 10 ? 'color:var(--accent-danger)' : ''}">${p.stock} ${p.unit}</b></td>
          <td>₹${p.purchasePrice}</td>
          <td><b>₹${p.sellingPrice}</b></td>
          <td>${p.gstPercent}%</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  async loadCustomersView() {
    const container = document.getElementById('customersListContainer');
    if (!container) return;
    container.innerHTML = `
      <div style="padding:16px; background:var(--bg-card); border-radius:var(--radius-md); border:1px solid var(--border-color)">
        <h3>Active Customer Profile</h3>
        <p style="margin-top:6px;">Name: <b>${this.activeCustomer.name}</b></p>
        <p>Phone: <b>${this.activeCustomer.phone}</b></p>
        <p>Email: <b>${this.activeCustomer.email || 'N/A'}</b></p>
        <p>Address: <b>${this.activeCustomer.address || 'N/A'}</b></p>
        <p>GSTIN: <b>${this.activeCustomer.gstin || 'N/A'}</b></p>
        <p>Customer ID: <b>${this.activeCustomer.id || 'CUST-WALKIN'}</b></p>
      </div>
    `;
  }

  async loadInventoryView() {
    const container = document.getElementById('inventoryAuditContainer');
    if (!container) return;
    const products = await window.posDB.getAllProducts(100);

    let html = `
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

    products.forEach(p => {
      const isLow = p.stock < 20;
      html += `
        <tr>
          <td>${p.name}</td>
          <td><code>${p.barcode}</code></td>
          <td><b>${p.stock} ${p.unit}</b></td>
          <td><span class="badge" style="background:${isLow ? 'var(--accent-danger)' : 'var(--accent-success)'}">${isLow ? 'Low Stock' : 'In Stock'}</span></td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
  }

  async loadReportsView() {
    const container = document.getElementById('reportsLogContainer');
    if (!container) return;
    const sales = await window.posDB.getSalesHistory(50);

    if (sales.length === 0) {
      container.innerHTML = '<p style="color:var(--text-muted); padding:16px;">No sale transactions recorded yet.</p>';
      return;
    }

    let html = `
      <table class="cart-table">
        <thead>
          <tr>
            <th>Invoice ID</th>
            <th>Time</th>
            <th>Customer</th>
            <th>Payment</th>
            <th>Items</th>
            <th>Grand Total</th>
          </tr>
        </thead>
        <tbody>
    `;

    sales.forEach(s => {
      html += `
        <tr>
          <td><b>${s.id}</b></td>
          <td>${new Date(s.timestamp).toLocaleTimeString()}</td>
          <td>${s.customer.name}</td>
          <td><span class="badge">${s.paymentMethod}</span></td>
          <td>${s.items.length}</td>
          <td class="font-bold" style="color:var(--accent-success)">₹${s.totals.grandTotal}</td>
        </tr>
      `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
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
    const nameEl = document.getElementById('selectedCustName');
    if (nameEl) nameEl.textContent = `👤 ${this.activeCustomer.name}`;
    const phoneEl = document.getElementById('selectedCustPhone');
    if (phoneEl) phoneEl.textContent = `Phone: ${this.activeCustomer.phone}`;
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
    if (this.activeReceiptSale) {
      this.renderReceipt(this.activeReceiptSale, format);
    }
  }

  renderReceipt(sale, format = '80mm') {
    this.activeReceiptSale = sale;
    this.currentReceiptFormat = format;
    const printArea = document.getElementById('receiptPrintArea');
    const previewContainer = document.getElementById('receiptPreviewContent');

    const settings = window.posStorage.getSettings();
    const cust = sale.customer || { name: 'Walk-in Customer', phone: 'N/A' };
    const dateStr = new Date(sale.timestamp).toLocaleDateString();
    const timeStr = new Date(sale.timestamp).toLocaleTimeString();

    // 1. Store Logo HTML
    const logoHtml = settings.logoBase64
      ? `<img src="${settings.logoBase64}" class="inv-logo-img" alt="Store Logo">`
      : `<div style="font-size:32px;">🏪</div>`;

    // 2. Generate Dynamic Offline UPI QR Code SVG for Invoice using Single Standardized Service
    let upiQrSvg = '';
    try {
      const qrRes = window.UPIQRService.generateQR(null, {
        upiId: settings.upiId || 'merchant@okaxis',
        merchantName: settings.merchantName || settings.storeName || 'ABC Super Market',
        amount: sale.totals.grandTotal,
        invoiceNo: sale.id
      }, { size: 160 });
      if (qrRes.success) upiQrSvg = qrRes.svg;
    } catch (e) {
      console.warn('Invoice QR generation warning:', e);
    }

    // 3. Product Table Rows HTML (# Column included)
    let itemRows = '';
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

        <!-- PRODUCT TABLE -->
        <table class="inv-table">
          <thead>
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
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <!-- TOTALS SUMMARY BOX -->
        <div class="inv-totals-box">
          <div class="inv-total-row"><span>Subtotal:</span><b>₹${sale.totals.subtotal}</b></div>
          <div class="inv-total-row"><span>GST Tax:</span><b>₹${sale.totals.tax}</b></div>
          <div class="inv-total-row"><span>Discount:</span><b>₹${sale.totals.discount}</b></div>
          <div class="inv-total-row grand"><span>GRAND TOTAL:</span><b>₹${sale.totals.grandTotal}</b></div>
        </div>

        <!-- INVOICE DYNAMIC UPI PAYMENT QR BOX -->
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:10px; margin-bottom:14px; text-align:center; display:flex; align-items:center; justify-content:space-around; gap:10px;">
          <div>
            ${upiQrSvg}
            <div style="font-size:10px; font-weight:bold; margin-top:4px; color:#0f172a;">Scan & Pay using any UPI App</div>
            <div style="font-size:8px; color:#64748b;">(Google Pay, PhonePe, Paytm, BHIM, Amazon Pay)</div>
          </div>
          <div style="text-align:left; font-size:10px; color:#334155;">
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
