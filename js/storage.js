/**
 * POS LocalStorage Auto-Save Persistence Engine
 * Extended for Store Logo Base64, Branding Metadata, and Invoice Settings.
 */
class POSStorage {
  constructor() {
    this.STORAGE_KEYS = {
      THEME: 'pos_theme',
      DRAFT_CART: 'pos_draft_cart',
      ACTIVE_CUSTOMER: 'pos_active_customer',
      GLOBAL_DISCOUNT: 'pos_global_discount',
      SETTINGS: 'pos_settings',
      RECENT_BARCODES: 'pos_recent_barcodes',
      SEARCH_HISTORY: 'pos_search_history',
      USER_PREFS: 'pos_user_prefs'
    };
  }

  // --- THEME ---
  getTheme() {
    return localStorage.getItem(this.STORAGE_KEYS.THEME) || 'dark';
  }

  saveTheme(theme) {
    localStorage.setItem(this.STORAGE_KEYS.THEME, theme);
  }

  // --- DRAFT CART PERSISTENCE ---
  saveDraftCart(cart, customer, globalDiscount = 0) {
    try {
      const payload = {
        cart: cart || [],
        customer: customer || { name: 'Walk-in Customer', phone: 'N/A' },
        globalDiscount: globalDiscount || 0,
        savedAt: new Date().toISOString()
      };
      localStorage.setItem(this.STORAGE_KEYS.DRAFT_CART, JSON.stringify(payload));
    } catch (e) {
      console.warn('LocalStorage saveDraftCart error:', e);
    }
  }

  getDraftCart() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.DRAFT_CART);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  clearDraftCart() {
    localStorage.removeItem(this.STORAGE_KEYS.DRAFT_CART);
  }

  // --- STORE BRANDING & INVOICE SETTINGS ---
  getSettings() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.SETTINGS);
      const defaults = {
        storeName: 'Offline Supermarket POS',
        tagline: 'Your Trusted Neighborhood Store',
        address: '123 Retail Avenue, Commercial Zone',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        phone: '+91 9876543210',
        email: 'billing@posstore.com',
        gstin: '27AAAAA0000A1Z5',
        website: 'www.posstore.com',
        logoBase64: null,
        printerPaperWidth: '80mm',
        autoPrintReceipt: true,
        enableBeepSound: true,
        returnPolicy: 'Goods once sold can be returned within 7 days with original invoice.',
        termsConditions: 'Thank you for shopping with us! Visit Again!',
        upiId: 'abcstore@okaxis',
        merchantName: 'Offline Supermarket POS',
        merchantCity: 'Mumbai',
        currency: 'INR',
        paymentNote: 'POS Retail Billing'
      };
      return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    } catch (e) {
      return {
        storeName: 'Offline Supermarket POS',
        tagline: 'Your Trusted Neighborhood Store',
        address: '123 Retail Avenue, Commercial Zone',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        phone: '+91 9876543210',
        email: 'billing@posstore.com',
        gstin: '27AAAAA0000A1Z5',
        website: 'www.posstore.com',
        logoBase64: null,
        printerPaperWidth: '80mm',
        autoPrintReceipt: true,
        enableBeepSound: true,
        returnPolicy: 'Goods once sold can be returned within 7 days with original invoice.',
        termsConditions: 'Thank you for shopping with us! Visit Again!',
        upiId: 'abcstore@okaxis',
        merchantName: 'Offline Supermarket POS',
        merchantCity: 'Mumbai',
        currency: 'INR',
        paymentNote: 'POS Retail Billing'
      };
    }
  }

  saveSettings(settingsObj) {
    try {
      const current = this.getSettings();
      const updated = { ...current, ...settingsObj };
      localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage saveSettings error:', e);
    }
  }

  // --- RECENT BARCODES HISTORY ---
  addRecentBarcode(code) {
    if (!code) return;
    try {
      let history = this.getRecentBarcodes();
      history = history.filter(c => c.code !== code);
      history.unshift({ code: code, time: new Date().toLocaleTimeString() });
      if (history.length > 20) history = history.slice(0, 20);
      localStorage.setItem(this.STORAGE_KEYS.RECENT_BARCODES, JSON.stringify(history));
    } catch (e) {}
  }

  getRecentBarcodes() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEYS.RECENT_BARCODES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  }

  // --- SUBSCRIPTION & LICENSE MANAGEMENT ---
  getSubscription() {
    try {
      const data = localStorage.getItem('pos_subscription');
      const defaults = {
        licenseKey: 'POS-APEX-9988-7766-1011',
        planName: 'Standard Retail Plan',
        status: 'Active',
        billingCycle: 'Annual Plan',
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        maxDevices: 3,
        activatedAt: new Date().toISOString()
      };
      return data ? { ...defaults, ...JSON.parse(data) } : defaults;
    } catch (e) {
      return {
        licenseKey: 'POS-APEX-9988-7766-1011',
        planName: 'Standard Retail Plan',
        status: 'Active',
        billingCycle: 'Annual Plan',
        expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        maxDevices: 3,
        activatedAt: new Date().toISOString()
      };
    }
  }

  saveSubscription(subObj) {
    try {
      const current = this.getSubscription();
      const updated = { ...current, ...subObj };
      localStorage.setItem('pos_subscription', JSON.stringify(updated));
    } catch (e) {
      console.warn('LocalStorage saveSubscription error:', e);
    }
  }
}

// Global Export Singleton
window.posStorage = new POSStorage();
