"use client";

import { useEffect, useState, type JSX } from "react";

import {
    getPreferences,
    listDevices,
    patchDevice,
    patchPreferences,
    pushConfig,
    removeDevice,
    saveSubscription,
    sendTestPush,
    type NotificationPreferences,
    type PushDevice,
} from "@/features/notification/notification.api";
import { deviceId, needsInstallGuide, standaloneDisplay } from "@/features/pwa/pwa-state";

const LABELS: Record<string, string> = {
    social: "Xã hội",
    messages: "Tin nhắn",
    billing: "Thanh toán",
    moderation: "Kiểm duyệt",
    system: "Hệ thống",
};

function urlBase64ToUint8Array(value: string): Uint8Array {
    const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
    const raw = atob(padded);
    return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function NotificationSettings({ onClose }: { onClose: () => void }): JSX.Element {
    const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
    const [devices, setDevices] = useState<PushDevice[]>([]);
    const [enabled, setEnabled] = useState(false);
    const [note, setNote] = useState("");
    const id = deviceId();

    useEffect(() => {
        void Promise.all([getPreferences(), listDevices(id), pushConfig()])
            .then(([nextPrefs, nextDevices, config]) => {
                setPrefs(nextPrefs);
                setDevices(nextDevices);
                setEnabled(config.enabled);
            })
            .catch(() => setNote("Không tải được cài đặt."));
    }, [id]);

    async function enablePush(): Promise<void> {
        const config = await pushConfig();
        if (!config.enabled || !config.vapidPublicKey || !("serviceWorker" in navigator) || !("PushManager" in window)) {
            setNote("Trình duyệt này chưa bật được thông báo đẩy.");
            return;
        }
        if (needsInstallGuide() && !standaloneDisplay()) {
            setNote("Trên iPhone hoặc iPad, hãy thêm Địa Thế vào Màn hình chính trước.");
            return;
        }
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
            setNote("Quyền thông báo đang bị chặn. Hãy mở lại trong cài đặt trình duyệt.");
            return;
        }
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(config.vapidPublicKey) as BufferSource,
        });
        const json = subscription.toJSON();
        await saveSubscription({
            endpoint: subscription.endpoint,
            keys: json.keys,
            deviceId: id,
            label: navigator.userAgent.slice(0, 80),
            installedPwa: standaloneDisplay(),
            expirationTime: subscription.expirationTime,
            vapidPublicKey: config.vapidPublicKey,
        });
        setDevices(await listDevices(id));
        setNote("Đã bật thông báo đẩy trên thiết bị này.");
    }

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/40 p-4 sm:items-center">
            <div role="dialog" aria-labelledby="cai-dat-thong-bao" className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-2xl bg-white p-5 text-charcoal">
                <h2 id="cai-dat-thong-bao" className="m-0 text-lg font-semibold">
                    Cài đặt thông báo
                </h2>
                <button type="button" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-green px-4 text-sm font-semibold text-cream" onClick={() => void enablePush()}>
                    Bật thông báo đẩy
                </button>
                <button type="button" className="ml-2 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold" onClick={() => void sendTestPush().then(() => setNote("Đã gửi thử.")).catch(() => setNote("Chưa gửi được thông báo thử."))}>
                    Gửi thử
                </button>
                {prefs ? (
                    <div className="mt-5 grid gap-3">
                        <label className="flex min-h-11 items-center justify-between gap-3 text-sm">
                            Ẩn nội dung trên màn hình khóa
                            <input
                                type="checkbox"
                                checked={prefs.hideContentOnLockScreen}
                                onChange={(event) => {
                                    const hideContentOnLockScreen = event.target.checked;
                                    setPrefs({ ...prefs, hideContentOnLockScreen });
                                    void patchPreferences({ hideContentOnLockScreen }).catch(() => setPrefs(prefs));
                                }}
                            />
                        </label>
                        {Object.entries(LABELS).map(([key, label]) => {
                            const group = prefs.groups[key] ?? { inApp: true, push: true };
                            return (
                                <div key={key} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 text-sm">
                                    <span>{label}</span>
                                    <label className="inline-flex min-h-11 items-center gap-2">
                                        Trong ứng dụng
                                        <input
                                            type="checkbox"
                                            checked={group.inApp}
                                            onChange={(event) => {
                                                const groups = { ...prefs.groups, [key]: { ...group, inApp: event.target.checked } };
                                                setPrefs({ ...prefs, groups });
                                                void patchPreferences({ groups }).catch(() => setPrefs(prefs));
                                            }}
                                        />
                                    </label>
                                    <label className="inline-flex min-h-11 items-center gap-2">
                                        Đẩy
                                        <input
                                            type="checkbox"
                                            checked={group.push}
                                            disabled={!enabled}
                                            onChange={(event) => {
                                                const groups = { ...prefs.groups, [key]: { ...group, push: event.target.checked } };
                                                setPrefs({ ...prefs, groups });
                                                void patchPreferences({ groups }).catch(() => setPrefs(prefs));
                                            }}
                                        />
                                    </label>
                                </div>
                            );
                        })}
                        <p className="m-0 text-sm text-charcoal/70">Bảo mật luôn bật để bạn biết khi tài khoản có thay đổi.</p>
                    </div>
                ) : null}
                <ul className="mt-4 grid gap-2 p-0">
                    {devices.map((device) => (
                        <li key={device.id} className="flex items-center justify-between gap-3 rounded-xl border border-charcoal/10 px-3 py-2 text-sm">
                            <span>
                                {device.label || device.platform}
                                {device.current ? " · Thiết bị này" : ""}
                                {device.suspended ? " · Tạm ngưng" : ""}
                            </span>
                            <span className="flex gap-2">
                                <button type="button" className="min-h-11" onClick={() => void patchDevice(device.id, { pushEnabled: !device.pushEnabled }).then((next) => setDevices((rows) => rows.map((row) => (row.id === next.id ? next : row))))}>
                                    {device.pushEnabled ? "Tắt" : "Bật"}
                                </button>
                                <button type="button" className="min-h-11" onClick={() => void removeDevice(device.id).then(() => setDevices((rows) => rows.filter((row) => row.id !== device.id)))}>
                                    Xóa
                                </button>
                            </span>
                        </li>
                    ))}
                </ul>
                {note ? <p className="text-sm">{note}</p> : null}
                <button type="button" className="mt-4 inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold" onClick={onClose}>
                    Đóng
                </button>
            </div>
        </div>
    );
}
