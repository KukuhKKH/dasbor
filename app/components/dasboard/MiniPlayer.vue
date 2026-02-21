<script setup lang="ts">
import { Slider } from "@/components/ui/slider";

interface Song {
  filename: string;
  title: string;
  artist: string;
  streamUrl: string;
  coverUrl: string;
  duration?: number;
}

// Fetch playlist
const { data: playlist } = await useFetch<Song[]>("/api/music/list", {
  key: "music-list",
});

// State
const currentSong = ref<Song | null>(null);
const isPlaying = ref(false);
const audioRef = ref<HTMLAudioElement | null>(null);
const progress = ref(0);
const volume = ref([80]);
const currentTime = ref("0:00");
const duration = ref("0:00");

// Playlist panel state
const showPlaylist = ref(false);
const playlistSearch = ref("");

// Init
if (playlist.value && playlist.value.length > 0) {
  currentSong.value = playlist.value[0]!;
}

// Filtered playlist
const filteredPlaylist = computed(() => {
  const q = playlistSearch.value.trim().toLowerCase();
  if (!q || !playlist.value) return playlist.value ?? [];
  return playlist.value.filter(
    (s) =>
      s.title.toLowerCase().includes(q) ||
      s.artist.toLowerCase().includes(q)
  );
});

const currentIndex = computed(() =>
  filteredPlaylist.value.findIndex(
    (s) => s.filename === currentSong.value?.filename
  )
);

async function selectSong(song: Song) {
  currentSong.value = song;
  isPlaying.value = true;
}

async function togglePlay() {
  if (!audioRef.value) return;
  if (isPlaying.value) {
    audioRef.value.pause();
    isPlaying.value = false;
  } else {
    try {
      await audioRef.value.play();
      isPlaying.value = true;
    } catch {
      isPlaying.value = false;
    }
  }
}

