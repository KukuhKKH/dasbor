import Docker from "dockerode";
import pLimit from "p-limit";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

const limit = pLimit(10);

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

async function fetchContainerStats(id: string) {
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

    try {
        const containerRef = docker.getContainer(id);

        let cachedLimits = getCachedLimits(id);
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

            setCachedLimits(id, cachedLimits);
        }

        if (cachedLimits) {
            stats.limits = cachedLimits;
        }

        if (s) {
            const cpuPercent = calcCpuPercent(s);
            const memUsage = s?.memory_stats?.usage ?? 0;
            const memLimitEffective = s?.memory_stats?.limit ?? 0;

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
        // Silent fail if container disappears or docker breaks
    }

    return stats;
}

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event);
        const idsParam = query.ids as string;

        if (!idsParam) {
            return {};
        }

        let ids = idsParam.split(',').map(id => id.trim()).filter(Boolean);
        if (ids.length === 0) {
            return {};
        }

        // Limit to max 200 IDs to prevent abuse
        if (ids.length > 200) {
            ids = ids.slice(0, 200);
        }

        const resultMap: Record<string, any> = {};

        await Promise.all(
            ids.map(id =>
                limit(async () => {
                    const stats = await fetchContainerStats(id);
                    resultMap[id] = stats;
                })
            )
        );

        return resultMap;
    } catch (error: any) {
        console.warn("Global Handler Error (Stats):", error?.message);
        return {};
    }
});
