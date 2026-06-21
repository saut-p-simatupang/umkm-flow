require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();

// 1. Konfigurasi CORS agar Frontend bisa mengakses API
app.use(cors());
app.use(express.json());

// 2. Koneksi Database PostgreSQL (Railway otomatis menyuplai DATABASE_URL)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false // Di lokal tidak perlu SSL wajib, di Railway otomatis pakai SSL
});

// Test Koneksi DB saat Server Menyala
pool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ Gagal terhubung ke Database PostgreSQL Railway:', err.stack);
    }
    console.log('✨ Sukses Terkoneksi ke Database PostgreSQL Railway!');
    release();
});

// =============================================================================
// ENDPOINT API (Menyesuaikan dengan Skema init.sql Kamu)
// =============================================================================

// Get Semua Katalog Produk
app.get('/api/produk', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM produk WHERE is_active = true ORDER BY nama_produk ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error saat mengambil produk' });
    }
});

// Get Semua Data Pelanggan
app.get('/api/pelanggan', async (req, res) => {
    try {
        const result = await pool.query('SELECT id, nama, nomor_hp, tipe_pelanggan FROM pelanggan ORDER BY nama ASC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Server Error saat mengambil pelanggan' });
    }
});

// Membuat Pesanan Baru (Workflow VFlow)
app.post('/api/pesanan', async (req, res) => {
    const { pelanggan_id, kasir_id, status, subtotal, diskon, total_tagihan, items } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN'); // Menggunakan Transaksi SQL agar aman

        // 1. Insert ke tabel pesanan
        const queryPesanan = `
      INSERT INTO pesanan (pelanggan_id, kasir_id, status, subtotal, diskon, total_tagihan)
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;
    `;
        const resPesanan = await client.query(queryPesanan, [pelanggan_id, kasir_id, status || 'draft', subtotal, diskon, total_tagihan]);
        const pesananId = resPesanan.rows[0].id;

        // 2. Insert item-item pesanan ke tabel item_pesanan
        const queryItem = `
      INSERT INTO item_pesanan (pesanan_id, produk_id, nama_produk, jumlah, harga_satuan)
      VALUES ($1, $2, $3, $4, $5);
    `;

        for (let item of items) {
            await client.query(queryItem, [pesananId, item.produk_id, item.nama_produk, item.jumlah, item.harga_satuan]);

            // Mengurangi stok produk secara otomatis
            await client.query('UPDATE produk SET stok = stok - $1 WHERE id = $2', [item.jumlah, item.produk_id]);
        }

        // 3. Catat aktivitas asinkron ke audit_log
        await client.query(
            'INSERT INTO audit_log (aktivitas_tipe, pesanan_id, payload_log) VALUES ($1, $2, $3)',
            ['CREATE_ORDER_VFLOW', pesananId, JSON.stringify({ items_count: items.length, total: total_tagihan })]
        );

        await client.query('COMMIT');
        res.status(201).json({ success: true, message: 'Pesanan berhasil dibuat!', pesanan_id: pesananId });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(500).json({ success: false, message: 'Gagal memproses pesanan / stok kurang.' });
    } finally {
        client.release();
    }
});

// Health check endpoint untuk Railway deployment
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'UP', message: 'VFlow system is healthy' });
});

// 3. Menjalankan Port Dinamis (Wajib untuk Railway)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server backend berjalan rapi di port ${PORT}`);
});