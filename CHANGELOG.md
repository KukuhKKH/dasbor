# Changelog

All notable changes to this project will be documented in this file.

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
