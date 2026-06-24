/**
 * BGI Content Studio - VPS API Server (Node.js + Express + PostgreSQL)
 * 
 * Tempatkan file ini di VPS Anda. Pastikan untuk menginstal dependensi:
 * npm install express cors pg jsonwebtoken bcryptjs dotenv node-fetch
 * 
 * Buat file .env di direktori yang sama:
 * PORT=5000
 * DATABASE_URL=postgres://username:password@localhost:5432/bgidb
 * JWT_SECRET=bgi_super_secret_key_123
 * APPS_SCRIPT_URL=https://script.google.com/macros/s/.../exec
 */

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'bgi_super_secret_key_123';
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || '';

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Database Connection
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bgidb',
});

// Auto-Initialize Database Tables
async function initDb() {
  try {
    // 1. Buat Tabel Users
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('cs', 'leader', 'admin')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Buat Tabel Media Contents
    await pool.query(`
      CREATE TABLE IF NOT EXISTS media_contents (
        id SERIAL PRIMARY KEY,
        gdrive_file_id VARCHAR(100) NOT NULL UNIQUE,
        file_name VARCHAR(255) NOT NULL,
        gdrive_url TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UPLOADED', 'DONE')),
        cs_id INT REFERENCES users(id),
        proof_link TEXT,
        uploaded_at TIMESTAMP,
        leader_id INT REFERENCES users(id),
        done_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('[Database] Tables initialized successfully');
  } catch (err) {
    console.error('[Database] Initialization error:', err.message);
  }
}
initDb();

// Middleware: Authenticate JWT Token
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ success: false, error: 'Token tidak valid atau kedaluwarsa.' });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ success: false, error: 'Otorisasi token tidak disertakan.' });
  }
}

// Middleware: Role Checker
function requireRole(roles) {
  return (req, res, next) => {
    if (roles.includes(req.user.role)) {
      next();
    } else {
      res.status(403).json({ success: false, error: 'Akses ditolak. Peran tidak memadai.' });
    }
  };
}

// Helper: Trigger Google Apps Script Rename
async function triggerGDriveRename(fileId, suffix) {
  if (!APPS_SCRIPT_URL) return;
  try {
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'rename',
        fileId: fileId,
        suffix: suffix
      })
    });
    console.log(`[Google Drive] Triggered rename for ${fileId} with suffix ${suffix}`);
  } catch (err) {
    console.error('[Google Drive] Rename failed:', err.message);
  }
}

// ==========================================
// 🔐 AUTHENTICATION ENDPOINTS
// ==========================================

// Register User (Hanya untuk Admin / Setup Awal)
app.post('/api/auth/register', async (req, res) => {
  const { username, password, full_name, role } = req.body;
  if (!username || !password || !full_name || !role) {
    return res.status(400).json({ success: false, error: 'Harap lengkapi semua field.' });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, username, full_name, role',
      [username, passwordHash, full_name, role]
    );
    res.status(201).json({ success: true, user: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') { // Postgres Unique violation
      return res.status(400).json({ success: false, error: 'Username sudah digunakan.' });
    }
    res.status(500).json({ success: false, error: err.message });
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Lengkapi username dan password.' });
  }

  try {
    const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    if (result.rowCount === 0) {
      return res.status(401).json({ success: false, error: 'Username atau password salah.' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Username atau password salah.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, full_name: user.full_name },
      JWT_SECRET,
      { expiresIn: '30d' } // Token bertahan 30 hari
    );

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 🔄 WORKFLOW CONTENT ENDPOINTS
// ==========================================

// 1. Mendaftarkan file PENDING baru (Bisa dipanggil tanpa login/oleh Client BGI Studio)
app.post('/api/content/register', async (req, res) => {
  const { gdrive_file_id, file_name, gdrive_url } = req.body;
  if (!gdrive_file_id || !file_name || !gdrive_url) {
    return res.status(400).json({ success: false, error: 'Metadata file tidak lengkap.' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO media_contents (gdrive_file_id, file_name, gdrive_url, status) VALUES ($1, $2, $3, \'PENDING\') ON CONFLICT (gdrive_file_id) DO UPDATE SET file_name = EXCLUDED.file_name RETURNING *',
      [gdrive_file_id, file_name, gdrive_url]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Mendapatkan daftar gambar berstatus PENDING (Untuk Dashboard CS)
app.get('/api/content/pending', authenticateJWT, requireRole(['cs', 'admin']), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM media_contents WHERE status = \'PENDING\' ORDER BY created_at DESC');
    res.json({ success: true, files: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. CS Menandai sudah diupload ke medsos & menyerahkan link bukti (Rename ke _UPLOADED)
app.put('/api/content/mark-uploaded', authenticateJWT, requireRole(['cs', 'admin']), async (req, res) => {
  const { id, proof_link } = req.body;
  const cs_id = req.user.id;

  if (!id || !proof_link) {
    return res.status(400).json({ success: false, error: 'Harap lampirkan ID dan Link Bukti postingan.' });
  }

  try {
    const fileRes = await pool.query('SELECT gdrive_file_id, file_name FROM media_contents WHERE id = $1', [id]);
    if (fileRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'File tidak ditemukan.' });
    }
    const { gdrive_file_id, file_name } = fileRes.rows[0];

    // Update status di DB
    const result = await pool.query(
      'UPDATE media_contents SET status = \'UPLOADED\', cs_id = $1, proof_link = $2, uploaded_at = CURRENT_TIMESTAMP WHERE id = $3 AND status = \'PENDING\' RETURNING *',
      [cs_id, proof_link, id]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ success: false, error: 'Konten gagal diperbarui. Pastikan status saat ini PENDING.' });
    }

    // Ganti nama file di Drive (Asinkronus)
    triggerGDriveRename(gdrive_file_id, 'UPLOADED');

    // Update nama di DB lokal agar sinkron
    const extIdx = file_name.lastIndexOf('.');
    const ext = extIdx !== -1 ? file_name.substring(extIdx) : '';
    const base = extIdx !== -1 ? file_name.substring(0, extIdx) : file_name;
    const newNameInDb = `${base}_UPLOADED${ext}`;
    await pool.query('UPDATE media_contents SET file_name = $1 WHERE id = $2', [newNameInDb, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Mendapatkan daftar gambar berstatus UPLOADED (Untuk Dashboard Project Leader)
app.get('/api/content/uploaded', authenticateJWT, requireRole(['leader', 'admin']), async (req, res) => {
  try {
    const query = `
      SELECT m.*, u.full_name as cs_name 
      FROM media_contents m 
      LEFT JOIN users u ON m.cs_id = u.id 
      WHERE m.status = 'UPLOADED' 
      ORDER BY m.uploaded_at ASC
    `;
    const result = await pool.query(query);
    res.json({ success: true, files: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Project Leader menyetujui konten menjadi DONE (Rename ke _DONE)
app.put('/api/content/mark-done', authenticateJWT, requireRole(['leader', 'admin']), async (req, res) => {
  const { id } = req.body;
  const leader_id = req.user.id;

  if (!id) {
    return res.status(400).json({ success: false, error: 'ID file dibutuhkan.' });
  }

  try {
    const fileRes = await pool.query('SELECT gdrive_file_id, file_name FROM media_contents WHERE id = $1', [id]);
    if (fileRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'File tidak ditemukan.' });
    }
    const { gdrive_file_id, file_name } = fileRes.rows[0];

    const result = await pool.query(
      'UPDATE media_contents SET status = \'DONE\', leader_id = $1, done_at = CURRENT_TIMESTAMP WHERE id = $2 AND status = \'UPLOADED\' RETURNING *',
      [leader_id, id]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ success: false, error: 'Konten gagal disetujui. Pastikan status saat ini UPLOADED.' });
    }

    // Ganti nama file di Drive (Asinkronus)
    triggerGDriveRename(gdrive_file_id, 'DONE');

    // Update nama di DB lokal
    const cleanBase = file_name.replace(/_UPLOADED\.[^.]+$/, '').replace(/\.[^.]+$/, '');
    const extIdx = file_name.lastIndexOf('.');
    const ext = extIdx !== -1 ? file_name.substring(extIdx) : '';
    const newNameInDb = `${cleanBase}_DONE${ext}`;
    await pool.query('UPDATE media_contents SET file_name = $1 WHERE id = $2', [newNameInDb, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Project Leader menolak / mengembalikan status foto ke PENDING (Reset nama di Drive)
app.put('/api/content/reject', authenticateJWT, requireRole(['leader', 'admin']), async (req, res) => {
  const { id } = req.body;
  if (!id) {
    return res.status(400).json({ success: false, error: 'ID file dibutuhkan.' });
  }

  try {
    const fileRes = await pool.query('SELECT gdrive_file_id, file_name FROM media_contents WHERE id = $1', [id]);
    if (fileRes.rowCount === 0) {
      return res.status(404).json({ success: false, error: 'File tidak ditemukan.' });
    }
    const { gdrive_file_id, file_name } = fileRes.rows[0];

    const result = await pool.query(
      'UPDATE media_contents SET status = \'PENDING\', cs_id = NULL, proof_link = NULL, uploaded_at = NULL WHERE id = $1 AND status = \'UPLOADED\' RETURNING *',
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ success: false, error: 'Gagal menolak file. Pastikan status saat ini UPLOADED.' });
    }

    // Reset nama di Drive (hapus akhiran status)
    triggerGDriveRename(gdrive_file_id, '');

    // Reset nama di DB lokal
    const cleanBase = file_name.replace(/_UPLOADED\.[^.]+$/, '').replace(/\.[^.]+$/, '');
    const extIdx = file_name.lastIndexOf('.');
    const ext = extIdx !== -1 ? file_name.substring(extIdx) : '';
    const newNameInDb = `${cleanBase}${ext}`;
    await pool.query('UPDATE media_contents SET file_name = $1 WHERE id = $2', [newNameInDb, id]);

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[Server] VPS API server is running on port ${PORT}`);
});
