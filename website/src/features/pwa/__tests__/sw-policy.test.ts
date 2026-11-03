import { describe, expect, it } from "vitest";

import {
    isAppPath,
    isStaticAsset,
    notificationTarget,
    parsePushPayload,
    responseIsPrivate,
    withNotificationId,
} from "@/features/pwa/sw-policy";
import { installAllowed, installEligible, isHandheld, needsInstallGuide, noteNotificationVisit, noteSession } from "@/features/pwa/pwa-state";

const origin = "https://diathe.local";

describe("chính sách service worker", () => {
    it("chỉ nhận đường dẫn trong ứng dụng", () => {
        expect(notificationTarget("https://evil.example/app", origin)).toBe("/app/notification");
        expect(notificationTarget("/bai-viet/tin", origin)).toBe("/app/notification");
        expect(notificationTarget("/app/messages?tab=1", origin)).toBe("/app/messages?tab=1");
        expect(isAppPath("/admin/users")).toBe(true);
    });

    it("gắn mã thông báo và bỏ qua biểu tượng lạ", () => {
        const view = parsePushPayload(
            JSON.stringify({
                title: "Tin mới",
                url: "/admin/feed",
                id: "abc",
                icon: "https://evil.example/a.png",
                unread: 3,
            }),
            origin,
        );
        expect(withNotificationId(view.url, view.id)).toBe("/admin/feed?n=abc");
        expect(view.icon).toBe("/icons/icon-192.png");
        expect(view.unread).toBe(3);
    });

    it("dùng thông báo chung khi JSON hỏng", () => {
        expect(parsePushPayload("{", origin).title).toBe("Bạn có thông báo mới");
    });

    it("không cache phản hồi riêng tư hoặc API", () => {
        expect(isStaticAsset("/api/v1/me")).toBe(false);
        expect(isStaticAsset("/_next/static/chunk.js")).toBe(true);
        expect(responseIsPrivate(new Headers({ "cache-control": "private, no-store" }))).toBe(true);
        expect(responseIsPrivate(new Headers({ "set-cookie": "a=b" }))).toBe(true);
    });
});

describe("điều kiện gợi ý cài đặt", () => {
    it("chờ đủ hai phiên hoặc sau khi xem thông báo", () => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        expect(installEligible()).toBe(false);
        noteSession();
        window.sessionStorage.clear();
        noteSession();
        expect(installEligible()).toBe(true);
    });

    it("chỉ coi điện thoại và máy tính bảng là thiết bị cầm tay", () => {
        const original = {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            maxTouchPoints: navigator.maxTouchPoints,
        };
        const setNavigator = (userAgent: string, platform: string, maxTouchPoints: number): void => {
            Object.defineProperty(navigator, "userAgent", { value: userAgent, configurable: true });
            Object.defineProperty(navigator, "platform", { value: platform, configurable: true });
            Object.defineProperty(navigator, "maxTouchPoints", { value: maxTouchPoints, configurable: true });
        };
        try {
            setNavigator("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0", "Win32", 0);
            expect(isHandheld()).toBe(false);
            expect(needsInstallGuide()).toBe(false);
            setNavigator("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15", "MacIntel", 0);
            expect(isHandheld()).toBe(false);
            expect(needsInstallGuide()).toBe(false);
            setNavigator("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15", "iPhone", 5);
            expect(isHandheld()).toBe(true);
            expect(needsInstallGuide()).toBe(true);
            setNavigator("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/605.1.15", "MacIntel", 5);
            expect(isHandheld()).toBe(true);
            expect(needsInstallGuide()).toBe(true);
        } finally {
            setNavigator(original.userAgent, original.platform, original.maxTouchPoints);
        }
    });

    it("ẩn 30 ngày sau khi chọn để sau", () => {
        expect(installAllowed(Date.now())).toBe(true);
        window.localStorage.setItem("pwa-install-later", String(Date.now()));
        expect(installAllowed()).toBe(false);
        noteNotificationVisit("/app/notification");
        expect(installEligible()).toBe(false);
    });
});
