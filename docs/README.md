# AWS Test VFlow Client (Client-Only)

Folder ini hanya dipakai sebagai **klien lokal** untuk operasional VFlow di AWS.
Tidak ada konfigurasi deploy server di sini.

Lokasi deploy server ada di:

- `/home/abraham/magang/vflow-server-artifact/`

## Isi folder ini

- `scripts/vflow-admin.js` – script utama untuk manajemen workflow/vrule.
- `scripts/vflow-admin.sh` – runner Linux/macOS.
- `scripts/vflow-admin.ps1` – runner Windows PowerShell.
- `scripts/vflow-admin.bat` – runner Windows CMD.
- `provision-pattern/` – kumpulan `workflow.yaml` contoh.
- `vflow-authoring-guide/`, `vrule-authoring-guide/` – bahan belajar.
- `bin/` – binary client pendukung.

## Prinsip penting

- **Tidak perlu SSH ke server untuk operasi normal**.
- Endpoint yang dipakai sebaiknya **public IP** (lebih stabil untuk restart server dibanding DNS host).
- Jika public IP berubah setelah stop/start, ganti `VFLOW_BASE_URL` ke IP terbaru di mesin magang.
- Endpoint per kelompok (pakai public IP + port):

| Kelompok   | Endpoint URL |
|------------|--------------|
| kelompok_1 | `http://54.227.1.76:7799` |
| kelompok_2 | `http://18.234.84.59:7799` |
| kelompok_3 | `http://3.84.212.7:7799` |

Template cepat pakai kelompok:

```bash
export VFLOW_BASE_URL="http://54.227.1.76:7799"   # kelompok_1
export VFLOW_BASE_URL="http://18.234.84.59:7799"  # kelompok_2
export VFLOW_BASE_URL="http://3.84.212.7:7799"    # kelompok_3
```
- Semua perintah dijalankan dari mesin magang (Windows / macOS / Linux).
- Jangan letakkan SSH key di folder ini.

## Setting awal

```bash
cd /home/abraham/magang/aws-test-vflow

# arahkan endpoint
# default (kelompok_3)
export VFLOW_BASE_URL="http://3.84.212.7:7799"
# jika pakai instance lain, ganti ini
# export VFLOW_BASE_URL="http://54.227.1.76:7799"   # kelompok_1
# export VFLOW_BASE_URL="http://18.234.84.59:7799"  # kelompok_2
```

Untuk Windows PowerShell:

```powershell
Set-Location "C:\path\to\aws-test-vflow"
$env:VFLOW_BASE_URL = "http://3.84.212.7:7799"  # kelompok_3
# jika pakai instance lain:
# $env:VFLOW_BASE_URL = "http://54.227.1.76:7799"   # kelompok_1
# $env:VFLOW_BASE_URL = "http://18.234.84.59:7799"  # kelompok_2
```

## 1) Verifikasi koneksi awal

```bash
./scripts/vflow-admin.sh status
```

Atau langsung pakai curl:

```bash
curl -sS "$VFLOW_BASE_URL/health"
curl -sS "$VFLOW_BASE_URL/_vflow/api/overview"
```

## 2) Workflow: list / provision / unprovision

### Linux/macOS

```bash
./scripts/vflow-admin.sh workflows list
./scripts/vflow-admin.sh workflows provision ./provision-pattern/013-grpc-trigger/workflow.yaml
./scripts/vflow-admin.sh workflows unprovision wf_a94e69aa
./scripts/vflow-admin.sh workflows list
```

### Windows PowerShell

```powershell
scripts\vflow-admin.ps1 workflows list
scripts\vflow-admin.ps1 workflows provision .\provision-pattern\013-grpc-trigger\workflow.yaml
scripts\vflow-admin.ps1 workflows unprovision wf_a94e69aa
scripts\vflow-admin.ps1 workflows list
```

### Windows CMD

```bat
scripts\vflow-admin.bat workflows list
scripts\vflow-admin.bat workflows provision provision-pattern\013-grpc-trigger\workflow.yaml
scripts\vflow-admin.bat workflows unprovision wf_a94e69aa
scripts\vflow-admin.bat workflows list
```

### Catatan placeholder

`<folder>`, `<workflow_id>`, `<rule_set_id>` adalah **nilai nyata yang harus diganti**.
Contoh:

- `workflow.yaml` gunakan path yang ada di `provision-pattern/*/workflow.yaml`
- `workflow_id` ambil dari hasil `workflows list`
- `rule_set_id` ambil dari `rules list`

## 3) Rule: list / remove

```bash
./scripts/vflow-admin.sh rules list
./scripts/vflow-admin.sh rules remove rule_set_id_yang_sudah_ada
./scripts/vflow-admin.sh rules list
```

Untuk test lifecycle lengkap, unggah VRule pack lewat endpoint compile sebelum remove:

```bash
jq -n \
  --rawfile r ./provision-pattern/047-fastpath-vrule-risk-scoring/rules/fastpath_risk_v1.vdicl \
  --rawfile s ./provision-pattern/047-fastpath-vrule-risk-scoring/schemas/fastpath_risk_fact_v1.yaml \
  '{rule_set_id:"fastpath_risk_v1", rules_yaml:$r, schema_yaml:$s}' \
  | curl -sS -X POST \
      -H 'Content-Type: application/json' \
      -d @- \
      "$VFLOW_BASE_URL/api/admin/vrule/compile"

./scripts/vflow-admin.sh rules list
./scripts/vflow-admin.sh rules remove fastpath_risk_v1
./scripts/vflow-admin.sh rules list
```

