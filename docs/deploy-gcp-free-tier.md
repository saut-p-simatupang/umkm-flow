# 🚀 Panduan Deployment — GCP Free Tier (e2-micro)
## UMKM VFlow Backend | Kelompok 3

> **Target:** Google Compute Engine **e2-micro** (Free Tier — selalu gratis)
> **OS:** Debian 12 (Bookworm) — rekomendasi terstabil untuk Node.js di GCP free tier
> **Region:** `us-central1`, `us-west1`, atau `us-east1` *(wajib untuk free tier)*

---

## 📋 Spesifikasi GCP Free Tier e2-micro

| Resource | Batas Free Tier |
|---|---|
| **vCPU** | 0.25 vCPU (burst) |
| **RAM** | 1 GB |
| **Disk** | 30 GB HDD Standard |
| **Egress** | 1 GB/bulan (keluar ke internet) |
| **Region** | us-central1 / us-west1 / us-east1 |
| **Biaya** | **$0 / bulan** (dalam batas di atas) |

> ⚠️ **Penting:** e2-micro punya RAM terbatas (1 GB). Node.js + PM2 + VFlow Server semuanya harus muat di sini.
> Aktifkan **swap** untuk mencegah OOM (Out of Memory).

---

## BAGIAN 1 — Buat VM di GCP Console

### Langkah 1.1: Buka Google Cloud Console
1. Buka https://console.cloud.google.com
2. Buat project baru atau pilih project yang ada
3. Aktifkan billing (tetap gratis selama dalam batas free tier)

### Langkah 1.2: Buat VM Instance
```
Menu → Compute Engine → VM Instances → CREATE INSTANCE
```

Isi konfigurasi berikut:

| Field | Nilai |
|---|---|
| **Name** | `umkm-vflow-server` |
| **Region** | `us-central1` |
| **Zone** | `us-central1-a` |
| **Machine type** | `e2-micro` ← wajib untuk free tier |
| **Boot disk OS** | Debian GNU/Linux 12 (Bookworm) |
| **Boot disk type** | Standard persistent disk |
| **Boot disk size** | 30 GB |
| **Firewall** | ✅ Allow HTTP traffic |
| **Firewall** | ✅ Allow HTTPS traffic |

### Langkah 1.3: Tambah Firewall Rule untuk Port 3000
Setelah VM dibuat, buka **VPC Network → Firewall → CREATE FIREWALL RULE**:

| Field | Nilai |
|---|---|
| **Name** | `allow-node-backend` |
| **Direction** | Ingress |
| **Action** | Allow |
| **Targets** | All instances in the network |
| **Source IP ranges** | `0.0.0.0/0` |
| **Protocols/ports** | `tcp:3000` |

---

## BAGIAN 2 — Setup Awal VM (SSH ke VM)

Buka SSH dari GCP Console dengan klik tombol **SSH** di samping VM, atau:
```bash
gcloud compute ssh umkm-vflow-server --zone=us-central1-a
```

### Langkah 2.1: Update Sistem
```bash
sudo apt update && sudo apt upgrade -y
```

### Langkah 2.2: Install Node.js 20 LTS (via NodeSource)
```bash
# Install curl jika belum ada
sudo apt install -y curl

# Tambah NodeSource repo untuk Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -

# Install Node.js
sudo apt install -y nodejs

# Verifikasi
node -v   # Harus >= v20.x.x
npm -v    # Harus >= 9.x.x
```

### Langkah 2.3: Install PM2 secara Global
```bash
sudo npm install -g pm2
pm2 -v
```

### Langkah 2.4: Install Git
```bash
sudo apt install -y git
```

### Langkah 2.5: Aktifkan SWAP (WAJIB untuk e2-micro 1GB RAM)
```bash
# Buat swap file 1GB
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Buat permanen (aktif setelah reboot)
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verifikasi
free -h
# Harus terlihat Swap: 1.0G
```

---

## BAGIAN 3 — Deploy Kode Aplikasi

### Langkah 3.1: Clone Repository
```bash
cd ~
git clone https://github.com/NAMA_USER/umkm-vflow.git
cd umkm-vflow
```

> Jika repo private, gunakan Personal Access Token atau SSH key.

### Langkah 3.2: Install NPM Dependencies
```bash
npm install --omit=dev
```

> `--omit=dev` untuk tidak install jest/supertest di production (hemat RAM).

### Langkah 3.3: Setup File .env
```bash
cp .env.example .env
nano .env
```

Isi file `.env` dengan nilai berikut:
```env
# ── Server ─────────────────────────────────────
PORT=3000
NODE_ENV=production

# ── API Key ─────────────────────────────────────
API_KEY=UMKM_SECRET_API_KEY_2025

# ── VFlow Server (berjalan di VM yang sama) ──────
VFLOW_BASE_URL=http://localhost:8000

# ── Database PostgreSQL ──────────────────────────
DB_HOST=workflow-db.pake-umkm.app
DB_PORT=5432
DB_NAME=db_umkm_vflow
DB_USER=postgres
DB_PASSWORD=Always_Blue
```

Simpan: `Ctrl+O` → `Enter` → `Ctrl+X`

