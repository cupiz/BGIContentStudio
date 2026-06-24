/**
 * BGI Content Studio - Instagram Scraper Backend (v2)
 * Express server menggunakan Playwright untuk scrape profil Instagram secara real.
 * Strategi: Buka halaman profil -> tutup popup -> klik setiap post -> ambil caption lengkap
 */
import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import os from 'os';

const app = express();
const DEFAULT_PORT = parseInt(process.env.BGI_SERVER_PORT || '3001', 10);

// ===== Serve frontend static files in production (Electron) =====
// This allows the Electron window to load from http://localhost:PORT
// so that relative /api/ fetch calls work correctly (no Vite proxy).
const isProduction = process.env.NODE_ENV === 'production';
const distPath = process.env.BGI_FRONTEND_DIST || path.join(process.cwd(), 'dist');
if (isProduction && fs.existsSync(distPath)) {
  console.log(`[Server] Serving frontend from: ${distPath}`);
  app.use(express.static(distPath));
}

app.use(cors());
app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ limit: '200mb', extended: true }));

// Increase Node.js HTTP server max body size
app.use((req, res, next) => {
  req.setTimeout(120000);
  next();
});

/**
 * Helper: Coba listen ke port, jika EADDRINUSE coba port berikutnya.
 * Langsung pakai app.listen() — tidak ada TOCTOU race condition.
 */
async function startServer(port, maxAttempts = 20) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(port, '0.0.0.0', () => resolve({ srv, port }));
    srv.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && maxAttempts > 0) {
        srv.close(() => {
          console.log(`  Port ${port} sibuk, coba ${port + 1}...`);
          resolve(startServer(port + 1, maxAttempts - 1));
        });
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Stealth evasions untuk menghindari deteksi Playwright oleh Google/Gemini.
 * Panggil setelah context dibuat, sebelum navigasi ke Gemini.
 */
// ============================================================
// STEALTH CONFIGURATION — diperbarui untuk Chrome 135 (2026)
// ============================================================

// User-agent Chrome real Windows (versi 2026)
const CHROME_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36';

// Alternatif: Edge UA (lebih jarang diblokir karena Edge = Chromium resmi)
const EDGE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36 Edg/135.0.0.0';

// Daftar viewport yang umum dipakai (variasi realistis)
const VIEWPORT_PRESETS = [
  { width: 1280, height: 800 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1536, height: 864 },
  { width: 1920, height: 1080 },
  { width: 1600, height: 900 },
];

function randomViewport() {
  const preset = VIEWPORT_PRESETS[Math.floor(Math.random() * VIEWPORT_PRESETS.length)];
  // Tambah variasi ±5px agar tidak selalu sama
  return {
    width: preset.width + Math.floor(Math.random() * 10) - 5,
    height: preset.height + Math.floor(Math.random() * 10) - 5,
  };
}

function randomTimezone() {
  const timezones = [
    'Asia/Jakarta', 'Asia/Makassar', 'Asia/Jayapura',
    'Asia/Singapore', 'Asia/Bangkok', 'Asia/Kuala_Lumpur'
  ];
  return timezones[Math.floor(Math.random() * timezones.length)];
}

/**
 * Stealth evasions KOMPREHENSIF untuk menghindari deteksi Playwright oleh Google/Gemini.
 * Mencakup 15+ sinyal fingerprint yang biasa dicek oleh Google Bot Detection.
 * Panggil setelah context dibuat, sebelum navigasi ke Gemini.
 */
async function applyStealthEvasions(context) {
  await context.addInitScript(() => {
    // ============================================================
    // 1. webdriver — sinyal PALING PENTING, wajib disembunyikan
    // ============================================================
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    });

    // ============================================================
    // 2. chrome.runtime — sinyal automation klasik
    // ============================================================
    if (window.chrome && window.chrome.runtime) {
      try {
        Object.defineProperty(window.chrome, 'runtime', {
          get: () => undefined,
          configurable: true,
        });
      } catch (_) {
        try { delete window.chrome.runtime; } catch (_e) {}
      }
    }

    // ============================================================
    // 3. navigator.languages — set bahasa wajar
    // ============================================================
    Object.defineProperty(navigator, 'languages', {
      get: () => ['id-ID', 'id', 'en-US', 'en'],
    });

    // ============================================================
    // 4. navigator.platform — set platform wajar
    // ============================================================
    Object.defineProperty(navigator, 'platform', {
      get: () => 'Win32',
    });

    // ============================================================
    // 5. navigator.plugins — Chrome real punya ~5 plugin
    // Playwright headless punya 0 atau array kosong → SANGAT CURIGA
    // ============================================================
    Object.defineProperty(navigator, 'plugins', {
      get: () => [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai' },
        { name: 'Native Client', filename: 'internal-nacl-plugin' },
      ],
    });

    // ============================================================
    // 6. navigator.mimeTypes — Chrome real punya ~4 mime types
    // ============================================================
    Object.defineProperty(navigator, 'mimeTypes', {
      get: () => [
        { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        { type: 'text/pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format' },
        { type: 'application/x-nacl', suffixes: '', description: 'Native Client Executable' },
      ],
    });

    // ============================================================
    // 7. navigator.hardwareConcurrency — CPU cores
    // Headless sering lapor 2 atau 4, tapi real PC bisa 8/16
    // ============================================================
    const cpuCores = [4, 8, 12, 16][Math.floor(Math.random() * 4)];
    Object.defineProperty(navigator, 'hardwareConcurrency', {
      get: () => cpuCores,
    });

    // ============================================================
    // 8. navigator.deviceMemory — RAM dalam GB
    // Headless undefined, real PC 4/8
    // ============================================================
    Object.defineProperty(navigator, 'deviceMemory', {
      get: () => [4, 8, 8, 16][Math.floor(Math.random() * 4)],
    });

    // ============================================================
    // 9. navigator.connection — Network type
    // ============================================================
    Object.defineProperty(navigator, 'connection', {
      get: () => ({
        effectiveType: ['4g', '4g', '4g', 'wifi'][Math.floor(Math.random() * 4)],
        downlink: 10,
        rtt: 50,
        saveData: false,
      }),
    });

    // ============================================================
    // 10. navigator.pdfViewerEnabled — property baru di Chrome 135+
    // ============================================================
    Object.defineProperty(navigator, 'pdfViewerEnabled', {
      get: () => true,
    });

    // ============================================================
    // 11. WebGL vendor/renderer — Headless punya fingerprint
    //     'Google Inc. (Intel)' vs 'Google SwiftShader' (headless)
    // ============================================================
    try {
      const getWebGLInfo = () => {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
          const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
          if (debugInfo) {
            return {
              vendor: gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL),
              renderer: gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL),
            };
          }
        }
        return null;
      };
      const webglInfo = getWebGLInfo();
      // Jika renderer mengandung 'SwiftShader' atau 'Mesa' → headless detected
      if (webglInfo && (
        webglInfo.renderer.toLowerCase().includes('swiftshader') ||
        webglInfo.renderer.toLowerCase().includes('mesa') ||
        webglInfo.vendor.toLowerCase().includes('mesa')
      )) {
        // Override WebGL info dengan nilai realistik
        const origGetParam1 = WebGLRenderingContext.prototype.getParameter;
        WebGLRenderingContext.prototype.getParameter = function(parameter) {
          if (parameter === 0x1F01) return 'Intel Inc.\u0020';     // UNMASKED_VENDOR_WEBGL
          if (parameter === 0x1F00) return 'Intel(R) Iris(R) Xe Graphics'; // UNMASKED_RENDERER_WEBGL
          return origGetParam1.call(this, parameter);
        };
        // Juga override WebGL2 (Gemini modern pakai WebGL2)
        if (window.WebGL2RenderingContext) {
          const origGetParam2 = WebGL2RenderingContext.prototype.getParameter;
          WebGL2RenderingContext.prototype.getParameter = function(parameter) {
            if (parameter === 0x1F01) return 'Intel Inc.\u0020';
            if (parameter === 0x1F00) return 'Intel(R) Iris(R) Xe Graphics';
            return origGetParam2.call(this, parameter);
          };
        }
      }
    } catch (_) {}

    // ============================================================
    // 12. Screen properties — colorDepth, orientation
    // ============================================================
    Object.defineProperty(screen, 'colorDepth', {
      get: () => 24,
    });
    Object.defineProperty(screen, 'pixelDepth', {
      get: () => 24,
    });

    // ============================================================
    // 13. navigator.permissions — override query untuk
    //     menghindari fingerprint permission state
    // ============================================================
    if (navigator.permissions && navigator.permissions.query) {
      const originalQuery = navigator.permissions.query.bind(navigator.permissions);
      navigator.permissions.query = (desc) => {
        if (desc.name === 'notifications') {
          return Promise.resolve({ state: 'prompt', onchange: null });
        }
        return originalQuery(desc);
      };
    }

    // ============================================================
    // 14. navigator.mediaCapabilities — headless sering beda
    // ============================================================
    if (navigator.mediaCapabilities && navigator.mediaCapabilities.decodingInfo) {
      const originalDecodingInfo = navigator.mediaCapabilities.decodingInfo.bind(navigator.mediaCapabilities);
      navigator.mediaCapabilities.decodingInfo = (config) => {
        return Promise.resolve({
          supported: true,
          smooth: true,
          powerEfficient: true,
        });
      };
    }

    // ============================================================
    // 15. Hilangkan properti AutomationControlled dari Chrome
    // ============================================================
    if (window.chrome) {
      // Hapus properti khas automation seperti 'loadTimes', 'csi'
      if (window.chrome.loadTimes) {
        try { delete window.chrome.loadTimes; } catch (_) {}
      }
      if (window.chrome.csi) {
        try { delete window.chrome.csi; } catch (_) {}
      }
    }
  });
}

