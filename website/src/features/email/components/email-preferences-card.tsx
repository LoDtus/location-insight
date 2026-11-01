"use client";

import { useEffect, useState, type JSX } from "react";

import { getPreferences, setPreference, type EmailPreference } from "../email.api";

const LABEL: Record<EmailPreference["category"], string> = {
    notification: "Thông báo hoạt động (ví dụ có người theo dõi bạn)",
    marketing: "Tin tức và ưu đãi",
};

/** Công tắc email của chính mình. Email bảo mật luôn được gửi. */
export function EmailPreferencesCard(): JSX.Element | null {
    const [prefs, setPrefs] = useState<EmailPreference[] | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        let cancelled = false;
        void getPreferences()
            .then((list) => {
                if (!cancelled) setPrefs(list);
            })
            .catch(() => {
                if (!cancelled) setError("Không tải được tùy chọn email.");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    async function toggle(category: EmailPreference["category"], enabled: boolean): Promise<void> {
        const previous = prefs;
        setPrefs((current) => current?.map((p) => (p.category === category ? { ...p, enabled } : p)) ?? null);
        setError("");
        try {
            setPrefs(await setPreference(category, enabled));
        } catch {
            setPrefs(previous);
            setError("Không lưu được. Hãy thử lại.");
        }
    }

    if (!prefs && !error) return null;
    return (
        <section aria-labelledby="email-prefs" className="rounded-lg border border-charcoal/15 p-4">
            <h2 id="email-prefs" className="m-0 mb-2 text-base font-semibold">Email thông báo</h2>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {prefs?.map((pref) => (
                    <li key={pref.category}>
                        <label className="flex min-h-11 items-center gap-3 text-sm">
                            <input type="checkbox" className="size-4 accent-green" checked={pref.enabled} onChange={(event) => void toggle(pref.category, event.target.checked)} />
                            {LABEL[pref.category]}
                        </label>
                    </li>
                ))}
            </ul>
            <p className="m-0 mt-1 text-xs text-charcoal/60">Email bảo mật (xác minh, đặt lại mật khẩu) luôn được gửi.</p>
            {error ? <p role="alert" className="m-0 mt-1 text-xs text-red-700">{error}</p> : null}
        </section>
    );
}
