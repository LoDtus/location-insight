"use client";

import { Loader2, Rocket } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type JSX } from "react";

import { isAbortError, listDatasetVersions, mapErrorMessage, releaseDatasetVersion } from "@/features/map/map.service";
import type { DatasetVersion } from "@/features/map/map.types";
import { showToast } from "@/shared/components/toast/toast-store";

/**
 * Admin: phiên bản bộ dữ liệu đánh giá địa điểm. Nâng phiên bản sau khi đã cập nhật dữ liệu nền.
 * Lượt đánh giá cũ của người dùng không tự cập nhật; họ thấy "có dữ liệu mới" và tự bấm "Đánh giá lại".
 */
export default function MapDatasetVersions(): JSX.Element {
    const [items, setItems] = useState<DatasetVersion[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [note, setNote] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [pending, setPending] = useState(false);
    const noteId = useId();

    useEffect(() => {
        const controller = new AbortController();
        listDatasetVersions(controller.signal)
            .then(setItems)
            .catch((failure: unknown) => {
                if (!isAbortError(failure)) setError(mapErrorMessage(failure, "Không tải được phiên bản dữ liệu."));
            });
        return () => controller.abort();
    }, []);

    const current = items?.find((item) => item.current) ?? null;
    const valid = note.trim().length >= 3;

    async function release(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!valid) return;
        if (!confirming) {
            setConfirming(true);
            return;
        }
        setPending(true);
        setError(null);
        try {
            const created = await releaseDatasetVersion(note.trim());
            setItems((list) => [created, ...(list ?? []).map((item) => ({ ...item, current: false }))]);
            setNote("");
            setConfirming(false);
            showToast({ title: `Đã phát hành dữ liệu v${created.version}`, description: "Lượt đánh giá mới của người dùng sẽ theo phiên bản này." });
        } catch (failure) {
            const message = mapErrorMessage(failure, "Không phát hành được phiên bản mới.");
            setError(message);
            showToast({ title: "Chưa phát hành được", description: message, tone: "error" });
        } finally {
            setPending(false);
        }
    }

    return (
        <section aria-labelledby={`${noteId}-title`} className="border-t border-charcoal/10 pt-3">
            <h3 id={`${noteId}-title`} className="m-0 text-sm font-semibold">
                Phiên bản dữ liệu đánh giá
            </h3>
            {error ? (
                <p role="alert" className="m-0 mt-1 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
            {!items && !error ? <div className="mt-2 h-10 animate-pulse rounded-md bg-charcoal/5 motion-reduce:animate-none" /> : null}
            {current ? (
                <p className="m-0 mt-1 text-sm text-charcoal/75">
                    Hiện hành: <b>v{current.version}</b> · {new Date(current.releasedAt).toLocaleDateString("vi-VN")}
                </p>
            ) : null}
            <form onSubmit={(event) => void release(event)} className="mt-2 grid gap-2">
                <label htmlFor={noteId} className="text-xs font-semibold text-charcoal/70">
                    Ghi chú phát hành
                </label>
                <textarea
                    id={noteId}
                    value={note}
                    maxLength={500}
                    rows={2}
                    placeholder="Ví dụ: Cập nhật OSM 11/2026, thêm lớp WorldPop R2025A"
                    onChange={(event) => {
                        setNote(event.target.value);
                        setConfirming(false);
                    }}
                    className="w-full resize-none rounded-md border border-charcoal/15 bg-white px-2.5 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green"
                />
                {confirming ? (
                    <p className="m-0 rounded-md bg-gold/15 px-2.5 py-1.5 text-xs text-charcoal/85">
                        Phát hành v{(current?.version ?? 0) + 1}? Không hoàn tác được. Kết quả cũ của người dùng giữ nguyên; họ sẽ thấy có dữ liệu mới.
                    </p>
                ) : null}
                <div className="flex gap-2">
                    <button
                        type="submit"
                        disabled={!valid || pending || !items}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-md bg-charcoal px-3 text-xs font-semibold text-white hover:bg-charcoal/90 disabled:opacity-50"
                    >
                        {pending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Rocket size={14} aria-hidden />}
                        {confirming ? "Xác nhận phát hành" : "Phát hành phiên bản mới"}
                    </button>
                    {confirming ? (
                        <button
                            type="button"
                            onClick={() => setConfirming(false)}
                            className="inline-flex min-h-9 items-center rounded-md px-3 text-xs font-semibold text-charcoal/70 hover:bg-charcoal/5"
                        >
                            Hủy
                        </button>
                    ) : null}
                </div>
            </form>
            {items && items.length > 0 ? (
                <ol className="m-0 mt-3 grid list-none gap-1.5 p-0">
                    {items.slice(0, 5).map((item) => (
                        <li key={item.version} className="text-xs text-charcoal/70">
                            <b className="text-charcoal">v{item.version}</b> · {new Date(item.releasedAt).toLocaleDateString("vi-VN")} · {item.note}
                        </li>
                    ))}
                </ol>
            ) : null}
        </section>
    );
}