function skipTo(direction: 1 | -1) {
  if (!playlist.value || !currentSong.value) return;
  const idx = playlist.value.findIndex(
    (s: Song) => s.filename === currentSong.value?.filename
  );
  const newIdx = (idx + direction + playlist.value.length) % playlist.value.length;
  currentSong.value = playlist.value[newIdx]!;
  isPlaying.value = true;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? `0${s}` : s}`;
}

function formatDuration(seconds?: number) {
  if (!seconds) return "--:--";
  return formatTime(seconds);
}

function onTimeUpdate() {
  if (audioRef.value) {
    const cur = audioRef.value.currentTime;
    const dur = audioRef.value.duration;
    progress.value = dur > 0 ? (cur / dur) * 100 : 0;
    currentTime.value = formatTime(cur);
    duration.value = formatTime(dur || 0);
  }
}

watch(volume, (newVal: number[]) => {
  if (audioRef.value) {
    audioRef.value.volume = newVal[0]! / 100;
  }
});

// --- FIX: Unified seek handler untuk mouse DAN touch ---
function getSeekProgress(e: MouseEvent | TouchEvent, bar: HTMLElement): number {
  const rect = bar.getBoundingClientRect()
  const clientX = 'touches' in e
    ? (e.touches[0]?.clientX ?? (e as TouchEvent).changedTouches[0]?.clientX ?? 0)
    : (e as MouseEvent).clientX
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}

function seek(e: MouseEvent | TouchEvent) {
  if (!audioRef.value || audioRef.value.duration <= 0) return;
  const bar = e.currentTarget as HTMLElement;
  audioRef.value.currentTime = getSeekProgress(e, bar) * audioRef.value.duration;
}

// Touch seek: update progress visual secara live sambil drag
function onSeekTouchMove(e: TouchEvent) {
  e.preventDefault(); // cegah scroll halaman saat drag progress bar
  if (!audioRef.value || audioRef.value.duration <= 0) return;
  const bar = e.currentTarget as HTMLElement;
  progress.value = getSeekProgress(e, bar) * 100;
}

function onSeekTouchEnd(e: TouchEvent) {
  if (!audioRef.value || audioRef.value.duration <= 0) return;
  const bar = e.currentTarget as HTMLElement;
  audioRef.value.currentTime = getSeekProgress(e, bar) * audioRef.value.duration;
}

function onCanPlay() {
  if (isPlaying.value && audioRef.value) {
    audioRef.value.volume = volume.value[0]! / 100;
    audioRef.value.play().catch(() => {
      isPlaying.value = false;
    });
  }
}
</script>

<template>
  <Card
    class="w-full bg-linear-to-t from-card to-card/50 shadow-lg border-primary/10 overflow-hidden"
  >
    <CardHeader class="flex flex-row items-center justify-between space-y-0">
      <div class="space-y-1">
        <CardTitle class="text-xl font-bold tracking-tight text-primary">
          Audio Station
        </CardTitle>
        <CardDescription class="text-sm text-muted-foreground">
          Streaming high-performance vibes
        </CardDescription>
      </div>
      <div class="flex items-center gap-3">
        <!-- Volume Control — desktop only -->
        <div class="hidden sm:flex items-center gap-3 min-w-[120px]">
          <Icon name="i-lucide-volume-2" class="size-4 text-muted-foreground" />
          <Slider v-model="volume" :max="100" :step="1" class="w-24" />
        </div>

        <!-- Playlist Toggle -->
        <Button
          variant="outline"
          size="icon"
          class="h-10 w-10 rounded-full relative"
          :class="showPlaylist ? 'bg-primary/10 border-primary/30 text-primary' : ''"
          @click="showPlaylist = !showPlaylist"
        >
          <Icon name="i-lucide-list-music" class="size-4" />
          <span
            v-if="playlist && playlist.length > 0"
            class="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground"
          >
            {{ playlist.length }}
          </span>
        </Button>
      </div>
    </CardHeader>

    <CardContent class="pb-4">
      <!-- Player Controls Row -->
      <div class="flex flex-col md:flex-row items-center gap-5 pb-3">
        <!-- Controls -->
        <div class="flex items-center gap-3">
          <!-- FIX: min-w/h 44px untuk touch target yang layak -->
          <Button
            variant="ghost"
            size="icon"
            class="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-primary transition-colors"
            @click="skipTo(-1)"
          >
            <Icon name="i-lucide-skip-back" class="size-5" />
          </Button>

          <Button
            variant="default"
            size="icon"
            class="size-14 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 bg-primary text-primary-foreground"
            @click="togglePlay"
          >
            <Icon
              :name="isPlaying ? 'i-lucide-pause' : 'i-lucide-play'"
              class="size-6 fill-current"
            />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            class="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:text-primary transition-colors"
            @click="skipTo(1)"
          >
            <Icon name="i-lucide-skip-forward" class="size-5" />
          </Button>
        </div>

        <!-- Track Info -->
        <div class="flex flex-col items-center md:items-start flex-1 min-w-0">
          <span class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80">
            Now Playing
          </span>
          <h3 class="text-lg font-bold truncate w-full text-center md:text-left leading-tight">
            {{ currentSong?.title || "No Music Selected" }}
          </h3>
          <p class="text-sm text-muted-foreground italic truncate w-full text-center md:text-left">
            {{ currentSong?.artist || "Unknown Artist" }}
          </p>
        </div>

        <!-- Progress Bar -->
        <div class="flex flex-col w-full md:max-w-[300px] gap-2">
          <!--
            FIX: Tambah handler touch (touchstart+touchmove+touchend) di samping click
            touch-action: none agar browser tidak intercept gesture sebagai scroll
          -->
          <div
            class="group/bar relative h-3 w-full cursor-pointer overflow-hidden rounded-full bg-primary/10 touch-none select-none"
            style="touch-action: none;"
            @click="seek"
            @touchstart.passive="seek"
            @touchmove="onSeekTouchMove"
            @touchend="onSeekTouchEnd"
          >
            <div
              class="absolute left-0 top-0 h-full bg-primary transition-all duration-300 ease-linear shadow-[0_0_10px_rgba(var(--primary),0.5)]"
              :style="{ width: `${progress}%` }"
            />
            <!-- Knob indikator posisi — muncul saat hover/aktif -->
            <div
              class="absolute top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary shadow-md opacity-0 group-hover/bar:opacity-100 transition-opacity duration-200"
              :style="{ left: `calc(${progress}% - 8px)` }"
            />
          </div>
          <div class="flex justify-between font-mono text-[10px] text-muted-foreground tracking-widest">
            <span>{{ currentTime }}</span>
            <span>{{ duration }}</span>
          </div>
        </div>
      </div>

      <!-- FIX: Volume control khusus mobile (di bawah progress bar, tersembunyi di ≥sm) -->
      <div class="flex sm:hidden items-center gap-3 mt-1 mb-2 px-1">
        <Icon name="i-lucide-volume-1" class="size-4 text-muted-foreground/60 shrink-0" />
        <Slider v-model="volume" :max="100" :step="1" class="flex-1" />
        <Icon name="i-lucide-volume-2" class="size-4 text-muted-foreground/60 shrink-0" />
      </div>

      <!-- Playlist Panel -->
      <Transition
        enter-active-class="transition-all duration-300 ease-out"
        enter-from-class="opacity-0 max-h-0"
        enter-to-class="opacity-100 max-h-[50dvh]"
        leave-active-class="transition-all duration-200 ease-in"
        leave-from-class="opacity-100 max-h-[50dvh]"
        leave-to-class="opacity-0 max-h-0"
      >
        <div v-if="showPlaylist" class="overflow-hidden">
          <div class="mt-3 rounded-xl border border-primary/10 bg-background/40 overflow-hidden">
            <!-- Search -->
            <div class="flex items-center gap-2 px-3 py-2.5 border-b border-primary/10">
              <Icon name="i-lucide-search" class="size-3.5 text-muted-foreground/60 shrink-0" />
              <input
                v-model="playlistSearch"
                type="text"
                placeholder="Cari lagu atau artist..."
                class="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/40 text-foreground"
              />
              <button
                v-if="playlistSearch"
                class="p-1 text-muted-foreground/50 hover:text-foreground transition-colors"
                @click="playlistSearch = ''"
              >
                <Icon name="i-lucide-x" class="size-3" />
              </button>
            </div>

            <!-- Song List — FIX: max-h 50dvh adaptif terhadap tinggi layar -->
            <div class="overflow-y-auto max-h-[40dvh] scrollbar-thin scrollbar-track-transparent scrollbar-thumb-primary/20">
              <div
                v-if="filteredPlaylist.length === 0"
                class="flex flex-col items-center justify-center py-8 gap-2"
              >
                <Icon name="i-lucide-music-off" class="size-6 text-muted-foreground/30" />
                <p class="text-xs text-muted-foreground/50">Tidak ada lagu yang cocok</p>
              </div>

              <!-- FIX: min-h-[44px] pada setiap item untuk touch target -->
              <button
                v-for="(song, idx) in filteredPlaylist"
                :key="song.filename"
                class="w-full min-h-[44px] flex items-center gap-3 px-3 py-3 text-left transition-all duration-200 hover:bg-primary/5 active:bg-primary/10 group/item"
                :class="song.filename === currentSong?.filename
                  ? 'bg-primary/10 border-l-2 border-primary pl-[10px]'
                  : 'border-l-2 border-transparent'"
                @click="selectSong(song)"
              >
                <!-- Track Number / Playing Indicator -->
                <div class="w-5 shrink-0 flex items-center justify-center">
                  <span
                    v-if="song.filename !== currentSong?.filename"
                    class="text-[10px] font-mono text-muted-foreground/40 group-hover/item:hidden"
                  >
                    {{ String(idx + 1).padStart(2, '0') }}
                  </span>
                  <Icon
                    v-if="song.filename !== currentSong?.filename"
                    name="i-lucide-play"
                    class="size-3 text-primary hidden group-hover/item:block"
                  />
                  <!-- Equalizer animasi -->
                  <div v-if="song.filename === currentSong?.filename" class="flex items-end gap-px h-4">
                    <span
                      class="w-px rounded-full"
                      :class="isPlaying ? 'bg-primary animate-[bounce_0.6s_ease-in-out_infinite]' : 'bg-primary/50 h-1'"
                      :style="isPlaying ? 'height: 100%; animation-delay: 0ms' : ''"
                    />
                    <span
                      class="w-px rounded-full"
                      :class="isPlaying ? 'bg-primary animate-[bounce_0.6s_ease-in-out_infinite]' : 'bg-primary/50 h-1'"
                      :style="isPlaying ? 'height: 60%; animation-delay: 150ms' : ''"
                    />
                    <span
                      class="w-px rounded-full"
                      :class="isPlaying ? 'bg-primary animate-[bounce_0.6s_ease-in-out_infinite]' : 'bg-primary/50 h-1'"
                      :style="isPlaying ? 'height: 80%; animation-delay: 75ms' : ''"
                    />
                  </div>
                </div>

                <!-- Song Info -->
                <div class="flex-1 min-w-0">
                  <p
                    class="text-xs font-semibold truncate"
                    :class="song.filename === currentSong?.filename ? 'text-primary' : 'text-foreground'"
                  >
                    {{ song.title }}
                  </p>
                  <p class="text-[10px] text-muted-foreground/60 truncate">
                    {{ song.artist }}
                  </p>
                </div>

                <span class="text-[10px] font-mono text-muted-foreground/40 shrink-0">
                  {{ formatDuration(song.duration) }}
                </span>
              </button>
            </div>

            <!-- Footer -->
            <div class="px-3 py-2 border-t border-primary/10 flex items-center justify-between">
              <span class="text-[10px] text-muted-foreground/50">
                {{ filteredPlaylist.length }}
                {{ playlistSearch ? 'hasil' : 'lagu' }}
                <template v-if="playlistSearch"> dari {{ playlist?.length }}</template>
              </span>
              <span class="text-[10px] text-muted-foreground/40 font-mono">
                #{{ currentIndex + 1 }} / {{ filteredPlaylist.length }}
              </span>
            </div>
          </div>
        </div>
      </Transition>
    </CardContent>

    <audio
      ref="audioRef"
      :src="currentSong?.streamUrl"
      @timeupdate="onTimeUpdate"
      @ended="skipTo(1)"
      @loadedmetadata="onTimeUpdate"
      @canplay="onCanPlay"
    />
  </Card>
</template>
