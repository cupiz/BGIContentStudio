# BGI Content Studio 🚀

BGI Content Studio adalah aplikasi asisten pembuatan konten media sosial premium berbasis AI yang dirancang untuk memetakan strategi brand, menyusun pilar konten, menghasilkan ide, draf skrip, hook, hingga caption siap pakai secara otomatis — tersedia sebagai **aplikasi desktop** dan **web app**.

Aplikasi ini menggunakan teknologi **React (Vite)** untuk antarmuka pengguna, **Electron** untuk distribusi desktop, **Express** untuk backend service, **Gemini AI API** untuk kecerdasan analisis konten, **OpenRouter** untuk generasi gambar AI, dan **Playwright** untuk scraping profil Instagram secara real.

---

## ✨ Fitur Utama

### 🎯 Content Strategy
- **Strategic Niche & Brand Profiling**: Mengidentifikasi positioning, target audiens, segmentasi, tone of voice, dan brand archetype.
- **Real Instagram Scraper (Deteksi Niche)**: Menganalisis akun kompetitor atau role model secara dinamis untuk mendeteksi niche utama mereka secara akurat.
- **Autopilot AI (One-Click)**: Menghubungkan seluruh tahapan dari niche, pilar, ide konten, skrip video, variasi hook emosional, hingga caption media sosial dalam sekali klik.
- **Pilar Konten Dinamis**: Visualisasi pilar konten yang dapat ditambah, disunting, dan dihapus secara fleksibel.

### 🖼️ Image Generation & Google Drive Sync
- **Image Generation (OpenRouter AI)**: Mendukung generasi gambar menggunakan model terbaik seperti **RiverFlow v2.5** dan **Grok Imagine** dengan panduan analisis visual Gemini AI.
- **Google Drive Sync (Multi-Mode)**:
  - **Google Apps Script Web App**: Rekomendasi sinkronisasi stabil tanpa repot kedaluwarsa token OAuth (mengunggah data base64 melalui script Web App).
  - **Direct Google Drive API**: Integrasi resmi menggunakan OAuth2 Access Token untuk mengunggah gambar langsung ke Drive API.
  - **Subfolder Harian Otomatis**: Membuat folder `YYYY-MM-DD` otomatis di dalam folder target.
  - **Auto Folder ID Extraction**: Otomatis mengekstrak ID folder dari URL share Google Drive biasa.
- **Zoom Lightbox & Fallback Panel**: Klik gambar preview untuk melihat detail secara fullscreen, lengkap dengan panel bantuan langsung ke Google Drive apabila akses file bersifat privat/terkendala cookie CORS browser.

### 👥 Team Collaboration Workflow
- **Real-Time Job Queue**: Menghubungkan Customer Service (CS) yang mengirim laporan postingan dan Administrator / Project Leader yang memvalidasi hasil konten secara real-time.
- **VPS Server Database Sync**: Tersinkronisasi penuh dengan server VPS produksi di IP `http://43.156.145.252:5000` (atau VPS lokal/kustom Anda).
- **Advanced Sorting**: Mengurutkan antrean tugas kolaborasi berdasarkan *Terbaru*, *Terlama*, *Nama A-Z*, dan *Nama Z-A*.

### 📱 Desktop App (Electron)
- **Auto-Update**: Aplikasi otomatis mendeteksi rilis versi baru dari GitHub Releases, mencadangkan file, mengekstrak update, dan merestart aplikasi.
- **Smart Playwright Installer**: Aplikasi mendeteksi revisi spesifik browser Chromium yang dibutuhkan (`chromium-1228` bawaan Playwright v1.60.0). Jika versi revisi tidak terinstal/tidak cocok di AppData user, aplikasi akan mengunduhnya secara otomatis saat *first launch* agar scraper bebas crash.
- **Isolated Native Bundling**: Dependensi backend seperti `playwright-core` dan database drivers (`pg-pool`, dll) dikemas secara khusus sehingga Express server backend mandiri langsung berjalan stabil di PC user tanpa memerlukan instalasi Node.js lokal.
- **Splash Screen & System Tray**: Monitor progres instalasi komponen serta jalankan aplikasi di system tray.