### Langkah 3.4: Buat Folder Logs
```bash
mkdir -p ~/umkm-vflow/logs
```

---

## BAGIAN 4 — Jalankan dengan PM2

### Langkah 4.1: Start Aplikasi
```bash
cd ~/umkm-vflow
pm2 start ecosystem.config.js --env production
```

### Langkah 4.2: Cek Status
```bash
pm2 status
pm2 logs umkm-vflow-backend --lines 50
```

### Langkah 4.3: Setup Auto-Start saat Reboot
```bash
# Generate startup script
pm2 startup systemd -u $USER --hp /home/$USER

# Jalankan perintah yang muncul dari output di atas (contoh):
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u debian --hp /home/debian

# Simpan konfigurasi PM2 saat ini
pm2 save
```

### Langkah 4.4: Verifikasi Server Berjalan
```bash
# Test dari dalam VM
curl http://localhost:3000/health

# Expected response:
# {"status":"OK","service":"UMKM VFlow Backend","vflow_proxy":"http://localhost:8000","timestamp":"..."}
```

---

## BAGIAN 5 — Akses dari Luar (External IP)

### Cek External IP VM
```
GCP Console → Compute Engine → VM Instances
Lihat kolom "External IP"
```

Atau dari terminal:
```bash
curl -s http://metadata.google.internal/computeMetadata/v1/instance/network-interfaces/0/access-configs/0/external-ip \
  -H "Metadata-Flavor: Google"
```

### Test dari Postman / Komputer Lokal
```bash
# Ganti EXTERNAL_IP dengan IP VM kamu
curl http://EXTERNAL_IP:3000/health

# Test endpoint dengan API Key
curl -X POST http://EXTERNAL_IP:3000/api/pesanan/buka-keranjang \
  -H "Content-Type: application/json" \
  -H "X-API-Key: UMKM_SECRET_API_KEY_2025" \
  -d '{"pelanggan_id":"b0000000-0000-0000-0000-000000000001","kasir_id":"a0000000-0000-0000-0000-000000000001"}'
```

---

## BAGIAN 6 — Update Kode (Deploy Ulang)

Setiap ada perubahan kode di repo:
```bash
cd ~/umkm-vflow

# Tarik perubahan terbaru
git pull origin main

# Install dependencies baru (jika ada)
npm install --omit=dev

# Restart aplikasi
pm2 restart umkm-vflow-backend

# Cek log setelah restart
pm2 logs umkm-vflow-backend --lines 30
```

---

## BAGIAN 7 — Monitoring & Troubleshooting

### Cek Resource (RAM & CPU)
```bash
# Ringkasan sistem
free -h
top

# PM2 monitoring real-time
pm2 monit
```

### Cek Log Aplikasi
```bash
# Log real-time
pm2 logs umkm-vflow-backend

# Log error saja
pm2 logs umkm-vflow-backend --err

# Log file langsung
tail -f ~/umkm-vflow/logs/backend-error.log
tail -f ~/umkm-vflow/logs/backend-out.log
```

### Restart / Stop / Delete
```bash
pm2 restart umkm-vflow-backend   # Restart
pm2 stop umkm-vflow-backend      # Stop
pm2 delete umkm-vflow-backend    # Hapus dari PM2
```

### Jika Port 3000 Sudah Dipakai
```bash
sudo lsof -i :3000
sudo kill -9 <PID>
```

---

## BAGIAN 8 — Tips Hemat Resource (e2-micro)

### Sesuaikan ecosystem.config.js untuk e2-micro
Edit file [`ecosystem.config.js`](../ecosystem.config.js) agar hemat RAM:

```js
// Ubah batas memory restart lebih ketat untuk e2-micro
max_memory_restart: '256M',   // Default 512M → turunkan ke 256M

// Pastikan instances tetap 1 (bukan 'max')
instances: 1,
exec_mode: 'fork',
```

### Batasi Node.js Memory
Tambahkan di `ecosystem.config.js` bagian `interpreter_args`:
```js
interpreter_args: '--max-old-space-size=256',
```

---

## ✅ Checklist Deployment

- [ ] VM e2-micro dibuat di region US (us-central1/us-west1/us-east1)
- [ ] Firewall rule port 3000 aktif
- [ ] Node.js >= 18 terinstall
- [ ] PM2 terinstall secara global
- [ ] Swap 1GB aktif dan permanen
- [ ] Repository berhasil di-clone
- [ ] File `.env` sudah dikonfigurasi
- [ ] `npm install --omit=dev` berhasil
- [ ] PM2 berhasil start aplikasi
- [ ] `pm2 startup` dan `pm2 save` dijalankan
- [ ] VFlow Server berjalan di port 8000
- [ ] `/health` endpoint merespons OK
- [ ] Test endpoint dari Postman berhasil

---

## 📌 Referensi Port yang Digunakan

| Service | Port | Akses |
|---|---|---|
| **Native Backend (Express)** | `3000` | Public (dari internet) |
| **VFlow Server** | `8000` | Internal only (localhost) |
| **PostgreSQL** | `5432` | Remote (workflow-db.pake-umkm.app) |
| **SSH** | `22` | Default GCP |
