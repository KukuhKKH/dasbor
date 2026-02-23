import Docker from "dockerode";
import fs from "fs/promises";
import pLimit from "p-limit";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const limit = pLimit(20);

function round(n: number, d = 2) {
  const p = 10 ** d;
  return Math.round(n * p) / p;
}

function calcCpuPercent(s: any) {
  const cpuDelta =
    (s?.cpu_stats?.cpu_usage?.total_usage ?? 0) -
    (s?.precpu_stats?.cpu_usage?.total_usage ?? 0);

  const systemDelta =
    (s?.cpu_stats?.system_cpu_usage ?? 0) -
    (s?.precpu_stats?.system_cpu_usage ?? 0);

  const onlineCpus =
    s?.cpu_stats?.online_cpus ??
    s?.cpu_stats?.cpu_usage?.percpu_usage?.length ??
    0;

  if (systemDelta > 0 && cpuDelta > 0 && onlineCpus > 0) {
    return (cpuDelta / systemDelta) * onlineCpus * 100;
  }
  return 0;
}

function sumNetworkBytes(networks: any, key: "rx_bytes" | "tx_bytes") {
  if (!networks) return 0;
  return Object.values(networks).reduce(
    (acc: number, v: any) => acc + (v?.[key] ?? 0),
    0,
  );
}

function sumBlkioBytes(blkio: any, op: "Read" | "Write") {
  const arr = blkio?.io_service_bytes_recursive;
  if (!Array.isArray(arr)) return 0;
  return arr.reduce(
    (acc: number, x: any) => acc + (x?.op === op ? (x?.value ?? 0) : 0),
    0,
  );
}

async function readHostUptimeSeconds() {
  try {
    const raw = (await fs.readFile("/host/proc/uptime", "utf8")).trim();
    const sec = Number(raw.split(/\s+/)[0]);
    return Number.isFinite(sec) ? sec : 0;
  } catch {
    return 0;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(fallback);
      }
    }, ms);

    promise.then(
      (val) => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(val);
        }
      },
      () => {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          resolve(fallback);
        }
      }
    );
  });
}