---

## 📸 Arsitektur Scraper Instagram (Mobile Emulation)

Scraper Instagram yang terletak di `server/scraper.mjs` menggunakan strategi khusus untuk melewati proteksi ketat Instagram tanpa memerlukan API Key pihak ketiga:

1. **Emulasi Viewport & User-Agent Seluler**: 
   Scraper meniru profil perangkat **iPhone 13** (User-Agent Mobile Safari). Instagram desktop seringkali langsung mengarahkan browser headless ke halaman login penuh. Dengan emulasi seluler, Instagram menyajikan tampilan profil web mobile yang membiarkan grid postingan dimuat di latar belakang.
2. **Penutupan Popup Otomatis (Banner App Promotion)**:
   Saat profil diakses di browser mobile, Instagram memunculkan popup modal *"Lihat profil lengkap di aplikasi"*. Scraper secara dinamis mendeteksi tombol tutup (`[aria-label="Tutup"]` / `[aria-label="Close"]`) dan menekannya menggunakan locator Playwright serta mensimulasikan tombol `Escape` untuk menghilangkan overlay tersebut secara instan.
3. **Metode Ekstraksi Alt-Text Gambar**:
   Dibandingkan membuka setiap postingan satu per satu (yang lambat, memakan kuota, dan sering memicu deteksi bot), scraper langsung mengumpulkan atribut `alt` dari semua elemen gambar (`img`) di grid profil. Instagram secara otomatis menyertakan teks postingan (atau deskripsi gambar) ke dalam tag `alt` ini. Cara ini mengekstrak hingga **12 caption secara instan** hanya dalam **1 kali load halaman** (~2-3 detik).
4. **Status Koneksi (Data Asli vs Estimasi AI)**:
   - **`✅ Data Asli`**: Ditampilkan saat backend scraper aktif dan berhasil menarik data riil dari Instagram.
   - **`⚠️ Estimasi AI`**: Ditampilkan sebagai fallback jika server scraper mati, di mana Gemini AI akan melakukan prediksi cerdas berdasarkan nama akun (disertai panduan untuk mengaktifkan server backend).

---

## 🛠️ Panduan Instalasi & Menjalankan

### Prasyarat
- **Node.js** v18+ (hanya untuk development)
- **npm** (atau yarn/pnpm/bun)
- **Google Chrome** atau **Chromium** (untuk Playwright scraper)

### Instalasi Dependencies
```bash
git clone https://github.com/cupiz/BGIContentStudio.git
cd BGIContentStudio
npm install
```

### 1. Jalankan Seluruh Aplikasi Secara Paralel (Sangat Direkomendasikan)
Untuk menjalankan frontend Vite dan backend scraper server secara bersamaan dalam satu terminal:
```bash
npm run dev:all
```
Aplikasi frontend akan berjalan di `http://localhost:5173` (atau port terdekat yang tersedia) dan backend server berjalan di `http://localhost:3001`.

### 2. Jalankan Secara Terpisah
Jika ingin memisahkan proses atau melihat logs scraper secara real-time:

*   **Frontend (Vite Server)**:
    ```bash
    npm run dev
    ```
*   **Backend (Express Scraper Server)**:
    ```bash
    npm run dev:server
    ```

### 3. Jalankan sebagai Desktop App (Electron)
```bash
npm run electron:dev
```

### 4. Build Desktop App
```bash
npm run electron:build
```
Output akan tersedia di folder `release/`.

---

## 📦 Distribusi Desktop (Electron)

BGI Content Studio tersedia sebagai aplikasi desktop Windows dengan fitur:

