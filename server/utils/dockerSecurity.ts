/**
 * 🔒 ALLOWED DOMAINS FOR APP URLs
 */
const ALLOWED_APP_DOMAINS = [
    '.test',
    'banglipai.tech',
    '.banglipai.tech',
    '.tech',
    '.id',
    '.com',
    '.net'
];

export function validateWorkloadId(id: string): boolean {
    // Docker standard IDs are 64 char hex, short are 12 hex. Swarm tasks usually 25 char base32
    const idRegex = /^[a-zA-Z0-9]{10,64}$/;
    return idRegex.test(id);
}

export function extractAppUrl(labels: Record<string, string> = {}): string | null {
    for (const [key, value] of Object.entries(labels)) {
        if (key.startsWith('traefik.http.routers.') && key.endsWith('.rule')) {
            const hostRegex = /Host\([`"]([^`"]+)[`"]\)/g;
            let match;

            while ((match = hostRegex.exec(value)) !== null) {
                const hostnames = match[1].split(',').map(h => h.trim().toLowerCase());

                for (const host of hostnames) {
                    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) continue;

                    const isAllowed = ALLOWED_APP_DOMAINS.some(suffix => host.endsWith(suffix));
                    if (isAllowed) {
                        return `https://${host}`;
                    }
                }
            }
        }
    }
    return null;
}

export interface SanitizedWorkload {
    id: string;
    name: string;
    image: string;
    mode: 'standalone' | 'swarm';
    state: string;
    status: string;
    created: number | string;
    cpu_percent: number;
    mem_percent: number;
    app_url: string | null;
    stack: string | null;
    service: string | null;
}

export function sanitizeWorkload(rawItem: any): SanitizedWorkload {
    const labels = rawItem.labels || rawItem.Labels || {};

    let mode: 'standalone' | 'swarm' = 'standalone';
    let service = labels['com.docker.swarm.service.name'] || null;

    if (labels['com.docker.swarm.service.id']) {
        mode = 'swarm';
    }

    let stack = labels['com.docker.stack.namespace']
        || labels['stack']
        || labels['namespace']
        || null;

    let name = rawItem.name || rawItem.Names?.[0] || rawItem.Name || "";
    if (name.startsWith('/')) name = name.substring(1);

    if (mode === 'swarm' && service) {
        if (rawItem.TaskSlot) {
            name = `${service}.${rawItem.TaskSlot}`;
        } else if (rawItem.Slot) {
            name = `${service}.${rawItem.Slot}`;
        }
    }

    const rawId = String(rawItem.id || rawItem.Id || "");
    const shortId = (rawItem.TaskSlot || rawItem.Slot) ? rawId : rawId.substring(0, 12);

    const cpu_percent = rawItem.stats?.cpu_percent || rawItem.cpu_percent || 0;
    const mem_percent = rawItem.stats?.mem_percent || rawItem.mem_percent || 0;

    const net_rx = rawItem.stats?.net_rx || rawItem.net_rx || 0;
    const net_tx = rawItem.stats?.net_tx || rawItem.net_tx || 0;

    const limits = rawItem.stats?.limits || rawItem.limits || null;

    const app_url = extractAppUrl(labels);

    return {
        id: shortId,
        name,
        image: (rawItem.image || rawItem.Image || "unknown").replace("sha256:", ""),
        mode,
        state: rawItem.state || rawItem.State?.Status || rawItem.State || "exited",
        status: rawItem.status || rawItem.Status || "",
        created: rawItem.created || rawItem.Created,
        cpu_percent,
        mem_percent,
        app_url,
        stack,
        service,
        // Need stats proxy object to support Vue dashboard UI since 'stats' object expects net bounds
        stats: {
            cpu_percent,
            mem_percent,
            net_rx,
            net_tx,
            limits,
            mem_usage: rawItem.stats?.mem_usage || rawItem.mem_usage || 0
        }
    } as SanitizedWorkload; // Cast for now given we passed stats directly for legacy UI
}
