# Dasbor

Modern server monitoring dashboard built with **Nuxt 3**, Vue 3, TailwindCSS, shadcn-nuxt, dan Dockerode.

---

## ✨ Features

### 🖥️ System Monitoring

- **Real-time metrics** via Server-Sent Events (SSE) — CPU, RAM, Disk, Network
- **Live network graph** dengan visualisasi rx/tx historical
- **Per-interface bandwidth** — setiap network interface ditampilkan dengan operstate (up/down) dan kecepatan rx/tx masing-masing
- **Real-time alerts** — notifikasi toast otomatis saat threshold terlampaui:

  | Metrik  | Warning | Critical |
  | ------- | ------- | -------- |
  | CPU     | 85%     | 95%      |
  | Memory  | 80%     | 90%      |
  | Storage | 85%     | 95%      |

  Cooldown 5 menit per alert type agar tidak spam.

### 🐳 Docker Management

- **Monitor kontainer** — status, CPU/RAM usage, uptime, network stats, image
- **Kontrol kontainer** — Start, Stop, Restart, **Pause**, **Unpause**, **Remove** (dengan konfirmasi + Force Remove jika running)
- **One-click Redeploy** — pull image terbaru dari registry + rolling update Swarm service (zero-downtime) atau restart standalone container
- **View logs** — streaming log kontainer langsung dari dashboard
- **Filter & Search** — filter berdasarkan state (All / Running / Exited / Restarting / Paused) + search by nama/image

### 🎵 Music Player

- Built-in player yang terhubung ke external Music API
- Playlist collapsible dengan search real-time
- Progress bar seekable (touch support)

---

## 🔒 Security

- **Signed HMAC token** — autentikasi Docker menggunakan token `v1.<timestamp>.<hmac-sha256>`, bukan string statis
- **Rate limiting** — login dibatasi 10 req/menit, semua `/api/docker/*` dibatasi 60 req/menit per IP (dengan `Retry-After` header)
- **Input validation** — container ID divalidasi regex hex, parameter `tail` diclamped 1–5000, filename music disanitasi via `path.basename()`

---

## 📋 Requirements

- Node.js 22+
- pnpm
- Docker (socket `/var/run/docker.sock` harus accessible)

---

## 🚀 Installation

```bash
# 1. Clone
git clone https://github.com/KukuhKKH/dasbor.git
cd dasbor

# 2. Install dependencies
pnpm install

# 3. Konfigurasi environment
cp .env.example .env
```

Edit `.env`:

```env
# Docker Security (wajib untuk kontrol kontainer)
DOCKER_CONTROL_PASSWORD=your-strong-password-here

# Music API (opsional)
MUSIC_API_BASE=https://your-music-api.example.com
MUSIC_API_PLACEHOLDER_URL=https://placehold.co/400?text=No+Cover&bg=1e293b&fg=ffffff

# Dev server (opsional)
DEV_PORT=3000
DEV_HOST=localhost
```

---

## 💻 Development

```bash
pnpm dev
```

## 🏗️ Production Build

```bash
pnpm build
node .output/server/index.mjs
```

---

## 🐳 Docker / Swarm Deploy

Image di-build otomatis via GitHub Actions dan di-push ke GHCR.

```yaml
# docker-compose.yml (contoh)
services:
  dasbor:
    image: ghcr.io/kukuhkkh/server-dashboard:latest
    environment:
      DOCKER_CONTROL_PASSWORD: "your-strong-password"
      MUSIC_API_BASE: "https://your-music-api.example.com"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - "3000:3000"
```

Untuk **Docker Swarm**, gunakan fitur Redeploy di dashboard untuk update container tanpa perlu SSH setelah image baru di-push ke registry.

---

## 📄 License

MIT
