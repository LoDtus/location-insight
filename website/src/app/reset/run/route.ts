import {
    forwardedForIsPrivate,
    isAllowedHost,
    isDevResetEnabled,
    isSameOrigin,
    verifyNonce,
} from "@/features/dev-reset/dev-reset.guard";

export const dynamic = "force-dynamic";

const BACKEND_TIMEOUT_MS = 180_000;

function json(status: number, body: Record<string, unknown>): Response {
    return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function backendUrl(): string {
    const prefix = process.env.GLOBAL_PREFIX || "api/v1";
    const port = process.env.BACKEND_PORT || "22370";
    const target = process.env.API_PROXY_TARGET || `http://127.0.0.1:${port}`;
    return `${target}/${prefix}/dev/reset`;
}

/**
 * Thực hiện reset. Lớp bảo vệ: môi trường dev, host nội bộ, cùng origin, nonce HMAC, rồi gọi backend
 * bằng token chỉ server biết. Mọi lỗi điều kiện trả 404 để không lộ sự tồn tại.
 */
export async function POST(request: Request): Promise<Response> {
    const host = request.headers.get("host");
    if (
        !isDevResetEnabled() ||
        !isAllowedHost(host) ||
        !forwardedForIsPrivate(request.headers.get("x-forwarded-for"))
    ) {
        return new Response(null, { status: 404 });
    }
    if (!isSameOrigin(request.headers.get("origin"), host, request.headers.get("sec-fetch-site"))) {
        return json(403, { ok: false, message: "Yêu cầu không hợp lệ." });
    }

    let nonce: unknown;
    try {
        nonce = ((await request.json()) as { nonce?: unknown }).nonce;
    } catch {
        return json(400, { ok: false, message: "Yêu cầu không hợp lệ." });
    }
    const token = process.env.DEV_RESET_TOKEN ?? "";
    if (!host || !verifyNonce(token, host, nonce)) {
        return json(403, { ok: false, message: "Phiên đã hết hạn. Tải lại trang rồi thử lại." });
    }

    try {
        const response = await fetch(backendUrl(), {
            method: "POST",
            headers: { "x-dev-reset-token": token },
            cache: "no-store",
            signal: AbortSignal.timeout(BACKEND_TIMEOUT_MS),
        });
        const body = (await response.json().catch(() => null)) as {
            data?: unknown;
            error?: { message?: string };
            message?: string;
        } | null;
        if (!response.ok) {
            const message = body?.error?.message ?? body?.message ?? `Backend trả ${response.status}.`;
            return json(response.status === 404 ? 502 : response.status, { ok: false, message });
        }
        return json(200, { ok: true, data: body?.data });
    } catch {
        return json(502, { ok: false, message: "Không gọi được backend. Kiểm tra backend đang chạy." });
    }
}
