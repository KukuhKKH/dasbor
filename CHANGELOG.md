# Changelog

All notable changes to this project will be documented in this file.

---

## [1.5.0] — 2026-02-21

### 🔒 Security

#### `server/utils/docker-auth.ts` _(baru)_

- **Signed HMAC token** — Cookie `docker_auth_token` tidak lagi berisi string statis `"valid"`. Diganti dengan token format `v1.<timestamp>.<hmac-sha256>` yang di-sign menggunakan password sebagai secret. Verifikasi menggunakan `timingSafeEqual` untuk mencegah timing attack.

#### `server/utils/rate-limit.ts`

- **Rate limiter dengan factory function** — Refactor `checkRateLimit` menjadi `createRateLimiter(limit, windowMs)` yang membuat store independen per use case. Tambah `retryAfterMs()` helper.

#### `server/middleware/docker-rate-limit.ts` _(baru)_

- **Global rate limiting middleware** — Semua request ke `/api/docker/**` dibatasi 60 req/menit per IP. Response menyertakan header `Retry-After`, `X-RateLimit-Limit`, dan `X-RateLimit-Reset`.

#### `server/api/docker/auth.post.ts`

- **Rate limiting login** — Endpoint auth dibatasi 10 request/menit per IP untuk mencegah brute-force.
- **`sameSite: 'strict'`** — Cookie auth ditambah atribut `sameSite: 'strict'`.
- **Password via `runtimeConfig`** — `DOCKER_CONTROL_PASSWORD` kini diregistrasi ke Nuxt `runtimeConfig` (sebelumnya dibaca langsung dari `process.env`).

#### `server/api/docker/[id]/[action].post.ts`

- **Validasi container ID** — ID harus berupa hex 12–64 karakter (`/^[a-f0-9]{12,64}$/i`). Request dengan ID tidak valid langsung ditolak 400.
- **Whitelist aksi via `Set`** — Hanya aksi yang terdaftar di `ALLOWED_ACTIONS` yang diterima.

#### `server/api/docker/[id]/logs.get.ts`

- **Validasi container ID** — Sama seperti action endpoint.
- **Clamp parameter `tail`** — Nilai `tail` dibatasi antara 1–5000 (sebelumnya tidak ada batas, bisa menyebabkan OOM).

#### `server/api/music/cover.get.ts` & `stream.get.ts`

- **Sanitasi filename via `path.basename()`** — Pengecekan `includes('..')` yang tidak lengkap diganti dengan `path.basename()` untuk mencegah semua variasi path traversal.

#### `nuxt.config.ts`

- **`dockerControlPassword` di `runtimeConfig`** — Secret dikelola konsisten oleh Nuxt, tidak lagi dibaca langsung dari `process.env` di handler.

#### `app/components/DockerAuthModal.vue`

- **Fix: Auth modal muncul kembali setelah login** — `useCookie` ref tidak otomatis update saat server set cookie via `Set-Cookie` header. Kini setelah login sukses, cookie ref di-update secara eksplisit di client sehingga state langsung sinkron tanpa perlu refresh.

---

### ✨ Features

#### `server/api/docker/[id]/[action].post.ts`

- **Pause & Unpause** — Container yang sedang berjalan dapat di-pause (suspended tanpa dihentikan). State `paused` terdeteksi sebelum aksi dieksekusi.
- **Remove** — Container dapat dihapus. Jika container sedang berjalan, wajib menyertakan `?force=true`. State divalidasi via `container.inspect()` sebelum eksekusi.

#### `server/api/docker/[id]/redeploy.post.ts` _(baru)_

- **One-click Redeploy** — Pull image terbaru dari registry, lalu:
  - **Docker Swarm service** (terdeteksi dari label `com.docker.swarm.service.id`): force update service via `service.update()` dengan increment `ForceUpdate` counter → rolling update zero-downtime.
  - **Standalone container**: restart container dengan image baru.

#### `server/utils/stats-cache.ts`

- **Alert System** — `_checkAlerts()` memeriksa threshold CPU (warning 85% / critical 95%), Memory (80% / 90%), Storage (85% / 95%). Alert di-emit sebagai event tersendiri (`'alert'`) dengan cooldown 5 menit per tipe agar tidak spam.
- **Per-interface network data** — `SystemStats` kini menyertakan field `interfaces[]` dengan `iface`, `rx_sec`, `tx_sec`, `operstate` untuk setiap interface aktif (non-loopback).

#### `server/api/stats/stream.get.ts`

- **Typed SSE events** — Event stream kini menggunakan named event types: `event: stats` untuk data sistem dan `event: alert` untuk notifikasi threshold.

