import Docker from "dockerode";
import fs from "fs/promises";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

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

export default defineEventHandler(async () => {
  try {
    // Check if docker socket exists or is accessible
    const containers = await docker
      .listContainers({ all: true })
      .catch((err) => {
        console.warn("Docker list failed (socket might be down):", err.message);
        return [] as Docker.ContainerInfo[];
      });

    if (containers.length === 0) {
      return [];
    }

    const hostUptimeSec = await readHostUptimeSeconds();

    const formattedContainers = await Promise.all(
      containers.map(async (c) => {
        const rawImage = c.Image || "unknown";
        const cleanImage = rawImage.replace("sha256:", "");

        let cleanName = "System/Unknown";
        if (c.Names && c.Names.length > 0) {
          cleanName = c.Names[0].replace(/^\//, "");
        }

        // Stats default
        let stats = {
          cpu_percent: 0,
          mem_usage: 0,
          mem_limit: 0,
          mem_percent: 0,
          net_rx: 0,
          net_tx: 0,
          blk_read: 0,
          blk_write: 0,
        };

        // Only fetch stats for running containers
        if (c.State === "running") {
          try {
            const s = await docker.getContainer(c.Id).stats({ stream: false });

            const cpuPercent = calcCpuPercent(s);
            const memUsage = s?.memory_stats?.usage ?? 0;
            const memLimit = s?.memory_stats?.limit ?? 0;
            const memPercent = memLimit > 0 ? (memUsage / memLimit) * 100 : 0;

            const rx = sumNetworkBytes(s?.networks, "rx_bytes");
            const tx = sumNetworkBytes(s?.networks, "rx_bytes"); // Fixed to rx/tx logic? wait below

            const blkRead = sumBlkioBytes(s?.blkio_stats, "Read");
            const blkWrite = sumBlkioBytes(s?.blkio_stats, "Write");

            stats = {
              cpu_percent: round(cpuPercent, 2),
              mem_usage: memUsage,
              mem_limit: memLimit,
              mem_percent: round(memPercent, 2),
              net_rx: rx,
              net_tx: sumNetworkBytes(s?.networks, "tx_bytes"),
              blk_read: blkRead,
              blk_write: blkWrite,
            };
          } catch {
            // Stats fetching failed for this specific container
          }
        }

        return {
          id: c.Id.substring(0, 12),
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
      }),
    );

    return formattedContainers;
  } catch (error: any) {
    console.warn("Docker Integration Error (Non-Fatal):", error.message);
    return []; // Return empty array to keep UI alive
  }
});