interface Limits {
  memory: number;
  memory_reservation: number;
  cpu: number;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const inspectCache = new Map<string, CacheEntry<Limits>>();
const INSPECT_TTL_MS = 60 * 1000;
const MAX_CACHE_SIZE = 5000;
let lastSweep = Date.now();

function getCachedLimits(id: string): Limits | null {
  const now = Date.now();

  if (now - lastSweep > 60000) {
    lastSweep = now;
    for (const [k, v] of inspectCache.entries()) {
      if (now > v.expiresAt) {
        inspectCache.delete(k);
      }
    }
  }

  const hit = inspectCache.get(id);
  if (!hit) return null;

  if (now > hit.expiresAt) {
    inspectCache.delete(id);
    return null;
  }

  return hit.data;
}

function setCachedLimits(id: string, data: Limits) {
  if (inspectCache.size >= MAX_CACHE_SIZE) {
    inspectCache.clear();
  }

  inspectCache.set(id, { data, expiresAt: Date.now() + INSPECT_TTL_MS });
}

async function processContainer(c: Docker.ContainerInfo, hostUptimeSec: number, withStats: boolean) {
  const rawImage = c.Image || "unknown";
  const cleanImage = rawImage.replace("sha256:", "");

  let cleanName = "System/Unknown";
  if (c.Names && c.Names.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    cleanName = c.Names[0]!.replace(/^\//, "");
  }

  const stats: Record<string, any> = {
    cpu_percent: 0,
    mem_usage: 0,
    mem_limit: 0,
    mem_percent: 0,
    net_rx: 0,
    net_tx: 0,
    blk_read: 0,
    blk_write: 0,
    limits: {
      memory: 0,
      memory_reservation: 0,
      cpu: 0,
    },
  };

  if (withStats && c.State === "running") {
    try {
      const containerRef = docker.getContainer(c.Id);

      let cachedLimits = getCachedLimits(c.Id);
      let inspectPromise: Promise<any> | null = null;
      if (!cachedLimits) {
        inspectPromise = containerRef.inspect().catch(() => null);
      }

      const statsPromise = withTimeout(containerRef.stats({ stream: false }), 1500, null);

      const [s, inspectData] = await Promise.all([
        statsPromise,
        inspectPromise ? inspectPromise : Promise.resolve(null)
      ]);

      if (!cachedLimits && inspectData) {
        const hostConfig: any = inspectData.HostConfig || {};
        const configMemLimit = hostConfig.Memory || 0;
        const configMemReservation = hostConfig.MemoryReservation || 0;

        let configCpuLimit = 0;
        const nanoCpus = hostConfig.NanoCPUs || hostConfig.NanoCpus;
        if (nanoCpus) {
          configCpuLimit = nanoCpus / 1e9;
        } else if (hostConfig.CpuQuota && hostConfig.CpuPeriod) {
          configCpuLimit = hostConfig.CpuQuota / hostConfig.CpuPeriod;
        }

        cachedLimits = {
          memory: configMemLimit,
          memory_reservation: configMemReservation,
          cpu: configCpuLimit,
        };
        setCachedLimits(c.Id, cachedLimits);
      }

      if (cachedLimits) {
        stats.limits = cachedLimits;
      }

      if (s) {
        const cpuPercent = calcCpuPercent(s);
        const memUsage = s?.memory_stats?.usage ?? 0;
        const memLimitEffective = s?.memory_stats?.limit ?? 0;

        // Ensure proper denominator
        const maxMem = cachedLimits?.memory && cachedLimits.memory > 0 ? cachedLimits.memory : memLimitEffective;
        const memPercent = maxMem > 0 ? (memUsage / maxMem) * 100 : 0;

        const rx = sumNetworkBytes(s?.networks, "rx_bytes");
        const tx = sumNetworkBytes(s?.networks, "tx_bytes");
        const blkRead = sumBlkioBytes(s?.blkio_stats, "Read");
        const blkWrite = sumBlkioBytes(s?.blkio_stats, "Write");

        stats.cpu_percent = round(cpuPercent, 2);
        stats.mem_usage = memUsage;
        stats.mem_limit = memLimitEffective;
        stats.mem_percent = round(memPercent, 2);
        stats.net_rx = rx;
        stats.net_tx = tx;
        stats.blk_read = blkRead;
        stats.blk_write = blkWrite;
      }
    } catch {
      // Silent fail -> fallback 0
    }
  }

  return {
    id: c.Id.substring(0, 12),
    full_id: c.Id,
    name: cleanName,
    image: cleanImage,
    state: c.State,
    status: c.Status,
    created: c.Created,
    ports: c.Ports || [],
    labels: c.Labels || {},
    stats,
    host: {
      uptime_seconds: Math.floor(hostUptimeSec),
    },
  };
}

let endpointCacheBasic: CacheEntry<any> | null = null;
let endpointCacheStats: CacheEntry<any> | null = null;

let pendingRequestBasic: Promise<any> | null = null;
let pendingRequestStats: Promise<any> | null = null;

const ENDPOINT_TTL_MS = 2000;

async function fetchAllContainers(withStats: boolean) {
  const containers = await docker
    .listContainers({ all: true })
    .catch((err) => {
      console.warn("Docker list failed:", err.message);
      return [] as Docker.ContainerInfo[];
    });

  if (containers.length === 0) {
    return [];
  }

  const hostUptimeSec = await readHostUptimeSeconds();

  const formattedContainers = await Promise.all(
    containers.map((c) =>
      limit(() => processContainer(c, hostUptimeSec, withStats))
    ),
  );

  return formattedContainers;
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event);
    const withStats = query.stats === "1";
    const now = Date.now();

    if (withStats) {
      if (endpointCacheStats && now < endpointCacheStats.expiresAt) {
        return endpointCacheStats.data;
      }
      if (pendingRequestStats) {
        return await pendingRequestStats;
      }

      pendingRequestStats = fetchAllContainers(true)
        .then((res) => {
          endpointCacheStats = {
            data: res,
            expiresAt: Date.now() + ENDPOINT_TTL_MS,
          };
          return res;
        })
        .finally(() => {
          pendingRequestStats = null;
        });

      return await pendingRequestStats;
    } else {
      if (endpointCacheBasic && now < endpointCacheBasic.expiresAt) {
        return endpointCacheBasic.data;
      }
      if (pendingRequestBasic) {
        return await pendingRequestBasic;
      }

      pendingRequestBasic = fetchAllContainers(false)
        .then((res) => {
          endpointCacheBasic = {
            data: res,
            expiresAt: Date.now() + ENDPOINT_TTL_MS,
          };
          return res;
        })
        .finally(() => {
          pendingRequestBasic = null;
        });

      return await pendingRequestBasic;
    }
  } catch (error: any) {
    console.warn("Global Handler Error:", error?.message);
    return [];
  }
});