/**
 * Helper: Upload gambar referensi ke halaman Gemini menggunakan
 * Playwright file chooser event.
 *
 * Alur upload Gemini web (observasi 2025):
 *   1. Klik tombol "+" (Add) di input chat
 *   2. Muncul popup menu dengan opsi "Upload file"
 *   3. Klik "Upload file" -> file chooser muncul
 *   4. Pilih file
 *
 * Strategi (berurutan):
 *   A. Cek input[type="file"] langsung (setInputFiles)
 *   B. File chooser via popup menu — setup 1 listener, klik trigger, klik opsi upload
 *   C. Klik setiap elemen interaktif di area input (dari DOM scan) dan cek file chooser
 */
async function uploadReferenceImage(page, referenceImage) {
  console.log('[Gemini] Mengupload gambar referensi...');

  const tempFile = path.join(os.tmpdir(), `gemini_ref_${Date.now()}.png`);
  const base64Data = referenceImage.replace(/^data:image\/\w+;base64,/, '');
  fs.writeFileSync(tempFile, Buffer.from(base64Data, 'base64'));

  let uploadSucceeded = false;

  try {
    // ===== DEBUG: Screenshot + DOM inspection =====
    try {
      await page.screenshot({ path: path.join(os.tmpdir(), 'gemini_before_upload.png') });
    } catch (_) {}

    // Pindai DOM untuk cari elemen interaktif di area bawah (area chat Gemini)
    const domScan = await page.evaluate(() => {
      const viewportH = window.innerHeight;
      const allInteractive = document.querySelectorAll(
        'button, div[role="button"], input[type="file"], [contenteditable="true"], ' +
        'a[href], label, [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(allInteractive)
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.top < viewportH && r.bottom > viewportH * 0.5 && el.offsetParent !== null;
        })
        .slice(0, 30)
        .map(el => ({
          tag: el.tagName,
          type: el.getAttribute('type') || '',
          text: (el.textContent || '').trim().substring(0, 80),
          aria: el.getAttribute('aria-label') || '',
          placeholder: el.getAttribute('placeholder') || '',
          role: el.getAttribute('role') || '',
          classes: (el.className || '').substring(0, 80),
          rect: (() => {
            const r = el.getBoundingClientRect();
            return { x: ~~r.x, y: ~~r.y, w: ~~r.width, h: ~~r.height };
          })(),
        }))
        .filter(el => el.text || el.aria || el.type === 'file');
    });

    console.log(`[Gemini] DOM scan: ${domScan.length} elemen interaktif di area input:`);
    for (const el of domScan) {
      console.log(`  <${el.tag}> type="${el.type}" text="${el.text.substring(0, 50)}" aria="${el.aria}"`);
    }

    // ===== STRATEGI A: setInputFiles langsung (paling cepat) =====
    console.log('[Gemini] Strategy A: Cek input[type=file] langsung...');
    const fileInputs = page.locator('input[type="file"]');
    const inputCount = await fileInputs.count();
    if (inputCount > 0) {
      console.log(`[Gemini] Ditemukan ${inputCount} input[type=file], set langsung...`);
      try {
        await fileInputs.first().setInputFiles(tempFile);
        await page.waitForTimeout(3000);
        console.log('[Gemini] Strategy A berhasil!');
        uploadSucceeded = true;
        return;
      } catch (setErr) {
        console.warn('[Gemini] Strategy A gagal:', setErr.message);
      }
    } else {
      console.log('[Gemini] Tidak ada input[type=file] langsung.');
    }

    // ===== STRATEGI B: File chooser via popup menu =====
    console.log('[Gemini] Strategy B: File chooser via popup menu...');
    let fileChooserResolved = false;

    // Satu file chooser listener untuk seluruh Strategy B (45s timeout)
    const fileChooserPromise = page.waitForEvent('filechooser', { timeout: 45000 })
      .then(fc => { fileChooserResolved = true; return fc; })
      .catch(() => null);

    const triggerSelectors = [
      'button[aria-label*="Add" i]',
      'button[aria-label*="add file" i]',
      'button[aria-label*="Attach" i]',
      'button[aria-label*="upload" i]',
      'button[aria-label*="image" i]',
      'div[role="button"][aria-label*="Add" i]',
      'div[role="button"][aria-label*="attach" i]',
      'button:has-text("+")',
      // Tambahkan dari DOM scan
      ...domScan
        .filter(el => /add|upload|attach|plus|file|gambar|image/i.test(el.text + el.aria))
        .map(el => `${el.tag.toLowerCase()}:has-text("${el.text.substring(0, 30)}")`),
    ];

    // Cari tombol trigger ("+" / "Add" / "Upload")
    for (const sel of [...new Set(triggerSelectors)]) {
      if (fileChooserResolved) break;
      try {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
          console.log(`[Gemini] Klik trigger: ${sel}`);
          await btn.click();
          await page.waitForTimeout(800);
          if (fileChooserResolved) break; // file chooser langsung muncul

          // Popup menu muncul — cari opsi "Upload file"
          console.log('[Gemini] Cari opsi "Upload file" di popup menu...');
          await page.waitForTimeout(600);

          const uploadOptionSelectors = [
            'span:has-text("Upload file")',
            'div:has-text("Upload file")',
            'span:has-text("Upload")',
            'div:has-text("Upload")',
            'button:has-text("Upload")',
            'li:has-text("Upload")',
            '[role="menuitem"]:has-text("Upload")',
            '[role="option"]:has-text("Upload")',
            'div[role="button"]:has-text("Upload")',
            'span:has-text("unggah")',
            'span:has-text("File")',
            'a:has-text("Upload")',
            'a:has-text("unggah")',
          ];

          for (const opt of [...new Set(uploadOptionSelectors)]) {
            if (fileChooserResolved) break;
            try {
              const option = page.locator(opt).first();
              if (await option.isVisible({ timeout: 300 }).catch(() => false)) {
                console.log(`[Gemini] Klik opsi upload: ${opt}`);
                await option.click();
                await page.waitForTimeout(800);
                if (fileChooserResolved) break;
              }
            } catch (_) {}
          }

          // Fallback: klik item pertama di popup
          if (!fileChooserResolved) {
            try {
              const popupItems = page.locator('[role="menu"] [role="menuitem"], [role="listbox"] [role="option"], [class*="menu"] [role="button"], [class*="popup"] button');
              if (await popupItems.count() > 0) {
                console.log('[Gemini] Fallback: klik item pertama popup...');
                await popupItems.first().click();
                await page.waitForTimeout(800);
              }
            } catch (_) {}
          }
          break;
        }
      } catch (_) {}
    }

    // Tunggu file chooser — maksimal 5 detik setelah interaksi selesai
    const fileChooser = fileChooserResolved
      ? await fileChooserPromise
      : await Promise.race([
          fileChooserPromise,
          new Promise(resolve => setTimeout(() => resolve(null), 5000))
        ]);
    if (fileChooser) {
      await fileChooser.setFiles(tempFile);
      console.log('[Gemini] Strategy B berhasil! File diupload via file chooser.');
      await page.waitForTimeout(5000);
      uploadSucceeded = true;
      return;
    }

    // ===== STRATEGI C: Klik elemen interaktif satu per satu dengan listener bersama =====
    console.log('[Gemini] Strategy C: Klik elemen interaktif di area bawah...');
    const fcPromiseC = page.waitForEvent('filechooser', { timeout: 20000 }).catch(() => null);

    for (const el of domScan) {
      if (el.rect.w < 10 || el.rect.h < 10) continue;
      if (el.text === '' && el.aria === '' && el.type !== 'file') continue;

      // Buat selector sederhana
      const selector = el.tag.toLowerCase() +
        (el.classes ? `.${el.classes.split(/\s+/)[0].replace(/[^\w-]/g, '')}` : '');

      try {
        const elem = page.locator(selector).first();
        if (await elem.isVisible({ timeout: 200 }).catch(() => false)) {
          console.log(`[Gemini] Klik: <${el.tag}> "${el.text.substring(0, 40)}"`);
          await elem.click();
          await page.waitForTimeout(1200);

          // Cek apakah file chooser sudah muncul
          const fc = await page.waitForEvent('filechooser', { timeout: 500 }).catch(() => null);
          if (fc) {
            await fc.setFiles(tempFile);
            console.log(`[Gemini] Strategy C berhasil via: <${el.tag}> "${el.text.substring(0, 40)}"`);
            await page.waitForTimeout(4000);
            uploadSucceeded = true;
            return;
          }
        }
      } catch (_) {}
    }

    // Tunggu sisa file chooser promise jika masih ada
    const fcC = await fcPromiseC;
    if (fcC) {
      await fcC.setFiles(tempFile);
      console.log('[Gemini] Strategy C berhasil (late file chooser)!');
      await page.waitForTimeout(4000);
      uploadSucceeded = true;
      return;
    }

    if (!uploadSucceeded) {
      console.warn('[Gemini] Semua strategi upload gagal.');
      // Screenshot akhir untuk debugging
      try {
        await page.screenshot({ path: path.join(os.tmpdir(), 'gemini_after_fail.png') });
        const pageInfo = await page.evaluate(() => ({
          title: document.title,
          url: window.location.href,
          textSnippet: document.body.innerText.substring(0, 500),
        }));
        console.log('[Gemini] Page info:', JSON.stringify(pageInfo, null, 2));
      } catch (ssErr) {
        console.warn('[Gemini] Gagal ambil debug info:', ssErr.message);
      }
    }

  } catch (uploadErr) {
    console.warn('[Gemini] Fatal error upload:', uploadErr.message);
  } finally {
    try { fs.unlinkSync(tempFile); } catch (_) {}
  }
}

