import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Chặn truy cập công cụ reset dữ liệu dev. CHỈ dùng ở server (route handler, server component).
 * Thư mục `src/app/reset` và `src/features/dev-reset` bị xóa khỏi image production (xem Dockerfile);
 * các hàm dưới đây là lớp bảo vệ khi mã vẫn còn trong cây nguồn.
 */

const TOKEN_MIN_LENGTH = 32;
const NONCE_WINDOW_MS = 5 * 60 * 1000;
const NON_DEV = new Set(["production", "prod", "staging", "stage", "preview", "live"]);
const ENV_NAMES = ["NODE_ENV", "APP_ENV", "ENVIRONMENT", "DEPLOY_ENV", "STAGE", "VERCEL_ENV"] as const;

export function isDevResetEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    if (env.NODE_ENV !== "development") return false;
    if (env.DEV_RESET_ENABLED !== "true") return false;
    if ((env.DEV_RESET_TOKEN ?? "").length < TOKEN_MIN_LENGTH) return false;
    if (env.KUBERNETES_SERVICE_HOST) return false;
    return !ENV_NAMES.some((name) => NON_DEV.has((env[name] ?? "").trim().toLowerCase()));
}

export function isPrivateOrLoopbackIp(raw: string | undefined): boolean {
    if (!raw) return false;
    let ip = raw.trim().toLowerCase();
    if (ip.startsWith("[") && ip.endsWith("]")) ip = ip.slice(1, -1);
    if (ip.startsWith("::ffff:")) ip = ip.slice("::ffff:".length);

    const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
    if (match) {
        const [a, b] = match.slice(1, 5).map(Number) as [number, number];
        const octets = match.slice(1, 5).map(Number);
        if (octets.some((part) => part > 255)) return false;
        return (
            a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
        );
    }
    if (ip === "::1") return true;
    if (!ip.includes(":")) return false;
    const head = Number.parseInt(ip.split(":")[0] || "0", 16);
    if (Number.isNaN(head)) return false;
    return (head & 0xfe00) === 0xfc00 || (head & 0xffc0) === 0xfe80;
}

/** Host của yêu cầu: localhost, loopback, IP mạng nội bộ, hoặc `*.local`. Tên miền công khai bị từ chối (chống DNS rebinding). */
export function isAllowedHost(hostHeader: string | null | undefined): boolean {
    if (!hostHeader) return false;
    const host = hostHeader.trim().toLowerCase();
    const name = host.startsWith("[") ? host.slice(0, host.indexOf("]") + 1) : host.split(":")[0] ?? "";
    if (!name) return false;
    if (name === "localhost" || name.endsWith(".localhost") || name.endsWith(".local")) return true;
    return isPrivateOrLoopbackIp(name);
}

/** Không có X-Forwarded-For là hợp lệ (kết nối trực tiếp); nếu có thì mọi phần tử phải riêng tư. */
export function forwardedForIsPrivate(header: string | null | undefined): boolean {
    if (!header) return true;
    const ips = header.split(",").map((part) => part.trim()).filter(Boolean);
    return ips.every((ip) => isPrivateOrLoopbackIp(ip));
}

function nonceFor(token: string, host: string, bucket: number): string {
    return createHmac("sha256", token).update(`dev-reset|${host.toLowerCase()}|${bucket}`).digest("hex");
}

/** Nonce không trạng thái, gắn với host và cửa sổ 5 phút. Trang khác origin không đọc được nội dung trang nên không có nonce. */
export function createNonce(token: string, host: string, now: number = Date.now()): string {
    return nonceFor(token, host, Math.floor(now / NONCE_WINDOW_MS));
}

export function verifyNonce(token: string, host: string, nonce: unknown, now: number = Date.now()): boolean {
    if (typeof nonce !== "string" || nonce.length !== 64) return false;
    const bucket = Math.floor(now / NONCE_WINDOW_MS);
    return [bucket, bucket - 1].some((candidate) => {
        const expected = Buffer.from(nonceFor(token, host, candidate));
        const received = Buffer.from(nonce);
        return expected.length === received.length && timingSafeEqual(expected, received);
    });
}

/** `Origin` phải có và cùng host với `Host`; `Sec-Fetch-Site` (nếu có) phải là same-origin. */
export function isSameOrigin(origin: string | null, host: string | null, fetchSite: string | null): boolean {
    if (!origin || !host) return false;
    if (fetchSite && fetchSite !== "same-origin") return false;
    try {
        return new URL(origin).host.toLowerCase() === host.toLowerCase();
    } catch {
        return false;
    }
}
