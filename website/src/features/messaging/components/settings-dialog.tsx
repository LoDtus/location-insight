"use client";

import { useEffect, useState, type JSX } from "react";

import { errorText } from "../messaging.actions";
import { getPreferences, listBlocks, unblockUser, updatePreferences } from "../messaging.api";
import type { Person, Preferences } from "../messaging.types";
import { Dialog } from "./dialog";
import { PersonAvatar } from "./person-avatar";

export function SettingsDialog({ onClose }: { onClose: () => void }): JSX.Element {
    const [prefs, setPrefs] = useState<Preferences | null>(null);
    const [blocks, setBlocks] = useState<Person[]>([]);
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;
        Promise.all([getPreferences(), listBlocks()])
            .then(([loaded, blocked]) => {
                if (!active) return;
                setPrefs(loaded);
                setBlocks(blocked.items);
            })
            .catch((failure: unknown) => {
                if (active) setError(errorText(failure, "Không tải được cài đặt."));
            });
        return () => {
            active = false;
        };
    }, []);

    async function change(patch: Partial<Preferences>): Promise<void> {
        if (!prefs) return;
        const previous = prefs;
        setPrefs({ ...prefs, ...patch });
        setError("");
        try {
            setPrefs(await updatePreferences(patch));
        } catch (failure) {
            setPrefs(previous);
            setError(errorText(failure));
        }
    }

    async function unblock(person: Person): Promise<void> {
        try {
            await unblockUser(person.id);
            setBlocks((current) => current.filter((item) => item.id !== person.id));
        } catch (failure) {
            setError(errorText(failure));
        }
    }

    return (
        <Dialog title="Cài đặt tin nhắn" onClose={onClose}>
            {!prefs ? (
                <p className="m-0 text-sm" role={error ? "alert" : "status"}>
                    {error || "Đang tải…"}
                </p>
            ) : (
                <div className="grid gap-5">
                    <fieldset className="m-0 grid gap-1 border-0 p-0">
                        <legend className="mb-1 text-sm font-semibold">Ai có thể nhắn cho bạn</legend>
                        {(
                            [
                                { value: "everyone", label: "Mọi người (người lạ vào mục Yêu cầu)" },
                                { value: "nobody", label: "Không ai (người đã nhắn với bạn vẫn nhắn được)" },
                            ] as const
                        ).map((option) => (
                            <label key={option.value} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-charcoal/5">
                                <input
                                    type="radio"
                                    name="who"
                                    checked={prefs.whoCanMessage === option.value}
                                    onChange={() => void change({ whoCanMessage: option.value })}
                                    className="size-4 accent-green"
                                />
                                {option.label}
                            </label>
                        ))}
                    </fieldset>
                    <Toggle
                        label="Hiện trạng thái hoạt động"
                        hint="Tắt thì bạn cũng không thấy trạng thái của người khác."
                        checked={prefs.showActivityStatus}
                        onChange={(value) => void change({ showActivityStatus: value })}
                    />
                    <Toggle
                        label="Gửi báo đã xem"
                        hint="Tắt thì bạn cũng không thấy người khác đã xem tin của bạn hay chưa."
                        checked={prefs.sendReadReceipts}
                        onChange={(value) => void change({ sendReadReceipts: value })}
                    />
                    <section>
                        <h3 className="m-0 mb-2 text-sm font-semibold">Người đã chặn</h3>
                        {blocks.length === 0 ? (
                            <p className="m-0 text-sm text-charcoal/70">Bạn chưa chặn ai.</p>
                        ) : (
                            <ul className="m-0 grid gap-1 p-0">
                                {blocks.map((person) => (
                                    <li key={person.id} className="flex list-none items-center gap-3">
                                        <PersonAvatar name={person.displayName} url={person.avatarUrl} size={36} />
                                        <span className="min-w-0 flex-1 truncate">{person.displayName}</span>
                                        <button
                                            type="button"
                                            className="min-h-11 rounded-full border border-charcoal/25 px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-green"
                                            onClick={() => void unblock(person)}
                                        >
                                            Bỏ chặn
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </section>
                    <p className="m-0 rounded-xl bg-white p-3 text-xs text-charcoal/75">
                        Tin nhắn không được mã hóa đầu cuối. Tin bạn báo cáo có thể được người vận hành xem.
                    </p>
                    {error ? (
                        <p role="alert" className="m-0 text-sm text-red-700">
                            {error}
                        </p>
                    ) : null}
                </div>
            )}
        </Dialog>
    );
}

function Toggle({
    label,
    hint,
    checked,
    onChange,
}: {
    label: string;
    hint: string;
    checked: boolean;
    onChange: (value: boolean) => void;
}): JSX.Element {
    return (
        <label className="flex min-h-11 cursor-pointer items-start justify-between gap-4">
            <span>
                <span className="block font-semibold">{label}</span>
                <span className="block text-sm text-charcoal/70">{hint}</span>
            </span>
            <input
                type="checkbox"
                role="switch"
                checked={checked}
                onChange={(event) => onChange(event.target.checked)}
                className="mt-1 size-5 shrink-0 accent-green"
            />
        </label>
    );
}