/**
 * Helper: Tulis teks ke input chat Gemini
 */
async function typeToGeminiInput(page, text) {
  console.log('[Gemini] Memasukkan prompt teks...');
  const inputSelectors = [
    '.ql-editor',
    'div[contenteditable="true"]',
    'rich-textarea p',
    'textarea',
    'div[role="textbox"]',
    '.text-input-field',
    'p[data-placeholder]',
  ];

  let inputFound = false;
  for (const selector of inputSelectors) {
    try {
      const input = page.locator(selector).first();
      if (await input.isVisible({ timeout: 2000 })) {
        await input.click();
        await page.waitForTimeout(400);
        try {
          await input.fill(text);
        } catch (_) {
          await page.keyboard.type(text, { delay: 3 });
        }
        inputFound = true;
        console.log(`[Gemini] Prompt dimasukkan via: ${selector}`);
        break;
      }
    } catch (_) {}
  }

  if (!inputFound) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(400);
    await page.keyboard.type(text, { delay: 3 });
    console.log('[Gemini] Prompt dimasukkan via keyboard fallback.');
  }
}

/**
 * Helper: Extract the last Gemini response text from the page
 */
async function extractGeminiResponse(page) {
  console.log('[Gemini] Mengekstrak respons...');
  await page.waitForTimeout(2000);

  const strategies = [
    // Strategy 1: Look for model response elements
    () => {
      return page.evaluate(() => {
        const selectors = [
          '[data-message-author="model"]',
          '.model-response-text',
          '.response-content',
          '.gemini-response',
          '[data-test-id="response-text"]',
        ];
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.textContent.trim().length > 20) {
            return el.textContent.trim();
          }
        }
        return null;
      });
    },
    // Strategy 2: Find the last large text block
    () => {
      return page.evaluate(() => {
        const allText = document.body.innerText;
        const lines = allText.split('\n').filter(l => l.trim().length > 0);
        const textBlocks = [];
        let currentBlock = [];
        for (const line of lines) {
          if (line.trim().length > 0) {
            currentBlock.push(line);
          } else if (currentBlock.length > 0) {
            textBlocks.push(currentBlock.join('\n'));
            currentBlock = [];
          }
        }
        if (currentBlock.length > 0) textBlocks.push(currentBlock.join('\n'));

        for (let i = textBlocks.length - 1; i >= 0; i--) {
          if (textBlocks[i].length > 100) return textBlocks[i];
        }
        return null;
      });
    },
    // Strategy 3: Get main content area
    () => {
      return page.evaluate(() => {
        const main = document.querySelector('main') || document.querySelector('[role="main"]');
        if (main) {
          const allText = main.textContent.trim();
          if (allText.length > 50) return allText;
        }
        return null;
      });
    },
    // Strategy 4: Last resort - filter out short text blocks
    () => {
      return page.evaluate(() => {
        const allText = document.body.innerText;
        const lines = allText.split('\n').filter(l => l.trim().length > 0);
        // Get the last ~50 lines
        const lastLines = lines.slice(-50);
        const content = lastLines.join('\n');
        if (content.length > 100) return content;
        return null;
      });
    },
  ];

  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result && result.length > 50) {
        // Filter out "login" pages
        const lower = result.toLowerCase();
        if (lower.includes('sign in') && lower.includes('google') && result.length < 200) {
          console.log('[Gemini] Detected login page, skipping...');
          continue;
        }
        console.log(`[Gemini] Berhasil mengekstrak ${result.length} karakter respons.`);
        return result;
      }
    } catch (e) {
      console.log(`[Gemini] Strategy gagal: ${e.message}`);
    }
  }

  // Last resort
  const fallbackText = await page.evaluate(() => document.body.innerText);
  if (fallbackText && fallbackText.length > 50) {
    return fallbackText;
  }

  throw new Error('Tidak dapat mengekstrak respons dari Gemini web.');
}

