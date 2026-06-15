# BGI Content Studio 🚀

BGI Content Studio adalah aplikasi asisten pembuatan konten media sosial premium berbasis AI yang dirancang untuk memetakan strategi brand, menyusun pilar konten, menghasilkan ide, draf skrip, hook, hingga caption siap pakai secara otomatis.

Aplikasi ini menggunakan teknologi **React (Vite)** untuk antarmuka pengguna, **Express** untuk backend service, **Gemini AI API** untuk kecerdasan analisis konten, dan **Playwright** untuk scraping profil Instagram secara real.

---

## ✨ Fitur Utama
1. **Strategic Niche & Brand Profiling**: Mengidentifikasi positioning, target audiens, segmentasi, tone of voice, dan brand archetype.
2. **Real Instagram Scraper (Deteksi Niche)**: Menganalisis akun kompetitor atau role model secara dinamis untuk mendeteksi niche utama mereka secara akurat.
3. **Autopilot AI (One-Click)**: Menghubungkan seluruh tahapan dari niche, pilar, ide konten, skrip video, variasi hook emosional, hingga caption media sosial dalam sekali klik.
4. **Pilar Konten Dinamis**: Visualisasi pilar konten yang dapat ditambah, disunting, dan dihapus secara fleksibel.

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

## 🛠️ Panduan Menjalankan Aplikasi

Pastikan Anda telah menginstal seluruh dependensi dengan menjalankan `npm install`.

### 1. Jalankan Seluruh Aplikasi Secara Paralel (Sangat Direkomendasikan)
Untuk menjalankan frontend Vite dan backend scraper server secara bersamaan dalam satu terminal, jalankan:
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

---

## 📂 Struktur Folder Penting
*   `server/scraper.mjs`: Server Express yang menjalankan Playwright headless untuk scraping Instagram via mobile emulation.
*   `src/services/gemini.js`: Integrasi API Gemini. Mengatur alur deteksi niche dengan 3 strategi (real backend API -> paste HTML manual -> AI simulation fallback).
*   `src/components/PillarMapping.jsx`: Antarmuka pengelolaan pilar konten, autopilot generator, dan panel scraper Instagram.
*   `vite.config.js`: Dilengkapi dengan konfigurasi proxy `/api` ke port `http://localhost:3001` untuk menghindari masalah CORS di sisi klien.

