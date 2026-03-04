import { H3Event, getRequestIP, createError } from 'h3';

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const TARGET_USER_LIMIT = 10;
const TARGET_IP_LIMIT = 30;

interface RateLimitRecord {
    count: number;
    resetAt: number;
}

const rateLimits = new Map<string, RateLimitRecord>();

function checkRateLimit(key: string, limit: number): boolean {
    const now = Date.now();
    let record = rateLimits.get(key);

    if (!record || record.resetAt < now) {
        record = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
        rateLimits.set(key, record);
        return true;
    }

    if (record.count >= limit) return false;
    record.count++;
    return true;
}

export function rateLimitMiddleware(event: H3Event, userId?: string) {
    const clientIp = getRequestIP(event, { xForwardedFor: true }) || 'unknown';

    const ipAllowed = checkRateLimit(`ip:${clientIp}`, TARGET_IP_LIMIT);
    if (!ipAllowed) {
        throw createError({
            statusCode: 429,
            statusMessage: 'rate_limit_exceeded',
            message: 'Too many action requests from this IP address.'
        });
    }

    if (userId) {
        const userAllowed = checkRateLimit(`user:${userId}`, TARGET_USER_LIMIT);
        if (!userAllowed) {
            throw createError({
                statusCode: 429,
                statusMessage: 'rate_limit_exceeded',
                message: 'Too many action requests from this account.'
            });
        }
    }
}