/**
 * Scrape Instagram profile
 * GET /api/scrape-instagram?username=leaders_id
 */
app.get('/api/scrape-instagram', async (req, res) => {
  const { username } = req.query;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Parameter username diperlukan.' });
  }

  const cleanUsername = username.trim().replace('@', '').toLowerCase();
  const profileUrl = `https://www.instagram.com/${cleanUsername}/`;

  console.log(`\n[Scraper] ===== Memulai scraping: @${cleanUsername} =====`);

  let browser = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
      ]
    });

    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: 'id-ID',
      extraHTTPHeaders: {
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
      }
    });

    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    const page = await context.newPage();

    console.log(`[Scraper] Navigasi ke profil (Mobile Emulation): ${profileUrl}`);
    await page.goto(profileUrl, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(3000);

    // Tutup popup banner
    const closeBtn = page.locator('[aria-label="Tutup"], [aria-label="Close"], svg[aria-label="Tutup"], svg[aria-label="Close"], button:has-text("Tutup"), button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('[Scraper] Menutup banner aplikasi Instagram di mobile...');
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    await page.evaluate(() => window.scrollBy(0, 350));
    await page.waitForTimeout(1500);

    const pageTitle = await page.title();
    console.log(`[Scraper] Page title: ${pageTitle}`);

    // Parse nama dan bio
    const headerData = await page.evaluate(() => {
      let fullName = '';
      let bio = '';

      const usernameEl = document.querySelector('header h2, h2');
      const username = usernameEl ? usernameEl.innerText.trim() : '';

      const spans = Array.from(document.querySelectorAll('header span, main span'));
      const textSpans = spans.map(s => s.innerText.trim()).filter(t => t.length > 0);

      const followersIdx = textSpans.findIndex(t => t.includes('follower') || t.includes('Pengikut'));
      if (followersIdx > 0) {
        fullName = textSpans[followersIdx - 1];
      }

      const followingIdx = textSpans.findIndex(t => t.includes('following') || t.includes('Mengikuti'));
      const startIdx = Math.max(followersIdx, followingIdx);
      if (startIdx !== -1 && startIdx + 1 < textSpans.length) {
        const candidates = textSpans.slice(startIdx + 1).filter(t =>
          !t.toLowerCase().includes('log in') &&
          !t.toLowerCase().includes('sign up') &&
          !t.toLowerCase().includes('buka aplikasi') &&
          !t.toLowerCase().includes('open app') &&
          !t.toLowerCase().includes('masuk') &&
          !t.toLowerCase().includes('daftar') &&
          t.length > 2
        );
        if (candidates.length > 0) {
          bio = candidates.join(' - ');
        }
      }

      if (!fullName) {
        fullName = document.querySelector('h1')?.innerText?.trim() || username;
      }

      return { fullName, bio };
    });

    const fullName = headerData.fullName || `@${cleanUsername}`;
    const bio = headerData.bio || '';

    // Ambil caption dari alt text
    let captions = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs
        .map(img => img.alt || '')
        .filter(alt =>
          alt &&
          alt.trim().length > 5 &&
          !alt.toLowerCase().includes('foto profil') &&
          !alt.toLowerCase().includes('profile picture') &&
          !alt.toLowerCase().includes('instagram')
        );
    });

    // Fallback ke parser JSON script
    if (captions.length === 0) {
      const scriptCaptions = await page.evaluate(() => {
        const results = [];
        try {
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const text = script.textContent || '';
            if (!text.includes('edge_owner_to_timeline_media') && !text.includes('graphql')) continue;
            let idx = 0;
            while (idx < text.length) {
              const key = '"text":"';
              const pos = text.indexOf(key, idx);
              if (pos === -1) break;
              let end = pos + key.length;
              while (end < text.length) {
                if (text[end] === '\\') { end += 2; }
                else if (text[end] === '"') { break; }
                else { end++; }
              }
              const extracted = text.substring(pos + key.length, end);
              if (extracted.length > 15) {
                results.push(extracted.replace(/\\n/g, '\n').replace(/\\"/g, '"'));
              }
              idx = end + 1;
            }
          }
        } catch (e) {}
        return [...new Set(results)];
      });
      captions = scriptCaptions.filter(c => c.length > 5);
    }

    // Fallback meta description
    if (captions.length === 0) {
      const metaDesc = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
        return meta ? meta.getAttribute('content') : '';
      });
      if (metaDesc) captions.push(metaDesc);
    }

    await browser.close();
    browser = null;

    const uniqueCaptions = [...new Set(captions)]
      .filter(c => c && c.trim().length > 5)
      .slice(0, 10);

    if (uniqueCaptions.length === 0) {
      return res.json({
        success: false,
        error: 'Tidak dapat mengekstrak caption. Profil mungkin private atau Instagram memblokir akses.',
        username: cleanUsername,
        fullName: fullName || `@${cleanUsername}`,
        bio: bio || '',
        isSimulated: false,
        captions: []
      });
    }

    return res.json({
      success: true,
      username: cleanUsername,
      fullName: fullName || `@${cleanUsername}`,
      bio: bio || '',
      captions: uniqueCaptions,
      isSimulated: false
    });

  } catch (err) {
    console.error(`[Scraper] Error fatal saat scraping @${cleanUsername}:`, err.message);
    if (browser) {
      await browser.close().catch(() => {});
    }
    return res.status(500).json({
      success: false,
      error: `Gagal scraping: ${err.message}`,
      username: cleanUsername,
      isSimulated: false,
      captions: []
    });
  }
});