### Auto-Update
Aplikasi otomatis memeriksa GitHub Releases saat startup. Jika ada versi baru:
1. Notifikasi muncul di aplikasi
2. User klik "Download Update"
3. Aplikasi mengunduh ZIP dari GitHub Releases
4. Backup versi lama → Extract versi baru → Restart

**Rollback otomatis** jika update gagal (file corrupt, download error, dll).

### CI/CD Pipeline
```
Push ke main → GitHub Actions build → Auto-Release → User download dari GitHub Releases
```

| Component | Tech |
|-----------|------|
| **Build** | `electron-packager` (Windows x64) |
| **CI/CD** | GitHub Actions |
| **Release** | Auto-create GitHub Release + ZIP |
| **Update** | Custom updater (GitHub Releases API + adm-zip) |

---

## 🖼️ Kredensial & Pengaturan yang Dibutuhkan

| Konfigurasi / Service | Untuk | Cara Mendapatkan / Setting |
|---|---|---|
| **Google Gemini AI Key** | Analisis konten, autopilot generation, script, caption, deteksi niche, analisis gambar. | Dapatkan di [Google AI Studio](https://aistudio.google.com/app/apikey) lalu simpan di menu **Settings**. |
| **OpenRouter API Key** | Generasi gambar AI dengan model Grok & RiverFlow. | Dapatkan di [OpenRouter Keys](https://openrouter.ai/keys) lalu simpan di menu **Settings**. |
| **Google Apps Script URL** | Menghubungkan aplikasi ke script Web App untuk sinkronisasi Google Drive stabil. | Deploy Apps Script sebagai Web App (Akses: "Anyone"), lalu tempelkan URL di menu **Settings** atau file `.env` (`APPS_SCRIPT_URL`). |
| **Google Drive Access Token** | Alternatif sinkronisasi langsung ke Google Drive API (masa aktif 1 jam). | Dapatkan Access Token OAuth2 aktif, lalu simpan di menu **Settings**. |

Pengaturan API Keys dan Google Drive dapat disetel secara interaktif melalui menu **Pengaturan (Settings)** di dalam sidebar aplikasi.

---

## 📂 Struktur Folder

| Path | Deskripsi |
|------|-----------|
| `electron/main.cjs` | Electron main process — window management, server startup, auto-install Playwright |
| `electron/preload.cjs` | Preload script — IPC bridge antara main dan renderer |
| `electron/updater.cjs` | Custom auto-updater — GitHub Releases API + backup/rollback |
| `server/scraper.mjs` | Server Express — Playwright headless untuk scraping Instagram via mobile emulation |
| `src/services/gemini.js` | Integrasi API Gemini — deteksi niche, hook, script, caption, image analysis |
| `src/services/openrouter.js` | Integrasi OpenRouter API — generasi gambar dengan multiple models |
| `src/components/PillarMapping.jsx` | Antarmuka pengelolaan pilar konten, autopilot generator, dan panel scraper Instagram |
| `src/components/ImageGenerator.jsx` | Generator gambar dengan OpenRouter AI + Gemini visual analysis |
| `src/components/Settings.jsx` | Pengaturan API keys (Gemini & OpenRouter) |
| `.github/workflows/build.yml` | GitHub Actions CI/CD — auto-build & release |
| `vite.config.js` | Konfigurasi Vite + proxy `/api` ke port `http://localhost:3001` |

---

## 📋 Script Commands

| Command | Deskripsi |
|---------|-----------|
| `npm run dev` | Jalankan frontend Vite saja |
| `npm run dev:server` | Jalankan backend scraper saja |
| `npm run dev:all` | Jalankan frontend + backend secara paralel |
| `npm run build` | Build frontend ke folder `dist/` |
| `npm run lint` | Jalankan ESLint |
| `npm run electron:dev` | Jalankan sebagai desktop app (development mode) |
| `npm run electron:build` | Build desktop app Windows (output di `release/`) |

---

## 📄 License

Copyright © 2026 BGI. All rights reserved.
