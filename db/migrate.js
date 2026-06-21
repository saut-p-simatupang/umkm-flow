/**
 * db/migrate.js — Script Migrasi Database UMKM VFlow
 * Kelompok 3 | Sistem Manajemen Pesanan Berbasis VFlow
 *
 * Menjalankan seluruh init.sql ke PostgreSQL menggunakan node-postgres (pg).
 * Tidak memerlukan psql client terinstall.
 *
 * Cara pakai:
 *   node db/migrate.js
 */

import pg   from 'pg';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Load .env secara manual (tanpa package 'dotenv') ────────────────────────
// Dicari relatif ke root project (satu level di atas folder db/).
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');

  if (!fs.existsSync(envPath)) {
    console.warn(`⚠️  File .env tidak ditemukan di: ${envPath}`);
    console.warn('   Melanjutkan dengan environment variable yang sudah ada di shell saja.\n');
    return;
  }

  const content = fs.readFileSync(envPath, 'utf8');

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;

    const key   = line.slice(0, eqIndex).trim();
    let   value = line.slice(eqIndex + 1).trim();

    // Buang tanda kutip pembungkus jika ada
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Jangan timpa env var yang sudah diset manual di shell
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile();

// ─── Konfigurasi koneksi ──────────────────────────────────────────────────────
// Mendukung dua cara konfigurasi:
//   1. DATABASE_URL tunggal (format yang diberikan Railway/Render/Heroku)
//   2. Variabel terpisah DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD
//
// TIDAK ADA fallback password hardcoded — jika kredensial tidak diset,
// proses akan berhenti dengan pesan error yang jelas, bukan diam-diam
// connect ke server yang salah.
const { Client } = pg;

function buildClientConfig() {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      // Railway TCP proxy (*.proxy.rlwy.net) menggunakan self-signed
      // certificate by design, jadi rejectUnauthorized harus false di sini.
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 10000,
    };
  }

  const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing  = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('❌ Konfigurasi database tidak lengkap.');
    console.error(`   Variabel yang belum diset: ${missing.join(', ')}`);
    console.error('   Set DATABASE_URL, atau lengkapi DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD di .env');
    process.exit(1);
  }

  return {
    host:     process.env.DB_HOST,
    port:     parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME,
    user:     process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  };
}

const clientConfig = buildClientConfig();
const client = new Client(clientConfig);

const connSummary = clientConfig.connectionString
  ? 'via DATABASE_URL (Railway)'
  : `${clientConfig.user}@${clientConfig.host}:${clientConfig.port}/${clientConfig.database}`;

// ─── Baca file SQL ────────────────────────────────────────────────────────────
const sqlPath = path.join(__dirname, 'init.sql');
const sql     = fs.readFileSync(sqlPath, 'utf8');

// ─── Jalankan migrasi ─────────────────────────────────────────────────────────
async function migrate() {
  console.log('🔌 Menghubungkan ke database...');
  console.log(`   Target   : ${connSummary}`);

  try {
    await client.connect();
    console.log('✅ Koneksi berhasil!\n');

    console.log('📦 Menjalankan init.sql...');
    await client.query(sql);

    console.log('✅ Skema database berhasil diinisialisasi!');
    console.log('   - Tabel   : pelanggan, kasir, produk, pesanan, item_pesanan, audit_log');
    console.log('   - Index   : 9 index dibuat');
    console.log('   - Seed    : Data awal kasir, pelanggan, produk berhasil dimasukkan');
  } catch (err) {
    console.error('\n❌ Migrasi gagal:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    if (err.hint)   console.error('   Hint  :', err.hint);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Koneksi ditutup.');
  }
}

migrate();
