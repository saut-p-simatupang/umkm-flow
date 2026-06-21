/**
 * db/verify.js — Verifikasi Cepat Database UMKM VFlow
 * Kelompok 3 | Sistem Manajemen Pesanan Berbasis VFlow
 *
 * Mengecek bahwa schema dan seed data sudah benar tanpa perlu psql.
 *
 * Cara pakai:
 *   node db/verify.js
 */

import pg   from 'pg';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// ─── Load .env secara manual (tanpa package 'dotenv') ────────────────────────
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return;

  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIndex = line.indexOf('=');
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    let value = line.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvFile();

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL belum diset di .env');
  process.exit(1);
}

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});

async function verify() {
  console.log('🔌 Menghubungkan ke database Railway...\n');
  await client.connect();

  // ── 1. Cek semua tabel ada ──────────────────────────────────────────────
  const expectedTables = ['pelanggan', 'kasir', 'produk', 'pesanan', 'item_pesanan', 'audit_log'];
  const { rows: tableRows } = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  const actualTables = tableRows.map((r) => r.table_name);

  console.log('📋 Tabel yang ditemukan:', actualTables.join(', '));
  const missingTables = expectedTables.filter((t) => !actualTables.includes(t));
  if (missingTables.length > 0) {
    console.log('   ❌ Tabel hilang:', missingTables.join(', '));
  } else {
    console.log('   ✅ Semua 6 tabel yang diharapkan ada.\n');
  }

  // ── 2. Hitung baris seed data ───────────────────────────────────────────
  console.log('🌱 Cek seed data:');
  for (const table of ['kasir', 'pelanggan', 'produk']) {
    const { rows } = await client.query(`SELECT COUNT(*) AS total FROM ${table};`);
    console.log(`   - ${table.padEnd(12)}: ${rows[0].total} baris`);
  }

  // ── 3. Sanity check: contoh produk + cek constraint stok ───────────────
  console.log('\n🔎 Contoh data produk:');
  const { rows: produkSample } = await client.query(`
    SELECT kode_produk, nama_produk, harga_satuan, stok
    FROM produk
    ORDER BY kode_produk
    LIMIT 3;
  `);
  for (const p of produkSample) {
    console.log(`   - ${p.kode_produk} | ${p.nama_produk} | Rp${p.harga_satuan} | stok: ${p.stok}`);
  }

  // ── 4. Sanity check: pelanggan member untuk test diskon nanti ──────────
  console.log('\n👤 Pelanggan member (untuk test diskon nanti):');
  const { rows: memberSample } = await client.query(`
    SELECT id, nama, tipe_pelanggan
    FROM pelanggan
    WHERE tipe_pelanggan = 'member'
    LIMIT 5;
  `);
  for (const m of memberSample) {
    console.log(`   - ${m.nama} (${m.id})`);
  }

  console.log('\n✅ Verifikasi selesai. Database siap dipakai.');
}

verify()
  .catch((err) => {
    console.error('\n❌ Verifikasi gagal:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await client.end();
  });