/**
 * Shared function: Evaluasi login status dari page yang sudah terbuka.
 * Menggunakan deterministic checks, bukan scoring.
 *
 * Logika:
 *   1. Jika ada contenteditable/rich-textarea → PASTI login (chat interface)
 *   2. Jika ada tombol Login/Masuk/Sign in yang VISIBLE → PASTI belum login
 *   3. Jika URL mengandung accounts.google.com → PASTI belum login
 *   4. Fallback: cek title, body length, dan teks spesifik
 */
async function evaluateLoginFromPage(page) {
  const pageUrl = page.url();

  const loginCheck = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    const title = document.title || '';

    // Helper: cari visible element dengan teks tertentu (innerText, bukan textContent — biar SVG/icon tidak ikut)
    const hasVisibleText = (texts) => {
      return Array.from(document.querySelectorAll('button, a, span, div[role="button"]')).some(el => {
        if (el.offsetParent === null) return false;
        const text = el.innerText.trim();
        return texts.some(t => text.toLowerCase() === t.toLowerCase() || text.toLowerCase().includes(t.toLowerCase()));
      });
    };

    // ===== DETERMINISTIC CHECK 1: Chat interface =====
    const hasChatInput = !!(
      document.querySelector('[contenteditable="true"]') ||
      document.querySelector('rich-textarea') ||
      document.querySelector('div[role="textbox"][contenteditable]')
    );

    // ===== DETERMINISTIC CHECK 2: Login button visible =====
    const hasLoginButton = hasVisibleText(['login', 'masuk', 'sign in', 'log in', 'sign in with google']);

    // ===== DETERMINISTIC CHECK 3: New chat button (indikator sudah login) =====
    const hasNewChatButton = hasVisibleText(['new chat', 'new', 'chat baru']);

    // ===== FALLBACK HEURISTICS =====
    const isShortPage = bodyText.length < 600;
    const mentionsGoogleOnly = /google/i.test(bodyText) && !/gemini/i.test(bodyText);
    const isLoginTitle = /sign in|login|masuk/i.test(title);
    const hasGeminiInBody = /gemini/i.test(bodyText);

    return {
      hasChatInput,
      hasLoginButton,
      hasNewChatButton,
      hasGeminiInBody,
      isShortPage,
      mentionsGoogleOnly,
      isLoginTitle,
      bodyLength: bodyText.length,
      title,
      snippet: bodyText.substring(0, 300),
    };
  });

  // ===== KEPUTUSAN FINAL (prioritas: login button > chat input > URL > heuristics) =====
  let isLoggedIn;

  if (loginCheck.hasLoginButton) {
    // Tombol login visible → PASTI belum login
    // (bisa jadi ada chat input di belakang login overlay)
    isLoggedIn = false;
  } else if (loginCheck.hasChatInput && !loginCheck.hasLoginButton) {
    // Chat input ada dan tidak ada tombol login → PASTI sudah login
    isLoggedIn = true;
  } else if (/accounts\.google\.com/i.test(pageUrl)) {
    // Redirect ke Google Accounts → PASTI belum login
    isLoggedIn = false;
  } else {
    // Fallback: heuristics
    if (loginCheck.hasNewChatButton && loginCheck.hasGeminiInBody) {
      isLoggedIn = true;
    } else if (loginCheck.isLoginTitle || loginCheck.mentionsGoogleOnly) {
      isLoggedIn = false;
    } else if (loginCheck.isShortPage) {
      isLoggedIn = false;
    } else {
      isLoggedIn = false;
    }
  }

  console.log('[Gemini] Login eval:', JSON.stringify({ ...loginCheck, pageUrl, isLoggedIn }, null, 2));

  return {
    isLoggedIn,
    pageUrl,
    ...loginCheck,
  };
}

