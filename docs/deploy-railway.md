# 🚂 Panduan Deploy ke Railway (Gratis, Tanpa VM)
## UMKM VFlow Backend | Kelompok 3

> **Railway** adalah platform hosting gratis untuk backend Node.js.
> Cukup push ke GitHub → Railway otomatis build & jalankan server.
> **Tidak perlu terminal Linux, tidak perlu VM, tidak perlu install apapun.**

---

## ✅ Prasyarat

- [ ] Punya akun **GitHub** (gratis)
- [ ] Punya akun **Railway** (gratis, daftar via GitHub di https://railway.app)
- [ ] Kode sudah di-push ke repository GitHub

---

## BAGIAN 1 — Push Kode ke GitHub

### Langkah 1.1: Buat Repository di GitHub
1. Buka https://github.com/new
2. Nama repo: `umkm-vflow`
3. Pilih **Private** (agar API key tidak terekspos)
4. Klik **Create repository**

### Langkah 1.2: Push dari Komputer Lokal (PowerShell)
Buka PowerShell di folder proyek:

```powershell
# Masuk ke folder proyek
cd "d:\Repo (Vastar)\umkm-vflow"

# Inisialisasi git (jika belum)
git init

# Tambahkan remote GitHub (ganti USERNAME dengan username kamu)
git remote add origin https://github.com/USERNAME/umkm-vflow.git

# Tambahkan semua file (kecuali yang ada di .gitignore)
git add .

# Commit pertama
git commit -m "Initial commit: UMKM VFlow Backend"

# Push ke GitHub
git push -u origin main
```

> ⚠️ File `.env` **TIDAK** akan ikut ter-push karena sudah ada di `.gitignore`. Itu sudah benar — kita akan set variabel env langsung di Railway nanti.

---

## BAGIAN 2 — Deploy di Railway

### Langkah 2.1: Daftar / Login Railway
1. Buka https://railway.app
2. Klik **Login with GitHub**
3. Authorize Railway ke akun GitHub kamu

### Langkah 2.2: Buat Project Baru
1. Klik **New Project**
2. Pilih **Deploy from GitHub repo**
3. Pilih repository `umkm-vflow`
4. Railway akan langsung mendeteksi ini adalah project Node.js

### Langkah 2.3: Set Environment Variables
Sebelum deploy, masukkan variabel environment:

1. Klik service yang baru dibuat
2. Klik tab **Variables**
3. Klik **New Variable** dan tambahkan satu per satu:

| KEY | VALUE |
|---|---|
| `NODE_ENV` | `production` |
| `API_KEY` | `UMKM_SECRET_API_KEY_2025` |
| `VFLOW_BASE_URL` | `http://URL_VFLOW_SERVER_KAMU:8000` |
| `DB_HOST` | `workflow-db.pake-umkm.app` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `db_umkm_vflow` |
| `DB_USER` | `postgres` |
| `DB_PASSWORD` | `Always_Blue` |

> ⚠️ **Catatan PORT:** Railway otomatis menginject variabel `PORT` — **jangan** tambahkan `PORT` manual. `server.js` sudah membaca `process.env.PORT` dengan benar.

> ⚠️ **VFLOW_BASE_URL:** Isi dengan URL server VFlow kamu. Jika VFlow Server juga di deploy di Railway sebagai service terpisah, Railway akan kasih URL internal-nya.

### Langkah 2.4: Trigger Deploy
Setelah variabel diisi:
1. Klik tab **Deployments**
2. Railway akan otomatis deploy
3. Tunggu hingga status berubah menjadi ✅ **Success**

### Langkah 2.5: Dapatkan URL Publik
1. Klik tab **Settings**
2. Di bagian **Networking**, klik **Generate Domain**
3. Railway akan memberi URL seperti: `umkm-vflow-production.up.railway.app`

---

## BAGIAN 3 — Test Endpoint

Ganti `YOUR_RAILWAY_URL` dengan URL yang didapat dari Railway:

### Health Check
```bash
curl https://YOUR_RAILWAY_URL.up.railway.app/health
```

Expected response:
```json
{
  "status": "OK",
  "service": "UMKM VFlow Backend",
  "vflow_proxy": "http://...",
  "timestamp": "2025-..."
}
```

### Test Buka Keranjang (di Postman)
```
POST https://YOUR_RAILWAY_URL.up.railway.app/api/pesanan/buka-keranjang
Headers:
  Content-Type: application/json
  X-API-Key: UMKM_SECRET_API_KEY_2025

Body:
{
  "pelanggan_id": "b0000000-0000-0000-0000-000000000001",
  "kasir_id": "a0000000-0000-0000-0000-000000000001"
}
```

---

## BAGIAN 4 — Update Kode (Deploy Ulang)

Railway otomatis re-deploy setiap kali ada push ke GitHub:

```powershell
# Edit kode...

# Push ke GitHub
git add .
git commit -m "Update: deskripsi perubahan"
git push

# Railway otomatis detect push dan mulai build + deploy baru
```

Cek progress di Railway dashboard tab **Deployments**.

---

## BAGIAN 5 — Lihat Log di Railway

1. Buka dashboard Railway
2. Klik service kamu
3. Klik tab **Logs**
4. Log real-time akan muncul di sana

---

## ⚡ Batas Free Tier Railway

| Resource | Batas Gratis |
|---|---|
| **Execution hours** | 500 jam/bulan |
| **RAM** | 512 MB |
| **Storage** | 1 GB |
| **Bandwidth** | 100 GB/bulan |
| **Sleep** | ❌ Tidak tidur (selalu online) |
| **Custom Domain** | ✅ Bisa |

> 500 jam / bulan ÷ 24 jam = **~20 hari runtime**. Untuk proyek tugas/demo, ini cukup. Kalau butuh full 30 hari, upgrade ke Pro ($5/bulan) atau pakai Koyeb yang truly gratis.

---

## ✅ Checklist Deploy Railway

- [ ] Repository sudah di-push ke GitHub
- [ ] `.env` **tidak** ikut ter-push (ada di `.gitignore`)
- [ ] Login Railway dengan GitHub
- [ ] New Project → Deploy from GitHub repo → pilih `umkm-vflow`
- [ ] Semua environment variable sudah diisi di Railway
- [ ] Deployment status ✅ Success
- [ ] Generate Domain → dapat URL publik
- [ ] `/health` endpoint merespons OK
- [ ] Test endpoint dari Postman berhasil
