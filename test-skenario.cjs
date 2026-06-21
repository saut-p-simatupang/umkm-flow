const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:TUOlyPAmTGyeSrUBmjOoChKRCTRfzAkh@switchback.proxy.rlwy.net:11478/railway',
    ssl: { rejectUnauthorized: false }
});

async function jalankanSkenario() {
    try {
        await client.connect();
        console.log('🔌 Terhubung ke Database Railway...');

        // ==========================================
        // SKENARIO 1: Buka Keranjang (Modul 1)
        // ==========================================
        console.log('\n🛒 [Skenario 1] Membuka Keranjang...');
        // Menggunakan ID yang ada di Seed Data init.sql Anda
        const pelangganId = 'b0000000-0000-0000-0000-000000000001'; // Budi Santoso
        const kasirId = 'a0000000-0000-0000-0000-000000000001';     // Admin Kasir 1

        const resKeranjang = await client.query(
            `INSERT INTO pesanan (pelanggan_id, kasir_id, status) VALUES ($1, $2, 'draft') RETURNING id;`,
            [pelangganId, kasirId]
        );
        const pesananId = resKeranjang.rows[0].id;
        console.log(`✅ Keranjang berhasil dibuat! Pesanan ID: ${pesananId}`);

        // ==========================================
        // SKENARIO 2: Validasi Stok (Modul 2)
        // ==========================================
        console.log('\n📦 [Skenario 2] Memeriksa Stok Produk...');
        const produkId = 'c0000000-0000-0000-0000-000000000001'; // Ayam Goreng Crispy
        const jumlahBeli = 2;

        const resStok = await client.query(`SELECT stok, nama_produk, harga_satuan FROM produk WHERE id = $1;`, [produkId]);

        if (resStok.rows.length === 0 || resStok.rows[0].stok < jumlahBeli) {
            throw new Error('Stok tidak mencukupi atau produk tidak ditemukan!');
        }
        const produk = resStok.rows[0];
        console.log(`✅ Stok aman! ${produk.nama_produk} tersedia (Sisa Stok: ${produk.stok})`);

        // Catat item ke keranjang belanja detail (item_pesanan)
        const subtotalItem = jumlahBeli * parseFloat(produk.harga_satuan);
        await client.query(
            `INSERT INTO item_pesanan (pesanan_id, produk_id, nama_produk, jumlah, harga_satuan) VALUES ($1, $2, $3, $4, $5);`,
            [pesananId, produkId, produk.nama_produk, jumlahBeli, produk.harga_satuan]
        );
        console.log(`   └─ Item berhasil ditambahkan ke detail pesanan.`);

        // ==========================================
        // SKENARIO 3: Kalkulasi Tagihan (Modul 3)
        // ==========================================
        console.log('\n💰 [Skenario 3] Menghitung Kalkulasi Tagihan...');
        const subtotal = subtotalItem;
        const diskon = 5000; // Contoh potongan untuk member
        const biayaAdmin = 2000;
        const biayaPengiriman = 0;
        const totalTagihan = subtotal - diskon + biayaAdmin + biayaPengiriman;

        await client.query(
            `UPDATE pesanan SET 
        subtotal = $1, 
        diskon = $2, 
        biaya_admin = $3, 
        biaya_pengiriman = $4, 
        total_tagihan = $5,
        metode_pembayaran = 'tunai',
        metode_pengambilan = 'ambil-sendiri'
       WHERE id = $6;`,
            [subtotal, diskon, biayaAdmin, biayaPengiriman, totalTagihan, pesananId]
        );
        console.log(`✅ Kalkulasi Selesai.`);
        console.log(`   ├─ Subtotal      : Rp${subtotal}`);
        console.log(`   ├─ Diskon Member : Rp${diskon}`);
        console.log(`   ├─ Biaya Admin   : Rp${biayaAdmin}`);
        console.log(`   └─ Total Tagihan : Rp${totalTagihan}`);

    } catch (error) {
        console.error('❌ Skenario Gagal:', error.message);
    } finally {
        await client.end();
        console.log('\n🏁 Pengujian Selesai, koneksi DB ditutup.');
    }
}

jalankanSkenario();