#### `app/composables/useSystemStats.ts`

- **Alert toast** — `addEventListener('alert')` menangkap alert dari SSE dan menampilkan toast via `vue-sonner`: warning (kuning, 7 detik) dan critical (merah, 10 detik).

#### `app/components/dasboard/DockerHealth.vue`

- **Filter chip "Paused"** — Filter state baru dengan warna kuning untuk container yang di-pause.
- **Menu Pause/Unpause** — Item menu kondisional: Pause muncul saat container `running`, Unpause muncul saat `paused`.
- **Menu Remove** — Item menu merah dengan `AlertDialog` konfirmasi. Jika container running, tombol berubah menjadi "Force Remove" dengan warning kuning.
- **Menu Redeploy** — Item menu biru dengan badge "Swarm" atau "Restart" tergantung tipe container. Spinner animasi saat proses pull berlangsung. Disabled saat redeploy berjalan.

#### `server/plugins/stats-poller.ts`

- **Collect semua network interface** — Semua interface aktif (bukan loopback) dikumpulkan dengan `operstate` masing-masing.

#### `app/components/dasboard/SystemResource.vue`

- **Per-interface bandwidth breakdown** — Di bawah grafik network, ditampilkan daftar per interface dengan nama, badge operstate (up/down), rx/s, dan tx/s. Hanya muncul jika ada lebih dari 1 interface aktif.

---

### 🔧 CI/CD

#### `.github/workflows/build-image.yml`

- **`--frozen-lockfile`** — Ganti `--no-frozen-lockfile` agar build reproducible dan versi dependency tidak berubah antar run.

#### `.gitlab-ci/build/Dockerfile`

- **Hapus `npm install -g npm@11.9.0`** — Versi npm hardcoded dihapus, menggunakan npm yang sudah tersedia di base image `node:22-alpine`.

---

## [1.4.1] — 2026-02-20

### 📱 Mobile UX

#### `app/components/dasboard/MiniPlayer.vue`

- **Touch seek progress bar** — Tambah handler `touchmove` + `touchend` pada progress bar. `touch-action: none` diterapkan agar browser tidak menginterupsi gesture sebagai scroll halaman. Progress bar kini bisa di-drag dengan jari secara real-time.
- **Knob indikator posisi** — Elemen bulat muncul saat hover/aktif untuk menunjukkan posisi yang bisa diinteraksi.
- **Volume control di mobile** — Row volume (`Slider`) kini muncul khusus di bawah progress bar pada layar `< sm`, menggantikan kontrol yang sebelumnya tersembunyi sepenuhnya (`hidden sm:flex`).
- **Touch target standar** — Tombol skip diberi `min-h/w-[44px]`, tombol play diperbesar ke `size-14`, item playlist `min-h-[44px]` — memenuhi standar Apple HIG & Google Material 44px minimum.
- **Playlist height adaptif** — Dari `max-h-[240px]` fixed → `max-h-[40dvh]` dinamis terhadap tinggi layar, aman saat keyboard mobile muncul.

#### `app/components/dasboard/DockerHealth.vue`

- **Filter chip scroll horizontal** — Tambah `overflow-x-auto` + `shrink-0` agar chip tidak meluber di layar sempit, bisa di-scroll secara horizontal.
- **Actions button diperbesar** — Dari `h-6 w-6` (24px) → `h-9 w-9` (36px), lebih mudah dipencet dengan jari.
- **Dropdown menu item touch target** — Tambah `py-2.5` eksplisit pada setiap `DropdownMenuItem`.
- **TransitionGroup animasi** — Daftar container animasi fade + slide saat filter atau search berubah, menghilangkan efek "jentit" tiba-tiba.
- **Progress bar lebih tebal** — `h-1` → `h-1.5` agar lebih mudah terlihat di layar kecil.

#### `app/components/dasboard/ServerMonitor.vue`

- **Tombol "Sync Now" touch target** — Tambah `min-h-[44px]` agar memenuhi standar minimum touch target.
- **Responsive font stats** — `text-2xl` → `text-xl md:text-2xl` agar tidak terlalu besar saat 4 stat stacked 1 kolom di mobile portrait.

---

## [1.4.0] — 2026-02-20

### ✨ Features

#### `app/components/dasboard/MiniPlayer.vue` — Playlist Management

