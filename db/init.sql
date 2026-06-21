-- =============================================================================
-- init.sql — Inisialisasi Skema Database UMKM VFlow
-- Kelompok 3 | Sistem Manajemen Pesanan Berbasis VFlow
--
-- Target Database  : db_umkm_vflow
-- Host             : workflow-db.pake-umkm.app
-- Port             : 5432
-- User             : postgres
--
-- Cara menjalankan dari terminal (EC2 / lokal):
--   psql -h workflow-db.pake-umkm.app -U postgres -d db_umkm_vflow -f db/init.sql
--
-- Atau jika sudah masuk ke psql:
--   \c db_umkm_vflow
--   \i /path/to/umkm-vflow/db/init.sql
-- =============================================================================

-- Aktifkan ekstensi UUID (diperlukan untuk uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- TABEL: pelanggan
-- Menyimpan data pelanggan UMKM
-- =============================================================================
CREATE TABLE IF NOT EXISTS pelanggan (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama            VARCHAR(150)  NOT NULL,
    nomor_hp        VARCHAR(20)   UNIQUE,
    tipe_pelanggan  VARCHAR(20)   NOT NULL DEFAULT 'reguler'
                                  CHECK (tipe_pelanggan IN ('reguler', 'member')),
    email           VARCHAR(150),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABEL: kasir
-- Menyimpan data kasir / operator
-- =============================================================================
CREATE TABLE IF NOT EXISTS kasir (
    id          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama        VARCHAR(150)  NOT NULL,
    username    VARCHAR(50)   UNIQUE NOT NULL,
    is_active   BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABEL: produk
-- Menyimpan katalog produk beserta stok dan harga
-- =============================================================================
CREATE TABLE IF NOT EXISTS produk (
    id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama_produk   VARCHAR(200)   NOT NULL,
    kode_produk   VARCHAR(50)    UNIQUE NOT NULL,
    harga_satuan  NUMERIC(12,2)  NOT NULL CHECK (harga_satuan >= 0),
    stok          INTEGER        NOT NULL DEFAULT 0 CHECK (stok >= 0),
    satuan        VARCHAR(30)    NOT NULL DEFAULT 'pcs',
    is_active     BOOLEAN        NOT NULL DEFAULT TRUE,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABEL: pesanan
-- Menyimpan header pesanan (satu record per transaksi)
-- Lifecycle status: draft → lunas → selesai
-- =============================================================================
CREATE TABLE IF NOT EXISTS pesanan (
    id                  UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    pelanggan_id        UUID           NOT NULL REFERENCES pelanggan(id),
    kasir_id            UUID           NOT NULL REFERENCES kasir(id),
    status              VARCHAR(20)    NOT NULL DEFAULT 'draft'
                                       CHECK (status IN ('draft', 'lunas', 'selesai', 'batal')),
    subtotal            NUMERIC(14,2)  NOT NULL DEFAULT 0,
    diskon              NUMERIC(14,2)  NOT NULL DEFAULT 0,
    biaya_admin         NUMERIC(14,2)  NOT NULL DEFAULT 0,
    biaya_pengiriman    NUMERIC(14,2)  NOT NULL DEFAULT 0,
    total_tagihan       NUMERIC(14,2)  NOT NULL DEFAULT 0,
    nominal_dibayar     NUMERIC(14,2),
    kembalian           NUMERIC(14,2),
    metode_pembayaran   VARCHAR(30)    CHECK (metode_pembayaran   IN ('tunai', 'e-wallet', 'transfer')),
    metode_pengambilan  VARCHAR(30)    CHECK (metode_pengambilan  IN ('ambil-sendiri', 'delivery')),
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABEL: item_pesanan
-- Menyimpan detail item dalam satu pesanan (many-to-one ke pesanan)
-- =============================================================================
CREATE TABLE IF NOT EXISTS item_pesanan (
    id            UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
    pesanan_id    UUID           NOT NULL REFERENCES pesanan(id) ON DELETE CASCADE,
    produk_id     UUID           NOT NULL REFERENCES produk(id),
    nama_produk   VARCHAR(200)   NOT NULL,
    jumlah        INTEGER        NOT NULL CHECK (jumlah > 0),
    harga_satuan  NUMERIC(12,2)  NOT NULL,
    subtotal_item NUMERIC(14,2)  NOT NULL
                  GENERATED ALWAYS AS (jumlah * harga_satuan) STORED,
    created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- TABEL: audit_log
-- Menyimpan rekam jejak transaksi secara asinkron (diisi oleh workflow w6)
-- =============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
    aktivitas_tipe  VARCHAR(60)   NOT NULL,
    pesanan_id      UUID,
    payload_log     JSONB,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- INDEX — Optimasi performa query
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_pesanan_pelanggan   ON pesanan      (pelanggan_id);
CREATE INDEX IF NOT EXISTS idx_pesanan_status      ON pesanan      (status);
CREATE INDEX IF NOT EXISTS idx_pesanan_created     ON pesanan      (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_item_pesanan_id     ON item_pesanan (pesanan_id);
CREATE INDEX IF NOT EXISTS idx_item_produk_id      ON item_pesanan (produk_id);
CREATE INDEX IF NOT EXISTS idx_audit_tipe          ON audit_log    (aktivitas_tipe);
CREATE INDEX IF NOT EXISTS idx_audit_pesanan       ON audit_log    (pesanan_id);
CREATE INDEX IF NOT EXISTS idx_audit_created       ON audit_log    (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_produk_kode         ON produk       (kode_produk);

-- =============================================================================
-- SEED DATA — Data awal untuk keperluan pengujian
-- =============================================================================

-- Kasir default
INSERT INTO kasir (id, nama, username) VALUES
    ('a0000000-0000-0000-0000-000000000001', 'Admin Kasir 1', 'kasir01'),
    ('a0000000-0000-0000-0000-000000000002', 'Admin Kasir 2', 'kasir02')
ON CONFLICT (username) DO NOTHING;

-- Pelanggan contoh
INSERT INTO pelanggan (id, nama, nomor_hp, tipe_pelanggan) VALUES
    ('b0000000-0000-0000-0000-000000000001', 'Budi Santoso', '081234567890', 'member'),
    ('b0000000-0000-0000-0000-000000000002', 'Siti Rahayu',  '082345678901', 'reguler'),
    ('b0000000-0000-0000-0000-000000000003', 'Ahmad Fauzi',  '083456789012', 'member')
ON CONFLICT (nomor_hp) DO NOTHING;

-- Produk contoh
INSERT INTO produk (id, nama_produk, kode_produk, harga_satuan, stok, satuan) VALUES
    ('c0000000-0000-0000-0000-000000000001', 'Ayam Goreng Crispy', 'PRD-001', 25000, 100, 'porsi'),
    ('c0000000-0000-0000-0000-000000000002', 'Nasi Putih',         'PRD-002',  5000, 200, 'porsi'),
    ('c0000000-0000-0000-0000-000000000003', 'Es Teh Manis',       'PRD-003',  5000, 150, 'gelas'),
    ('c0000000-0000-0000-0000-000000000004', 'Rendang Sapi',       'PRD-004', 35000,  80, 'porsi'),
    ('c0000000-0000-0000-0000-000000000005', 'Mie Goreng Spesial', 'PRD-005', 20000, 120, 'porsi')
ON CONFLICT (kode_produk) DO NOTHING;

-- Konfirmasi selesai
SELECT 'Skema dan seed data db_umkm_vflow berhasil diinisialisasi.' AS info;
