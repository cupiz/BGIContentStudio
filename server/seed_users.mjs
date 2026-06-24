import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Gunakan DATABASE_URL dari .env, atau default ke localhost jika tidak ada
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/bgidb';

async function seed() {
  const safeUrl = DATABASE_URL.replace(/:([^:@]+)@/, ':****@');
  console.log('[Seeder] Menghubungkan ke PostgreSQL:', safeUrl);
  
  // 1. Koneksi awal ke database default 'postgres' untuk memastikan 'bgidb' ada
  const adminDbUrl = DATABASE_URL.replace(/\/([^/?]+)(\?|$)/, '/postgres$2');
  const tempPool = new pg.Pool({
    connectionString: adminDbUrl,
  });

  try {
    console.log('[Seeder] Memeriksa apakah database "bgidb" sudah ada...');
    const dbCheck = await tempPool.query("SELECT 1 FROM pg_database WHERE datname = 'bgidb'");
    
    if (dbCheck.rowCount === 0) {
      console.log('[Seeder] Database "bgidb" tidak ditemukan. Membuat database baru...');
      await tempPool.query("CREATE DATABASE bgidb");
      console.log('✅ Database "bgidb" berhasil dibuat!');
    } else {
      console.log('[Seeder] Database "bgidb" sudah ada.');
    }
  } catch (err) {
    console.warn('[Seeder] Info/Peringatan saat memeriksa/membuat database:', err.message);
  } finally {
    await tempPool.end();
  }

  // 2. Hubungkan ke database 'bgidb' yang sebenarnya
  const pool = new pg.Pool({
    connectionString: DATABASE_URL,
  });

  try {
    // Buat Tabel Users jika belum ada
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

    // Daftar user testing yang akan dimasukkan
    const testUsers = [
      { username: 'admin', password: 'admin123', fullName: 'Super Admin', role: 'admin' },
      { username: 'cs', password: 'cs123', fullName: 'Budi CS', role: 'cs' },
      { username: 'leader', password: 'leader123', fullName: 'Andi Leader', role: 'leader' }
    ];

    console.log('[Seeder] Memulai input data user...');
    
    for (const u of testUsers) {
      const hash = await bcrypt.hash(u.password, 10);
      try {
        await pool.query(`
          INSERT INTO users (username, password_hash, full_name, role) 
          VALUES ($1, $2, $3, $4) 
          ON CONFLICT (username) 
          DO UPDATE SET 
            password_hash = EXCLUDED.password_hash, 
            full_name = EXCLUDED.full_name, 
            role = EXCLUDED.role
        `, [u.username, hash, u.fullName, u.role]);
        console.log(`✅ User berhasil dibuat/diperbarui: ${u.username} (${u.role})`);
      } catch (err) {
        console.error(`❌ Gagal memasukkan user ${u.username}:`, err.message);
      }
    }
    
    console.log('[Seeder] Selesai melakukan seeding database.');
  } catch (err) {
    console.error('[Seeder] Terjadi kesalahan fatal:', err.message);
  } finally {
    await pool.end();
  }
}

seed();