## Operasi via curl (alternatif cepat)

```bash
VFLOW_URL=$VFLOW_BASE_URL

curl -sS "$VFLOW_URL/health"

curl -sS "$VFLOW_URL/_vflow/api/workflows?tenant=_default"

curl -sS -X POST \
  -H "Content-Type: application/yaml" \
  -H "X-Tenant-Id: _default" \
  --data-binary @./provision-pattern/013-grpc-trigger/workflow.yaml \
  "$VFLOW_URL/api/admin/workflow/upload"

curl -sS -X DELETE "$VFLOW_URL/_vflow/api/workflows/wf_id_contoh?tenant=_default"

curl -sS "$VFLOW_URL/api/admin/vrules"

jq -n \
  --rawfile r ./provision-pattern/047-fastpath-vrule-risk-scoring/rules/fastpath_risk_v1.vdicl \
  --rawfile s ./provision-pattern/047-fastpath-vrule-risk-scoring/schemas/fastpath_risk_fact_v1.yaml \
  '{rule_set_id:"fastpath_risk_v1", rules_yaml:$r, schema_yaml:$s}' \
  | curl -sS -X POST \
      -H 'Content-Type: application/json' \
      -d @- \
      "$VFLOW_URL/api/admin/vrule/compile"

curl -sS -X DELETE \
  -H "Content-Type: application/json" \
  -d '{"rule_set_id":"rule_set_id_contoh"}' \
  "$VFLOW_URL/api/admin/vrule"
```

## Troubleshooting cepat

- Timeout: cek jaringan/internet atau security group AWS port 7799.
- `HTTP 404` dari `remove`: ID yang dipakai tidak ada/sudah dihapus.
- Koneksi sukses tapi respons aneh: pastikan tenant `VFLOW_TENANT` sesuai (`_default` default).

## Cek hasil yang diharapkan (template output)

Gunakan ini untuk cek cepat apakah command benar.

### 1) `status`

Output sukses:

```json
{
  "status": "healthy",
  "service": "vil-server"
}
```

Dan overview:

```json
{
  "status": "healthy",
  "engine": "vflow",
  "workflow_count": 1,
  "route_count": 1
}
```

### 2) `workflows list`

Output sukses (contoh):

```json
{
  "count": 1,
  "workflows": [
    {
      "id": "wf_6a58cbe9",
      "tenant_id": "_default",
      "version": 1,
      "active": true
    }
  ]
}
```

Output gagal karena path/target salah (umumnya bukan dari command ini, tapi koneksi):

```text
Error: request timeout ...
```

atau

```text
Error: ... HTTP 4xx/5xx
```

### 3) `workflows provision <path>`

Output sukses:

```json
{
  "id": "wf_xxxxxxxx",
  "tenant_id": "_default",
  "version": 1,
  "active": true,
  "provisioning_mode": "versioned"
}
```

Output gagal umum:

```text
Error: unknown field ...
```

atau

```text
Error: ENOENT: no such file .../workflow.yaml
```

### 4) `workflows unprovision <workflow_id>`

Output sukses:

```text
<div class="notice"><strong>Workflow unprovisioned</strong>... {
  "unprovisioned": "wf_xxxxxxxx",
  "tenant_id": "_default",
  "unregistered_routes": [...]
}</div>
```

Output gagal (ID tidak ada):

```text
Error: DELETE ... HTTP 404
{
  "error": "workflow 'wf_xxx' not found"
}
```

### 5) `rules list`

Output saat kosong:

```json
{
  "count": 0,
  "vrules": []
}
```

### 6) `rules remove <rule_set_id>`

Output sukses:

```json
{
  "removed": "rule_set_id_anda"
}
```

Output gagal (ID tidak ada):

```text
Error: DELETE ... HTTP 404
{
  "error": "vrule 'rule_set_id' not found"
}
```

Checklist cepat sebelum selesai:

- `workflows list` harus memperlihatkan workflow yang baru ditambah.
- `workflows unprovision` mengembalikan `unprovisioned`.
- `rules list` menurun/bertambah sesuai aksi `rules remove`.
- Status/overview selalu `healthy`.

### 7) Template hasil `rules lifecycle`

Saat mulai:

```json
{
  "count": 0,
  "vrules": []
}
```

Compile sukses:

```json
{
  "rule_set_id": "fastpath_risk_v1",
  "pack_size": 2848,
  "loaded_at": 173...
}
```

List sesudah compile:

```json
{
  "count": 1,
  "vrules": [
    {
      "id": "fastpath_risk_v1",
      "loaded_at": 173..., 
      "size_bytes": 2848
    }
  ]
}
```

Hapus:

```json
{
  "removed": "fastpath_risk_v1"
}

{
  "count": 0,
  "vrules": []
}
```

Untuk detail troubleshooting lanjutan dan endpoint lain, cek README di:

- `/home/abraham/magang/vflow-server-artifact/README.md`
- Untuk setup upstream lewat Cloudflare (DNS + CNAME) untuk HTTP dan TCP DB, lihat:
- `./CLOUDFLARE_UPSTREAM_SETUP.md`