- **Panel playlist collapsible** — Tombol `i-lucide-list-music` di header membuka/menutup panel dengan animasi `Transition` (max-height + opacity). Badge merah menampilkan total jumlah lagu.
- **Search lagu** — Input search real-time memfilter daftar berdasarkan judul atau nama artist.
- **Klik langsung untuk putar** — Setiap baris lagu dapat diklik untuk langsung mengganti dan memutar lagu tersebut.
- **Highlight lagu aktif** — Border kiri berwarna primary + teks biru pada lagu yang sedang diputar.
- **Equalizer animasi** — Tiga bar animating bounce saat lagu diputar; diam saat pause.
- **Nomor track & durasi** — Tiap item menampilkan nomor urut dan durasi lagu (dari field `duration` API).
- **Counter posisi** — Footer panel menampilkan posisi lagu aktif dalam format `#2 / 12`.

#### `app/components/dasboard/DockerHealth.vue` — Search & Filter Container

- **Search real-time** — Input memfilter daftar container berdasarkan nama atau image secara instan.
- **Filter chip by state** — 4 chip: All / Running / Exited / Restarting. Search dan filter dapat dikombinasikan.
- **Badge count** — Setiap chip menampilkan jumlah container dengan state tersebut.
- **Empty state saat hasil kosong** — Tampilan khusus "Tidak ada hasil" dengan tombol Reset filter.
- **Info bar saat filter aktif** — Teks "Menampilkan X dari Y container" + tombol Reset kecil muncul saat filter aktif.

---

## [1.3.1] — 2026-02-20

### 🐛 Bug Fixes

#### `app/components/dasboard/DockerHealth.vue`

- **Fix: Type-safe `PendingAction`** — Sebelumnya, aksi "lihat log" dibedakan dari aksi kontainer biasa dengan cara meng-_encode_ nama kontainer ke dalam string action (`'view_logs:namaContainer'`), lalu men-_decode_-nya menggunakan `split(':')[1]`. Pendekatan ini rentan _bug_ jika nama kontainer mengandung karakter titik dua (`:`). Diganti dengan union type yang terstruktur:
  ```ts
  type PendingAction =
    | { type: "action"; id: string; action: string }
    | { type: "logs"; id: string; name: string };
  ```

#### `app/components/dasboard/MiniPlayer.vue`

- **Fix: `togglePlay` async/await** — Sebelumnya, state `isPlaying` dibalik secara langsung (`isPlaying.value = !isPlaying.value`) tanpa menunggu hasil dari `.play()`. Jika _browser_ memblokir _autoplay_ atau audio belum siap, state akan tidak sinkron dengan kondisi audio sesungguhnya. Kini menggunakan `async/await` sehingga state hanya diubah setelah operasi berhasil atau gagal.

- **Fix: Race condition pada `nextSong`/`prevSong`** — Sebelumnya menggunakan `setTimeout(..., 100)` sebagai cara untuk menunggu Vue me-_render_ ulang atribut `src` audio sebelum memanggil `.play()`. Angka 100ms adalah _magic number_ yang tidak deterministik. Diganti dengan event `@canplay` pada elemen `<audio>`, yang dipicu secara otomatis oleh _browser_ ketika audio sudah siap diputar.

#### `app/composables/useSystemStats.ts`

- **Fix: SSE reconnect loop tak terbatas** — `eventSource.onerror` sebelumnya langsung memanggil `setTimeout(connectSSE, 5000)` tanpa batas. Jika server mati permanen, proses ini akan terus berjalan selamanya. Kini diterapkan _exponential backoff_ dengan batas maksimum retry.

---

### ⚡ Performance

#### `server/api/docker/containers.get.ts`

