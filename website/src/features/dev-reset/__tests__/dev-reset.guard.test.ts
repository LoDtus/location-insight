import { describe, expect, it } from "vitest";

import {
    createNonce,
    forwardedForIsPrivate,
    isAllowedHost,
    isDevResetEnabled,
    isSameOrigin,
    verifyNonce,
} from "../dev-reset.guard";

const TOKEN = "t".repeat(40);
const base = { NODE_ENV: "development", DEV_RESET_ENABLED: "true", DEV_RESET_TOKEN: TOKEN } as NodeJS.ProcessEnv;

describe("isDevResetEnabled", () => {
    it("bật khi đủ điều kiện dev", () => expect(isDevResetEnabled(base)).toBe(true));
    it.each([
        { NODE_ENV: "production" },
        { NODE_ENV: undefined },
        { DEV_RESET_ENABLED: "false" },
        { DEV_RESET_ENABLED: undefined },
        { DEV_RESET_TOKEN: "short" },
        { APP_ENV: "production" },
        { KUBERNETES_SERVICE_HOST: "10.0.0.1" },
    ])("tắt khi %o", (override) => {
        expect(isDevResetEnabled({ ...base, ...override } as NodeJS.ProcessEnv)).toBe(false);
    });
});

describe("isAllowedHost", () => {
    it.each(["localhost:3000", "127.0.0.1:22360", "192.168.1.20:22360", "10.0.0.2", "[::1]:3000", "my-pc.local:3000"])(
        "cho phép %s",
        (host) => expect(isAllowedHost(host)).toBe(true),
    );
    it.each(["example.com", "evil.com:3000", "8.8.8.8:80", "", null, "172.32.0.1:3000"])("từ chối %s", (host) =>
        expect(isAllowedHost(host)).toBe(false),
    );
});

describe("forwardedForIsPrivate", () => {
    it("chấp nhận thiếu hoặc toàn IP riêng", () => {
        expect(forwardedForIsPrivate(null)).toBe(true);
        expect(forwardedForIsPrivate("192.168.1.3, 10.0.0.1")).toBe(true);
    });
    it("từ chối khi có IP công khai", () => expect(forwardedForIsPrivate("1.2.3.4, 10.0.0.1")).toBe(false));
});

describe("nonce", () => {
    const now = Date.UTC(2026, 10, 2, 12, 0, 0);
    it("hợp lệ trong cửa sổ hiện tại và liền trước", () => {
        const nonce = createNonce(TOKEN, "localhost:3000", now);
        expect(verifyNonce(TOKEN, "localhost:3000", nonce, now)).toBe(true);
        expect(verifyNonce(TOKEN, "localhost:3000", nonce, now + 5 * 60 * 1000)).toBe(true);
    });
    it("hết hạn, sai host, sai token, sai kiểu", () => {
        const nonce = createNonce(TOKEN, "localhost:3000", now);
        expect(verifyNonce(TOKEN, "localhost:3000", nonce, now + 11 * 60 * 1000)).toBe(false);
        expect(verifyNonce(TOKEN, "192.168.1.2:3000", nonce, now)).toBe(false);
        expect(verifyNonce("x".repeat(40), "localhost:3000", nonce, now)).toBe(false);
        expect(verifyNonce(TOKEN, "localhost:3000", undefined, now)).toBe(false);
        expect(verifyNonce(TOKEN, "localhost:3000", "abc", now)).toBe(false);
    });
});

describe("isSameOrigin", () => {
    it("cùng origin", () => expect(isSameOrigin("http://localhost:3000", "localhost:3000", "same-origin")).toBe(true));
    it("khác origin, thiếu origin, cross-site", () => {
        expect(isSameOrigin("http://evil.com", "localhost:3000", null)).toBe(false);
        expect(isSameOrigin(null, "localhost:3000", null)).toBe(false);
        expect(isSameOrigin("http://localhost:3000", "localhost:3000", "cross-site")).toBe(false);
    });
});