/**
 * Helper: Cek apakah user sudah login ke Gemini
 * Buka https://gemini.google.com/app (headless), deteksi elemen login.
 * Returns { loggedIn: boolean, detail: string }
 */
async function checkGeminiLogin() {
  let context = null;
  try {
    const userDataDir = path.join(process.cwd(), '.gemini-browser-profile');

    const vp = randomViewport();

    context = await chromium.launchPersistentContext(userDataDir, {
      headless: true,
      userAgent: EDGE_UA,  // Edge UA lebih jarang diblokir
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-first-run',
        '--no-default-browser-check',
        '--mute-audio',
      ],
      viewport: vp,
      locale: 'id-ID',
      timezoneId: randomTimezone(),
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
    });

    await applyStealthEvasions(context);

    const page = await context.newPage();

    console.log(`[Gemini] Check login: Buka https://gemini.google.com (viewport ${vp.width}x${vp.height})...`);

    // Coba dengan timeout lebih panjang dan fallback URL
    let loginCheck = null;
    let usedUrl = 'https://gemini.google.com/app';

    for (const targetUrl of ['https://gemini.google.com/app', 'https://gemini.google.com/', 'https://aistudio.google.com/app']) {
      try {
        console.log(`[Gemini] Mencoba: ${targetUrl}`);
        await page.goto(targetUrl, {
          waitUntil: 'load',
          timeout: 25000,
        });
        await page.waitForTimeout(4000);

        // Cek apakah halaman berhasil dimuat (bukan blocked/error)
        const pageUrl = page.url();
        const bodySnippet = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '');
        const isBlocked = /something went wrong|try again later|access denied|403|forbidden|please try again later|this page isn't working|error 429/i.test(bodySnippet);
        const isRateLimited = /rate limit|too many requests|429|quota exceeded|try again/i.test(bodySnippet) && bodySnippet.length < 1000;
        const isGoogleAuth = pageUrl.includes('accounts.google.com');

        console.log(`[Gemini] URL: ${pageUrl} | Blocked: ${isBlocked} | RateLimit: ${isRateLimited} | Auth: ${isGoogleAuth}`);

        // Jika rate limit, langsung return tanpa coba URL lain
        if (isRateLimited) {
          console.log('[Gemini] RATE LIMIT terdeteksi, hentikan percobaan.');
          await context.close();
          context = null;
          return {
            loggedIn: false,
            isRateLimited: true,
            detail: '⚠️ Limit akses tercapai! Google membatasi karena terlalu banyak permintaan otomatis. Tunggu 5-10 menit, lalu coba lagi.',
            error: 'Rate limited oleh Google',
          };
        }

        if (!isBlocked) {
          loginCheck = await evaluateLoginFromPage(page);
          usedUrl = targetUrl;
          if (loginCheck) break;
        } else {
          console.log(`[Gemini] ${targetUrl} diblokir, coba URL lain...`);
        }
      } catch (navErr) {
        console.log(`[Gemini] Navigasi ke ${targetUrl} gagal: ${navErr.message}`);
        continue;
      }
    }

    if (loginCheck) {
      console.log('[Gemini] Login check result:', JSON.stringify(loginCheck, null, 2));

      await context.close();
      context = null;

      return {
        loggedIn: loginCheck.isLoggedIn,
        detail: loginCheck.isLoggedIn
          ? 'Anda sudah login ke Gemini.'
          : 'Anda belum login ke Gemini. Silakan klik tombol "Buka Gemini untuk Login" di dashboard.',
      };
    }

    // Ambil snippet halaman SEBELUM context ditutup
    const lastSnippet = await page.evaluate(() => document.body.innerText.substring(0, 500)).catch(() => '');

    // Tutup browser
    await context.close();
    context = null;

    // Deteksi rate limit dari snippet
    const detectedRateLimit = /rate limit|too many requests|429|quota exceeded|try again later/i.test(lastSnippet);

    if (detectedRateLimit) {
      return {
        loggedIn: false,
        isRateLimited: true,
        detail: '⚠️ Limit akses tercapai! Google membatasi karena terlalu banyak permintaan otomatis. Tunggu 5-10 menit, buka Gemini di browser biasa untuk login ulang, lalu coba lagi.',
        error: 'Rate limited oleh Google — terlalu banyak request',
      };
    }

    return {
      loggedIn: false,
      isBlockedByGoogle: true,
      detail: 'Tidak dapat mengakses Gemini. Google memblokir akses otomatis. Silakan buka gemini.google.com di browser biasa untuk login, tutup, lalu coba lagi.',
      error: 'Semua URL Gemini gagal diakses (blocked oleh Google)',
    };

  } catch (err) {
    console.error('[Gemini] Error check login:', err.message);
    if (context) {
      await context.close().catch(() => {});
    }
    return {
      loggedIn: false,
      detail: `Gagal mengecek login: ${err.message}. Silakan login manual di browser biasa.`,
      error: err.message,
    };
  }
}

