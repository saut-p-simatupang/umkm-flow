# Cloudflare DNS / CNAME Setup untuk Upstream (HTTP + TCP DB)

Dokumen ini khusus untuk intern yang operasionalnya dari **client laptop** (Windows/macOS/Linux), **tanpa SSH ke server VFlow**.
Tujuannya:

- Membuat service di laptop bisa diakses oleh workflow VFlow di AWS via Cloudflare.
- Untuk HTTP gunakan protokol HTTP.
- Untuk database, tetap gunakan koneksi DB native (PostgreSQL/MySQL/Redis, dsb), **bukan diubah jadi API**.

> Catatan:
> Cloudflare Tunnel bisa publish aplikasi HTTP dan TCP.  
> Untuk koneksi TCP non-HTTP, client yang menggunakannya perlu dukungan Cloudflare tunnel di sisi client (contoh `cloudflared access tcp`) jika ingin mempertahankan protokol asli.

## 1) Konsep DNS + CNAME di Cloudflare

Saat tunnel sudah dibuat, Cloudflare membuat hostname target:

- `TUNNEL_ID.cfargotunnel.com`

Di DNS zone, buat **CNAME** masing-masing upstream:

- `workflow-http.<team>.vflow.<domain>` -> `TUNNEL_ID.cfargotunnel.com`
- `workflow-db.<team>.vflow.<domain>` -> `TUNNEL_ID.cfargotunnel.com`

Semua hostname publik mengarah ke satu tunnel yang sama; dipisah lewat konfigurasi `ingress` di `config.yml`.

## 2) Prasyarat di Laptop (per grup intern)

- Domain sudah dikelola di Cloudflare.
- Bisa mengedit DNS CNAME di zone domain.
- Bisa install dan jalankan `cloudflared` di laptop.
- Port layanan lokal siap dipakai (mis. `127.0.0.1:8080` untuk HTTP, `127.0.0.1:5432` untuk PostgreSQL).

## 3) Buat Tunnel dan route DNS

### 3.1 Login dan buat tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create vflow-group-<id>
```

Catat:

- `TUNNEL_ID` (uuid tunnel)
- file credential: `~/.cloudflared/<TUNNEL_ID>.json`

### 3.2 Buat DNS CNAME via dashboard/CLI

Lewat CLI:

```bash
cloudflared tunnel route dns vflow-group-<id> workflow-http.<team>.vflow.<domain>
cloudflared tunnel route dns vflow-group-<id> workflow-db.<team>.vflow.<domain>
```

Lewat dashboard Cloudflare:

- Add record type **CNAME**
- **Name**: `workflow-http.<team>.vflow.<domain>`
- **Target**: `<TUNNEL_ID>.cfargotunnel.com`
- Repeat untuk hostname DB.

### 3.3 Konfigurasi service ke origin lokal

Buat file `~/.cloudflared/vflow-group-<id>.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/<user>/.cloudflared/<TUNNEL_ID>.json

ingress:
  # HTTP upstream (contoh simulasi API)
  - hostname: workflow-http.<team>.vflow.<domain>
    service: http://127.0.0.1:8080

  # TCP upstream (contoh PostgreSQL)
  - hostname: workflow-db.<team>.vflow.<domain>
    service: tcp://127.0.0.1:5432

  # fallback
  - service: http_status:404
```

Jalankan tunnel:

```bash
cloudflared tunnel --config ~/.cloudflared/vflow-group-<id>.yml run vflow-group-<id>
```

## 4) Pengujian dari client

### 4.1 Test HTTP upstream

```bash
curl -sS https://workflow-http.<team>.vflow.<domain>/health
```

Harus balikin `200` dan body sesuai aplikasi.

### 4.2 Test TCP DB upstream (raw protocol)

Untuk test manual dari terminal yang sama:

```bash
cloudflared access tcp --hostname workflow-db.<team>.vflow.<domain> --url localhost:6543
```

Lalu pada terminal lain:

```bash
PGPASSWORD=... psql "postgresql://user:pass@127.0.0.1:6543/dbname" -c "select 1;"
```

> Jika runtime VFlow (di AWS) yang harus menjembatani koneksi TCP, maka pada host tersebut harus ada mekanisme client-side tunnel sesuai kebijakan tim (contoh `cloudflared access tcp`) karena protocol TCP publik dari Cloudflare biasanya tetap diproses sebagai koneksi TCP-over-tunnel.

## 5) Pakai di workflow (contoh)

### HTTP

Di workflow/vrule, pakai endpoint HTTPS publik:

```yaml
base_url: "https://workflow-http.<team>.vflow.<domain>"
```

### Database

Pertahankan native DSN. Pada environment yang sudah ada forwarding local:

```yaml
dsn: "postgresql://vflow_user:secret@127.0.0.1:6543/vflow_db"
```

> Jika DB tidak bisa di-forward di host runtime, jangan pakai API wrapper sebagai pengganti. Gunakan opsi networking lain (VPN/WireGuard/SSH reverse) agar DB protocol tetap identik dengan production.

## 6) Checklist hasil akhir (siap copas untuk intern)

- `cloudflared tunnel list` menampilkan tunnel `vflow-group-<id>`.
- CNAME `workflow-http...` dan `workflow-db...` ada di zone Cloudflare.
- HTTP test `curl` sukses (`200`) dan body normal.
- `nc -vz workflow-db... 443` dari client bisa terhubung (opsional, health check TCP).
- Workflow test `workflows list` / `trigger` di VFlow jalan tanpa error connector.
- Tidak ada SSH ke server VFlow sebagai syarat setup ini.
- Untuk DB, koneksi di workflow tetap DB protocol, bukan API rewrite.