- **Perf: Batasi konkurensi Docker socket calls** — Endpoint ini sebelumnya menggunakan `Promise.all()` tanpa batasan, yang berarti jika ada 50+ kontainer, akan ada 50+ koneksi ke Docker socket dibuka secara bersamaan. Kini dibatasi menggunakan [`p-limit`](https://github.com/sindresorhus/p-limit) dengan konkuren maksimal **5** permintaan pada satu waktu.
  ```ts
  const limit = pLimit(5);
  ```

#### `app/components/dasboard/SystemResource.vue`

- **Perf: Ganti `Math.max(...spread)` dengan `reduce()`** — Penggunaan spread operator pada `Math.max(...array)` memiliki risiko _stack overflow_ jika array sangat besar, karena semua elemen diteruskan sebagai argumen fungsi. Diganti dengan `Array.prototype.reduce()` yang aman untuk array berukuran berapapun.

  ```ts
  // Sebelum (tidak aman untuk array besar)
  const maxVal = Math.max(
    ...history.value.map((v) => v.network[dataKey]),
    1024 * 10,
  );

  // Sesudah
  const maxVal = history.value.reduce(
    (max: number, v: StatsHistory) => Math.max(max, v.network[dataKey]),
    1024 * 10,
  );
  ```

---

### ♻️ Refactor

#### `app/pages/index.vue`

- **Refactor: Hapus wrapper `<div>` redundant** — Terdapat dua elemen dengan tujuan yang sama (`w-full flex flex-col gap-4`). `<div>` pembungkus luar digabungkan langsung ke elemen `<main>`.

#### `app/components/dasboard/DockerHealth.vue`

- **Refactor: Merge `getStateColor` & `getStateRingColor`** — Dua fungsi `switch` yang memetakan `state → warna dot` dan `state → warna ring` digabung menjadi satu objek _lookup table_:

  ```ts
  const STATE_STYLES: Record<string, { dot: string; ring: string }> = {
    running: { dot: "bg-emerald-500", ring: "ring-emerald-500/30" },
    exited: { dot: "bg-slate-500", ring: "ring-slate-500/30" },
    restarting: { dot: "bg-amber-500", ring: "ring-amber-500/30" },
  };
  ```

- **Refactor: Hapus `immediateCallback: true` pada interval** — `useFetch` sudah otomatis melakukan _fetch_ saat komponen di-_mount_. Opsi `immediateCallback: true` menyebabkan `refresh()` dipanggil dua kali saat inisialisasi.

#### `app/components/dasboard/MiniPlayer.vue`

- **Refactor: `nextSong` + `prevSong` → `skipTo(direction)`** — Kedua fungsi hampir identik (~90% duplikasi). Digabung menjadi satu fungsi `skipTo(direction: 1 | -1)` yang menerima arah navigasi sebagai argumen.

  ```ts
  // Sebelum: dua fungsi terpisah
  function nextSong() { ... }
  function prevSong() { ... }

  // Sesudah: satu fungsi
  function skipTo(direction: 1 | -1) { ... }
  ```

- **Refactor: Hapus duplikasi volume handler** — Terdapat dua mekanisme untuk mengatur volume secara bersamaan: event handler `onVolumeChange` dan `watch(volume, ...)`. Keduanya melakukan hal yang sama. Event handler dihapus, cukup menggunakan watcher saja.

#### `app/composables/useSystemStats.ts`

- **Refactor: Exponential backoff SSE reconnect** — Implementasi retry kini menggunakan strategi _exponential backoff_: delay dimulai dari 1 detik dan berlipat ganda setiap kali gagal, dengan batas maksimum 30 detik. Retry berhenti total setelah **10 kali** kegagalan dan status diubah menjadi `'offline'`. Retry counter direset ke nol saat koneksi berhasil.

  | Attempt | Delay           |
  | ------- | --------------- |
  | 1       | 1 detik         |
  | 2       | 2 detik         |
  | 3       | 4 detik         |
  | 4       | 8 detik         |
  | 5       | 16 detik        |
  | 6+      | 30 detik (maks) |

- **Refactor: Bersihkan `retryTimeout` saat `onUnmounted`** — Sebelumnya, jika komponen di-_unmount_ saat sedang menunggu retry, timer `setTimeout` akan tetap berjalan dan memicu reconnect ke komponen yang sudah tidak ada. Kini `retryTimeout` dibersihkan di `onUnmounted`.

#### `server/api/docker/containers.get.ts`

- **Refactor: Pisah `processContainer()` ke fungsi terpisah** — Logika pemrosesan per kontainer dipindahkan dari anonymous callback di dalam `Promise.all()` ke fungsi bernama `processContainer(c, hostUptimeSec)`. Kode menjadi lebih mudah dibaca dan lebih mudah di-_test_ secara terpisah.

---

### 📦 Dependencies

- **Added:** `p-limit@7.3.0` — Utility untuk membatasi jumlah _concurrent_ operasi asinkronus.

---

## [1.3.0] — sebelum 2026-02-20

Versi sebelum sesi code review dan perbaikan. Fitur dashboard berjalan dengan:

- `DockerHealth.vue` — monitoring status dan statistik kontainer Docker secara _real-time_
- `MiniPlayer.vue` — pemutar audio terintegrasi dengan dukungan _playlist_
- `ServerMonitor.vue` — tampilan metrik infrastruktur dan jaringan
- `SystemResource.vue` — monitor CPU, RAM, storage, dan grafik network _live_ via SSE
- `containers.get.ts` — endpoint API untuk mengambil data kontainer Docker beserta statistiknya
- `useSystemStats.ts` — composable SSE untuk streaming data sistem secara _real-time_
