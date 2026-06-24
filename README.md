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

### 🖼️ Image Generation (OpenRouter AI)
- **Image-to-Image Generation**: Upload gambar referensi sebagai panduan gaya visual, lalu generate gambar baru dengan AI.
- **Text-to-Image Generation**: Generate gambar dari prompt teks menggunakan model AI seperti **RiverFlow v2.5** dan **Grok Imagine**.
- **Gemini Visual Analysis**: Analisis gambar referensi menggunakan Gemini AI untuk mendapatkan rekomendasi prompt otomatis.
- **Multi-Model Support**: Pilih model AI yang berbeda untuk hasil yang berbeda (RiverFlow untuk kualitas cepat, Grok untuk variasi artistik).
- **Download Generated Images**: Download hasil gambar yang sudah di-generate langsung dari aplikasi.

### 📱 Desktop App (Electron)
- **Auto-Update**: Aplikasi otomatis mendeteksi update dari GitHub Releases dan mengunduhnya tanpa perlu download manual.
- **Splash Screen**: Tampilan loading interaktif saat aplikasi memulai (install Chromium, start server, load UI).
- **Playwright Auto-Install**: Chromium browser otomatis di-install saat pertama kali membuka aplikasi.
- **System Tray**: Aplikasi berjalan di system tray untuk akses cepat.

### 🔄 CI/CD Automation (GitHub Actions)
- **Auto-Build**: Setiap push ke branch `main` otomatis build aplikasi Windows.
- **Auto-Release**: Build otomatis di-zip dan di-upload ke GitHub Releases.
- **Version Auto-Increment**: Nomor versi otomatis naik setiap release baru.

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

## 🖼️ API Keys yang Dibutuhkan

| Service | Untuk | Mendapatkan Key |
|---------|-------|-----------------|
| **Google Gemini AI** | Analisis konten, hook generation, script, caption, niche detection | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| **OpenRouter** | Generasi gambar AI (RiverFlow, Grok Imagine) | [OpenRouter](https://openrouter.ai/keys) |

Set API Key di menu **Pengaturan (Settings)** dalam aplikasi.

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

Copyright © 2024 BGI. All rights reserved.
