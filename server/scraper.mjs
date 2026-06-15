/**
 * BGI Content Studio - Instagram Scraper Backend (v2)
 * Express server menggunakan Playwright untuk scrape profil Instagram secara real.
 * Strategi: Buka halaman profil -> tutup popup -> klik setiap post -> ambil caption lengkap
 */
import express from 'express';
import cors from 'cors';
import { chromium } from 'playwright';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

/**
 * Tutup popup/overlay Instagram
 */
async function dismissPopups(page) {
  const dismissSelectors = [
    'button:has-text("Not Now")',
    'button:has-text("Tidak Sekarang")',
    'button:has-text("Not now")',
    '[aria-label="Close"]',
    '[aria-label="Tutup"]',
    'button:has-text("Dismiss")',
    'button:has-text("Close")',
    'button:has-text("Cancel")',
  ];

  for (let attempt = 0; attempt < 3; attempt++) {
    for (const sel of dismissSelectors) {
      try {
        const btn = page.locator(sel).first();
        const isVisible = await btn.isVisible({ timeout: 500 });
        if (isVisible) {
          console.log(`[Scraper] Menutup popup: ${sel}`);
          await btn.click();
          await page.waitForTimeout(800);
        }
      } catch (e) {}
    }
    
    // Escape key juga bantu
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
}

/**
 * Endpoint utama: scrape captions dari profil Instagram
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

    // Gunakan emulasi mobile (iPhone 13) untuk mendapatkan layout mobile Instagram
    // Ini sangat krusial karena layout mobile tidak langsung redirect ke halaman login
    // dan menyediakan grid post dengan alt text berisi caption lengkap secara langsung.
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
    
    // Tutup popup banner "Lihat profil lengkap di aplikasi" / "Buka aplikasi"
    const closeBtn = page.locator('[aria-label="Tutup"], [aria-label="Close"], svg[aria-label="Tutup"], svg[aria-label="Close"], button:has-text("Tutup"), button:has-text("Close")').first();
    if (await closeBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      console.log('[Scraper] Menutup banner aplikasi Instagram di mobile...');
      await closeBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // Scroll sedikit ke bawah untuk memastikan seluruh gambar post dimuat
    await page.evaluate(() => window.scrollBy(0, 350));
    await page.waitForTimeout(1500);

    try {
      await page.screenshot({ path: 'server/debug_profile.png' });
      console.log('[Scraper] Debug screenshot disimpan ke server/debug_profile.png');
    } catch (ssErr) {
      console.log('[Scraper] Gagal mengambil debug screenshot:', ssErr.message);
    }

    const pageTitle = await page.title();
    console.log(`[Scraper] Page title: ${pageTitle}`);

    // Parse nama dan bio menggunakan algoritma parser mobile yang tangguh
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
    console.log(`[Scraper] Terdeteksi Nama: "${fullName}", Bio: "${bio.substring(0, 60)}..."`);

    // Ambil caption dari alt text gambar-gambar postingan
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

    console.log(`[Scraper] Berhasil mengekstrak ${captions.length} caption lewat Alt Text.`);

    // Fallback ke parser JSON script jika alt text tidak didapat
    if (captions.length === 0) {
      console.log('[Scraper] Fallback: Mencoba metode parser JSON script...');
      const scriptCaptions = await page.evaluate(() => {
        const results = [];
        try {
          const scripts = document.querySelectorAll('script');
          for (const script of scripts) {
            const text = script.textContent || '';
            if (!text.includes('edge_owner_to_timeline_media') && !text.includes('graphql')) {
              continue;
            }
            let idx = 0;
            while (idx < text.length) {
              const key = '"text":"';
              const pos = text.indexOf(key, idx);
              if (pos === -1) break;
              let end = pos + key.length;
              while (end < text.length) {
                if (text[end] === '\\') {
                  end += 2;
                } else if (text[end] === '"') {
                  break;
                } else {
                  end++;
                }
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

    // Fallback terakhir: Meta description
    if (captions.length === 0) {
      console.log('[Scraper] Fallback terakhir: Mengambil meta description...');
      const metaDesc = await page.evaluate(() => {
        const meta = document.querySelector('meta[name="description"], meta[property="og:description"]');
        return meta ? meta.getAttribute('content') : '';
      });
      if (metaDesc) {
        captions.push(metaDesc);
      }
    }

    await browser.close();
    browser = null;

    console.log(`[Scraper] Total caption terkumpul: ${captions.length}`);

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'BGI Scraper Server berjalan dengan baik!', version: '2.0' });
});

app.listen(PORT, () => {
  console.log(`✅ BGI Instagram Scraper Server v2 berjalan di http://localhost:${PORT}`);
  console.log(`   Endpoint: GET http://localhost:${PORT}/api/scrape-instagram?username=NAMA_AKUN`);
});