/**
 * GET /api/check-gemini-login — Cek status login Gemini user
 */
app.get('/api/check-gemini-login', async (req, res) => {
  console.log('[Gemini] Memeriksa status login...');
  const result = await checkGeminiLogin();
  res.json({
    success: !result.error,
    ...result,
  });
});

/**
 * POST /api/open-gemini - Buka Gemini AI visible, upload gambar (opsional), masukkan prompt.
 * User akan manual klik Generate.
 */
app.post('/api/open-gemini', async (req, res) => {
  const { prompt, referenceImage } = req.body;

  if (!prompt || prompt.trim() === '') {
    return res.status(400).json({ error: 'Prompt diperlukan.' });
  }

  let context = null;

  try {
    const userDataDir = path.join(process.cwd(), '.gemini-browser-profile');

    const vp = randomViewport();

    console.log('[Gemini] Membuka Gemini AI di browser visible...');
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      userAgent: CHROME_UA,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-first-run',
        '--no-default-browser-check',
        '--mute-audio',
      ],
      viewport: vp,
      locale: 'id-ID',
      timezoneId: randomTimezone(),
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
    });

    await applyStealthEvasions(context);

    const page = await context.newPage();

    console.log(`[Gemini] Navigasi ke https://gemini.google.com/app (viewport ${vp.width}x${vp.height})...`);
    await page.goto('https://gemini.google.com/app', {
      waitUntil: 'load',
      timeout: 60000,
    });
    await page.waitForTimeout(5000);

    if (referenceImage) {
      await uploadReferenceImage(page, referenceImage);
    }

    await typeToGeminiInput(page, prompt);

    await page.waitForTimeout(1000);
    console.log('[Gemini] Selesai! Browser tetap terbuka. User klik Generate manual.');

    res.json({
      success: true,
      message: 'Browser Gemini terbuka dengan prompt siap. Silakan klik Generate di browser.',
    });
  } catch (err) {
    console.error('[Gemini] Error:', err.message);
    return res.status(500).json({
      error: `Gagal membuka Gemini: ${err.message}`,
    });
  }
});

/**
 * POST /api/analyze-image-gemini
 * Upload gambar ke Gemini web otomatis, minta analisis + prompt rekomendasi,
 * tunggu respons, ekstrak, dan return ke frontend.
 */
