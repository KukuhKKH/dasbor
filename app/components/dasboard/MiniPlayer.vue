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
const volume = ref([80]); // Slider uses array for range
const currentTime = ref("0:00");
const duration = ref("0:00");

// Init
if (playlist.value && playlist.value.length > 0) {
  currentSong.value = playlist.value[0];
}

// Actions
function togglePlay() {
  if (!audioRef.value) {
    return;
  }

  if (isPlaying.value) {
    audioRef.value.pause();
  } else {
    audioRef.value.play();
  }

  isPlaying.value = !isPlaying.value;
}

function nextSong() {
  if (!playlist.value || !currentSong.value) {
    return;
  }

  const idx = playlist.value.findIndex(
    (s) => s.filename === currentSong.value?.filename
  );
  const nextIdx = (idx + 1) % playlist.value.length;
  currentSong.value = playlist.value[nextIdx];
  isPlaying.value = true;
  setTimeout(() => {
    if (audioRef.value) {
      audioRef.value.volume = volume.value[0] / 100;
      audioRef.value.play();
    }
  }, 100);
}

function prevSong() {
  if (!playlist.value || !currentSong.value) {
    return;
  }

  const idx = playlist.value.findIndex(
    (s) => s.filename === currentSong.value?.filename
  );
  const prevIdx = (idx - 1 + playlist.value.length) % playlist.value.length;
  currentSong.value = playlist.value[prevIdx];
  isPlaying.value = true;
  setTimeout(() => {
    if (audioRef.value) {
      audioRef.value.volume = volume.value[0] / 100;
      audioRef.value.play();
    }
  }, 100);
}

// Time Formatting Helper
function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? `0${s}` : s}`;
}

// Audio Events
function onTimeUpdate() {
  if (audioRef.value) {
    const cur = audioRef.value.currentTime;
    const dur = audioRef.value.duration;
    progress.value = dur > 0 ? (cur / dur) * 100 : 0;
    currentTime.value = formatTime(cur);
    duration.value = formatTime(dur || 0);
  }
}

function onVolumeChange(val: number[]) {
  if (audioRef.value) {
    audioRef.value.volume = val[0] / 100;
  }
}

function seek(e: MouseEvent) {
  const bar = e.currentTarget as HTMLElement;
  const rect = bar.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const width = rect.width;
  if (audioRef.value && audioRef.value.duration > 0) {
    audioRef.value.currentTime = (clickX / width) * audioRef.value.duration;
  }
}

watch(volume, (newVal) => {
  if (audioRef.value) {
    audioRef.value.volume = newVal[0] / 100;
  }
});
</script>

<template>
  <Card
    class="w-full bg-linear-to-t from-card to-card/50 shadow-lg border-primary/10 overflow-hidden"
  >
    <CardHeader
      class="flex flex-row items-center justify-between space-y-0"
    >
      <div class="space-y-1">
        <CardTitle class="text-xl font-bold tracking-tight text-primary">
          Audio Station
        </CardTitle>
        <CardDescription class="text-sm text-muted-foreground">
          Streaming high-performance vibes
        </CardDescription>
      </div>
      <div class="flex items-center gap-4">
        <!-- Volume Control -->
        <div class="hidden sm:flex items-center gap-3 min-w-[120px]">
          <Icon name="i-lucide-volume-2" class="size-4 text-muted-foreground" />
          <Slider
            v-model="volume"
            :max="100"
            :step="1"
            class="w-24"
            @update:model-value="onVolumeChange"
          />
        </div>
      </div>
    </CardHeader>

    <CardContent class="pb-6">
      <div class="flex flex-col md:flex-row items-center gap-6">
        <!-- Player Controls -->
        <div class="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            class="rounded-full text-muted-foreground hover:text-primary transition-colors"
            @click="prevSong"
          >
            <Icon name="i-lucide-skip-back" class="size-5" />
          </Button>

          <Button
            variant="default"
            size="icon"
            class="size-12 rounded-full shadow-lg transition-transform hover:scale-105 active:scale-95 bg-primary text-primary-foreground"
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
            class="rounded-full text-muted-foreground hover:text-primary transition-colors"
            @click="nextSong"
          >
            <Icon name="i-lucide-skip-forward" class="size-5" />
          </Button>
        </div>

        <!-- Track Info -->
        <div class="flex flex-col items-center md:items-start flex-1 min-w-0">
          <span
            class="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/80"
          >
            Now Playing
          </span>
          <h3
            class="text-xl font-bold truncate w-full text-center md:text-left"
          >
            {{ currentSong?.title || "No Music Selected" }}
          </h3>
          <p
            class="text-sm text-muted-foreground italic truncate w-full text-center md:text-left"
          >
            {{ currentSong?.artist || "Unknown Artist" }}
          </p>
        </div>

        <!-- Progress Bar -->
        <div class="flex flex-col w-full md:max-w-[300px] gap-2">
          <div
            class="group/bar relative h-2 w-full cursor-pointer overflow-hidden rounded-full bg-primary/10 transition-all hover:h-3"
            @click="seek"
          >
            <div
              class="absolute left-0 top-0 h-full bg-primary transition-all duration-300 ease-linear shadow-[0_0_10px_rgba(var(--primary),0.5)]"
              :style="{ width: `${progress}%` }"
            />
          </div>
          <div
            class="flex justify-between font-mono text-[10px] text-muted-foreground tracking-widest"
          >
            <span>{{ currentTime }}</span>
            <span>{{ duration }}</span>
          </div>
        </div>
      </div>
    </CardContent>

    <audio
      ref="audioRef"
      :src="currentSong?.streamUrl"
      @timeupdate="onTimeUpdate"
      @ended="nextSong"
      @loadedmetadata="onTimeUpdate"
    />
  </Card>
</template>
