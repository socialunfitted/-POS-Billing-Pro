/**
 * POS Barcode Handler & Scanner HID Detector
 * Handles Scanner Keyboard Inputs, Format Recognition, and SVG Barcode Rendering.
 */

class BarcodeScannerManager {
  constructor(onScanCallback) {
    this.onScan = onScanCallback;
    this.buffer = '';
    this.lastKeyTime = 0;
    this.scannerThresholdMs = 35; // Keystroke delay threshold for scanner vs human
    this.minBarcodeLength = 3;
    this.listening = true;

    this.initListener();
  }

  initListener() {
    window.addEventListener('keydown', (e) => {
      if (!this.listening) return;

      const currentTime = performance.now();
      const timeDiff = currentTime - this.lastKeyTime;
      this.lastKeyTime = currentTime;

      // Ignore special control keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab'].includes(e.key)) {
        return;
      }

      // If user pressed Enter
      if (e.key === 'Enter') {
        if (this.buffer.length >= this.minBarcodeLength) {
          // If rapid timing or target input is barcode input
          const scannedCode = this.buffer.trim();
          this.buffer = '';
          if (this.onScan) {
            this.onScan(scannedCode, 'ENTER_KEY');
          }
        } else {
          this.buffer = '';
        }
        return;
      }

      // Buffer accumulation for HID rapid scanning
      if (e.key.length === 1) {
        // Reset buffer if delay was too long and user was typing in non-barcode field
        const activeElem = document.activeElement;
        const isInputField = activeElem && (activeElem.tagName === 'INPUT' || activeElem.tagName === 'TEXTAREA' || activeElem.tagName === 'SELECT');
        const isBarcodeField = activeElem && activeElem.id === 'barcodeInput';

        if (timeDiff > 100 && !isBarcodeField) {
          this.buffer = '';
        }

        this.buffer += e.key;
      }
    });
  }

  // Detect Barcode Format Standard
  static detectFormat(barcode) {
    const code = String(barcode).trim();
    if (!code) return 'UNKNOWN';

    // QR Code / URL
    if (code.startsWith('http://') || code.startsWith('https://') || code.includes('KEY:') || code.length > 25) {
      return 'QR Code';
    }
    // EAN-13 (13 numeric digits)
    if (/^\d{13}$/.test(code)) {
      return 'EAN-13';
    }
    // EAN-8 (8 numeric digits)
    if (/^\d{8}$/.test(code)) {
      return 'EAN-8';
    }
    // UPC-A (12 numeric digits)
    if (/^\d{12}$/.test(code)) {
      return 'UPC-A';
    }
    // UPC-E (6 numeric digits)
    if (/^\d{6}$/.test(code)) {
      return 'UPC-E';
    }
    // Custom Internal Barcode (Starts with INT or custom prefix)
    if (code.toUpperCase().startsWith('INT-') || code.toUpperCase().startsWith('POS-')) {
      return 'Custom Internal Barcode';
    }
    // Code 39 / Code 128 (Alphanumeric)
    if (/^[A-Z0-9\-\.\ \$\/\+\%]+$/i.test(code)) {
      return code.length <= 10 ? 'Code 39' : 'Code 128';
    }

    return 'Standard Barcode';
  }

  // Pure SVG Barcode 1D Generator (Code 128 / Barcode visualizer)
  static generateBarcodeSVG(text, options = {}) {
    const width = options.width || 240;
    const height = options.height || 60;
    const cleanText = String(text || '0000000000000').trim();

    // Generate pseudo-random bar pattern deterministic based on character codes
    let barsHtml = '';
    let currentX = 10;
    const barWidthUnit = (width - 20) / (cleanText.length * 11 || 100);

    // Simple robust bar rendering algorithm for visual receipt/label preview
    let hash = 0;
    for (let i = 0; i < cleanText.length; i++) {
      hash = (hash << 5) - hash + cleanText.charCodeAt(i);
      hash |= 0;
    }

    // Start Bar Pattern
    const patterns = [
      [2, 1, 1, 1], [1, 2, 1, 1], [1, 1, 2, 1], [1, 1, 1, 2],
      [2, 2, 1, 1], [1, 2, 2, 1], [1, 1, 2, 2], [2, 1, 2, 1]
    ];

    // Start Quiet zone & Guard bar
    barsHtml += `<rect x="${currentX}" y="5" width="${barWidthUnit * 2}" height="${height - 20}" fill="#000" />`;
    currentX += barWidthUnit * 3;
    barsHtml += `<rect x="${currentX}" y="5" width="${barWidthUnit}" height="${height - 20}" fill="#000" />`;
    currentX += barWidthUnit * 2;

    for (let i = 0; i < cleanText.length; i++) {
      const charCode = cleanText.charCodeAt(i);
      const pattern = patterns[charCode % patterns.length];

      pattern.forEach((w, idx) => {
        if (idx % 2 === 0) {
          barsHtml += `<rect x="${currentX}" y="5" width="${w * barWidthUnit * 1.5}" height="${height - 22}" fill="#000" />`;
        }
        currentX += w * barWidthUnit * 1.5 + barWidthUnit;
      });
    }

    // End Guard Bar
    barsHtml += `<rect x="${currentX}" y="5" width="${barWidthUnit * 2}" height="${height - 20}" fill="#000" />`;

    const svgHtml = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="barcode-svg" style="background:#fff; padding:4px;">
        <g fill="#000">
          ${barsHtml}
        </g>
        <text x="${width / 2}" y="${height - 2}" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle" fill="#000">${cleanText}</text>
      </svg>
    `;

    return svgHtml;
  }
}

// Global Barcode Manager Export
window.BarcodeScannerManager = BarcodeScannerManager;