app.post('/api/analyze-image-gemini', async (req, res) => {
  const { referenceImage, contextInfo = '', customInstruction = '' } = req.body;

  if (!referenceImage) {
    return res.status(400).json({ error: 'Gambar referensi diperlukan.' });
  }

  let context = null;

  try {
    const userDataDir = path.join(process.cwd(), '.gemini-browser-profile');

    const vp = randomViewport();

    console.log('[Gemini] Membuka Gemini AI (auto-analyze mode)...');
    context = await chromium.launchPersistentContext(userDataDir, {
      headless: false,
      userAgent: CHROME_UA,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--no-first-run',
        '--no-default-browser-check',
        '--mute-audio',
      ],
      viewport: vp,
      locale: 'id-ID',
      timezoneId: randomTimezone(),
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
    });

    await applyStealthEvasions(context);

    const page = await context.newPage();

    console.log(`[Gemini] Navigasi ke https://gemini.google.com/app (viewport ${vp.width}x${vp.height})...`);
    await page.goto('https://gemini.google.com/app', {
      waitUntil: 'load',
      timeout: 60000,
    });
    await page.waitForTimeout(5000);

    // Cek apakah halaman error (blocked/detected) — cek URL juga
    const pageUrl = page.url();
    const errorCheck = await page.evaluate(() => {
      const bodyText = document.body.innerText.substring(0, 500);
      return {
        isErrorPage: /something went wrong|try again later|access denied|403|forbidden/i.test(bodyText),
        snippet: bodyText.substring(0, 200),
      };
    });

    console.log('[Gemini] Page URL:', pageUrl, '| Error:', errorCheck.isErrorPage);

    if (errorCheck.isErrorPage || !pageUrl.includes('gemini.google.com')) {
      console.log('[Gemini] TERDETEKSI ERROR/REDIRECT:', errorCheck.snippet);
      await context.close();
      context = null;
      return res.json({
        success: false,
        isBlockedByGoogle: true,
        error: 'Google memblokir akses otomatis. Silakan buka Gemini secara manual di browser biasa untuk login, lalu coba lagi.',
        detail: errorCheck.snippet,
      });
    }

    console.log('[Gemini] Halaman Gemini berhasil dimuat, melanjutkan...');

    // Cek status login pakai shared evaluator
    const loginCheck = await evaluateLoginFromPage(page);
    console.log('[Gemini] Login check:', JSON.stringify(loginCheck));

    if (!loginCheck.isLoggedIn) {
      console.log('[Gemini] User BELUM login ke Gemini.');
      await context.close();
      context = null;
      return res.json({
        success: false,
        isLoginRequired: true,
        loginDetail: {
          hasChatInput: loginCheck.hasChatInput,
          hasLoginButton: loginCheck.hasLoginButton,
          pageUrl: loginCheck.pageUrl,
        },
        error: 'Anda belum login ke Gemini. Silakan buka Gemini, login dulu, lalu coba lagi.',
      });
    }
    console.log('[Gemini] Login terdeteksi, melanjutkan analisis...');

    // Upload reference image
    await uploadReferenceImage(page, referenceImage);
    await page.waitForTimeout(2000);

    // Build the analysis prompt
    const analysisPrompt = customInstruction ||
`Analyze this reference image in EXTREME DETAIL. This is for creating a mega-detailed image generation prompt.

First, describe EVERY visual element you see:

1. **Visual Style & Art Direction**: What art style? (photorealistic, flat illustration, 3D render, watercolor, vector art, etc.)
2. **Color Palette**: Dominant colors, accent colors, color harmony
3. **Lighting**: Direction, intensity, mood (soft, dramatic, natural, neon, etc.)
4. **Composition & Layout**: Rule of thirds, symmetry, framing, focal point
5. **Subject/Character**: Appearance, expression, pose, clothing, age, gender if applicable
6. **Background & Setting**: Environment, location, time of day, season
7. **Props & Objects**: Every object visible, materials, textures
8. **Typography**: Font style, text content, text placement (if any)
9. **Mood & Atmosphere**: Emotional tone, vibe, energy level
10. **Camera/Perspective**: Angle, distance, depth of field, lens type

${contextInfo ? `\n**Additional Context:**\n${contextInfo}\n` : ''}

Then, create a MEGA-DETAILED IMAGE GENERATION PROMPT in ENGLISH (minimum 150 words) that would reproduce a similar image using any AI image generator (Midjourney, DALL-E, Stable Diffusion, Gemini, etc.). Make it extremely specific — NOT generic. Include all the details above.

Format your response as:

## VISUAL ANALYSIS
[Your detailed analysis here]

## MEGA PROMPT RECOMMENDATION
[The detailed English prompt here]`;

    // Type the prompt
    await typeToGeminiInput(page, analysisPrompt);

    // Press Enter to submit
    console.log('[Gemini] Menekan Enter untuk submit prompt...');
    await page.waitForTimeout(1000);
    await page.keyboard.press('Enter');

    // Wait for response to generate
    console.log('[Gemini] Menunggu respons dari Gemini...');
    await page.waitForTimeout(5000);

    // Wait for generation to complete
    try {
      await page.waitForFunction(() => {
        const stopBtn = document.querySelector('[aria-label="Stop"], [aria-label="Hentikan"], button:has-text("Stop"), button:has-text("Hentikan")');
        const loadingIndicators = document.querySelectorAll('[role="progressbar"], .loading, .generating, .thinking');
        return (!stopBtn || !stopBtn.offsetParent) && loadingIndicators.length === 0;
      }, { timeout: 45000, polling: 2000 });
    } catch (timeoutErr) {
      console.log('[Gemini] Timeout menunggu, tetap coba ekstrak...');
    }

    await page.waitForTimeout(3000);

    // Debug screenshot
    try {
      await page.screenshot({ path: 'server/debug_gemini_response.png' });
      console.log('[Gemini] Debug screenshot disimpan.');
    } catch (ssErr) {}

    // Extract response
    const responseText = await extractGeminiResponse(page);

    // Close browser
    await context.close();
    context = null;

    console.log('[Gemini] Respons berhasil diekstrak!');

    // Parse response to separate analysis and prompt
    let analysis = responseText;
    let megaPrompt = responseText;

    const megaPromptMatch = responseText.match(/## MEGA PROMPT RECOMMENDATION\s*([\s\S]*)/i);
    const visualAnalysisMatch = responseText.match(/## VISUAL ANALYSIS\s*([\s\S]*?)(?=## MEGA PROMPT)/i);

    if (megaPromptMatch) {
      megaPrompt = megaPromptMatch[1].trim();
    }
    if (visualAnalysisMatch) {
      analysis = visualAnalysisMatch[1].trim();
    }

    res.json({
      success: true,
      response: responseText,
      analysis: analysis,
      megaPrompt: megaPrompt,
    });

  } catch (err) {
    console.error('[Gemini] Error analyze-image:', err.message);
    if (context) {
      await context.close().catch(() => {});
    }
    return res.status(500).json({
      success: false,
      error: `Gagal menganalisis gambar: ${err.message}`,
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BGI Scraper Server berjalan dengan baik!', version: '2.0' });
});

// ===== SPA catch-all: serve index.html for non-API routes in production =====
if (isProduction && fs.existsSync(distPath)) {
  app.get('*splat', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(distPath, 'index.html'));
    } else {
      res.status(404).json({ error: 'API endpoint not found' });
    }
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: `Internal server error: ${err.message}` });
});

// ===== Start server dengan fallback port =====
(async () => {
  try {
    const { srv, port } = await startServer(DEFAULT_PORT);

    console.log(`✅ BGI Instagram Scraper Server v2 berjalan di http://localhost:${port}`);
    if (port !== DEFAULT_PORT) {
      console.log(`   ⚠️  Port ${DEFAULT_PORT} sudah digunakan, fallback ke port ${port}`);
      console.log(`   🔧 Jika ingin menggunakan port ${DEFAULT_PORT}, update juga Vite proxy di vite.config.js`);
    }
    console.log(`   Endpoint:`);
    console.log(`     GET  http://localhost:${port}/api/scrape-instagram?username=NAMA_AKUN`);
    console.log(`     GET  http://localhost:${port}/api/check-gemini-login`);
    console.log(`     POST http://localhost:${port}/api/open-gemini`);
    console.log(`     POST http://localhost:${port}/api/analyze-image-gemini`);
    console.log(`     GET  http://localhost:${port}/api/health`);
    console.log(`\n   Tekan Ctrl+C untuk menghentikan server.`);

    srv.on('error', (err) => {
      console.error(`\n❌ Server error:`, err.message);
      process.exit(1);
    });

  } catch (err) {
    console.error(`\n❌ ${err.message}`);
    console.log(`💡 Jalankan: netstat -ano | findstr :${DEFAULT_PORT} untuk lihat proses yang memakai port.`);
    process.exit(1);
  }
})();

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Server] Unhandled rejection:', reason);
});
