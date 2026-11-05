"use client";

import { Check, Database, History, Loader2, PackageCheck, RefreshCw, Rocket, RotateCcw, Upload } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type JSX, type KeyboardEvent } from "react";

import { DATASET_SOURCES, SOURCE_STATUS_LABEL, type DatasetSource, type SourceStatus } from "@/features/datasets/dataset-sources";
import { isAbortError, listDatasetVersions, mapErrorMessage, releaseDatasetVersion } from "@/features/map/map.service";
import type { DatasetVersion } from "@/features/map/map.types";
import { showToast } from "@/shared/components/toast/toast-store";

type Tab = "versions" | "sources" | "release";

const TABS: { id: Tab; label: string; icon: typeof Database }[] = [
    { id: "versions", label: "Phiên bản", icon: History },
    { id: "sources", label: "Nguồn dữ liệu", icon: Database },
    { id: "release", label: "Chốt phát hành", icon: PackageCheck },
];

const STATUS_CLASS: Record<SourceStatus, string> = {
    active: "bg-green/10 text-green",
    staged: "bg-gold/20 text-charcoal",
    missing: "bg-charcoal/5 text-charcoal/60",
    reference: "bg-charcoal/5 text-charcoal/75",
};

function formatDate(iso: string): string {
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const BUTTON_PRIMARY =
    "inline-flex min-h-9 items-center gap-1.5 rounded-md bg-charcoal px-3 text-sm font-semibold text-white hover:bg-charcoal/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-50";
const BUTTON_GHOST =
    "inline-flex min-h-9 items-center gap-1.5 rounded-md border border-charcoal/15 bg-white px-3 text-sm font-semibold text-charcoal hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-50";

/** Chưa có backend: báo rõ thay vì giả vờ chạy. */
function notYet(action: string): void {
    showToast({ title: `${action}: sắp có`, description: "Giao diện đã sẵn; chức năng sẽ nối backend ở bước sau.", tone: "info" });
}

/**
 * Admin › Dữ liệu đánh giá. Quản lý phiên bản bộ dữ liệu dùng cho "Đánh giá địa điểm":
 * xem/phát hành phiên bản (đã nối API), danh mục nguồn dữ liệu, chốt phát hành, quay về phiên bản cũ (UI).
 */
export default function DatasetConsole(): JSX.Element {
    const [tab, setTab] = useState<Tab>("versions");
    const [versions, setVersions] = useState<DatasetVersion[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const baseId = useId();

    useEffect(() => {
        const controller = new AbortController();
        listDatasetVersions(controller.signal)
            .then(setVersions)
            .catch((failure: unknown) => {
                if (!isAbortError(failure)) setError(mapErrorMessage(failure, "Không tải được phiên bản dữ liệu."));
            });
        return () => controller.abort();
    }, []);

    const current = versions?.find((item) => item.current) ?? null;
    const staged = DATASET_SOURCES.filter((source) => source.status === "staged").length;

    function onTabKey(event: KeyboardEvent<HTMLDivElement>): void {
        const index = TABS.findIndex((item) => item.id === tab);
        const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : null;
        if (next === null) return;
        event.preventDefault();
        const target = TABS[(next + TABS.length) % TABS.length];
        setTab(target.id);
        document.getElementById(`${baseId}-tab-${target.id}`)?.focus();
    }

    return (
        <div className="box-border w-full px-4 py-5 sm:px-6">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="m-0 text-2xl font-semibold">Dữ liệu đánh giá</h1>
                    <p className="m-0 mt-1 max-w-2xl text-sm text-charcoal/70">
                        Bộ dữ liệu nền mà AI dùng để đánh giá địa điểm. Phát hành phiên bản mới không tự đánh giá lại; người dùng thấy “có dữ liệu mới” và
                        tự bấm “Đánh giá lại”.
                    </p>
                </div>
                <dl className="m-0 flex gap-6 text-sm">
                    <div>
                        <dt className="text-charcoal/60">Hiện hành</dt>
                        <dd className="m-0 text-lg font-semibold tabular-nums">{current ? `v${current.version}` : "–"}</dd>
                    </div>
                    <div>
                        <dt className="text-charcoal/60">Nguồn có bản mới</dt>
                        <dd className="m-0 text-lg font-semibold tabular-nums">{staged}</dd>
                    </div>
                </dl>
            </header>

            {error ? (
                <p role="alert" className="m-0 mt-3 text-sm text-red-700">
                    {error}
                </p>
            ) : null}

            <div role="tablist" aria-label="Quản lý dữ liệu" onKeyDown={onTabKey} className="mt-5 flex gap-1 border-b border-charcoal/10">
                {TABS.map((item) => (
                    <button
                        key={item.id}
                        id={`${baseId}-tab-${item.id}`}
                        type="button"
                        role="tab"
                        aria-selected={tab === item.id}
                        aria-controls={`${baseId}-panel-${item.id}`}
                        tabIndex={tab === item.id ? 0 : -1}
                        onClick={() => setTab(item.id)}
                        className={`-mb-px inline-flex min-h-10 items-center gap-2 border-b-2 bg-transparent px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green ${tab === item.id ? "border-green text-charcoal" : "border-transparent text-charcoal/60 hover:text-charcoal"}`}
                    >
                        <item.icon size={16} aria-hidden /> {item.label}
                    </button>
                ))}
            </div>

            <div role="tabpanel" id={`${baseId}-panel-${tab}`} aria-labelledby={`${baseId}-tab-${tab}`} className="pt-4">
                {tab === "versions" ? <VersionsTab versions={versions} /> : null}
                {tab === "sources" ? <SourcesTab /> : null}
                {tab === "release" ? (
                    <ReleaseTab
                        current={current}
                        onReleased={(created) => setVersions((list) => [created, ...(list ?? []).map((item) => ({ ...item, current: false }))])}
                    />
                ) : null}
            </div>
        </div>
    );
}

function VersionsTab({ versions }: { versions: DatasetVersion[] | null }): JSX.Element {
    const [confirm, setConfirm] = useState<number | null>(null);

    if (!versions) return <div className="h-40 animate-pulse rounded-lg bg-charcoal/5 motion-reduce:animate-none" />;
    return (
        <div className="overflow-x-auto rounded-lg border border-charcoal/10">
            <table className="w-full min-w-[40rem] border-collapse text-sm">
                <thead className="bg-charcoal/[0.03] text-left text-xs text-charcoal/60">
                    <tr>
                        <th className="px-3 py-2 font-semibold">Phiên bản</th>
                        <th className="px-3 py-2 font-semibold">Ghi chú phát hành</th>
                        <th className="px-3 py-2 font-semibold">Phát hành lúc</th>
                        <th className="px-3 py-2 text-right font-semibold">Thao tác</th>
                    </tr>
                </thead>
                <tbody>
                    {versions.map((item) => (
                        <tr key={item.version} className="border-t border-charcoal/10 align-top">
                            <td className="px-3 py-2.5">
                                <span className="font-semibold tabular-nums">v{item.version}</span>
                                {item.current ? <span className="ml-2 rounded bg-green/10 px-1.5 py-px text-xs font-semibold text-green">Hiện hành</span> : null}
                            </td>
                            <td className="max-w-md px-3 py-2.5 text-charcoal/80">{item.note || "—"}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap text-charcoal/70 tabular-nums">{formatDate(item.releasedAt)}</td>
                            <td className="px-3 py-2.5 text-right">
                                {item.current ? (
                                    <span className="text-xs text-charcoal/50">Đang dùng</span>
                                ) : confirm === item.version ? (
                                    <span className="inline-flex flex-wrap justify-end gap-1.5">
                                        <button
                                            type="button"
                                            className={BUTTON_PRIMARY}
                                            onClick={() => {
                                                setConfirm(null);
                                                notYet(`Quay về v${item.version}`);
                                            }}
                                        >
                                            Xác nhận quay về
                                        </button>
                                        <button type="button" className={BUTTON_GHOST} onClick={() => setConfirm(null)}>
                                            Hủy
                                        </button>
                                    </span>
                                ) : (
                                    <button type="button" className={BUTTON_GHOST} onClick={() => setConfirm(item.version)}>
                                        <RotateCcw size={14} aria-hidden /> Quay về phiên bản này
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            <p className="m-0 border-t border-charcoal/10 px-3 py-2 text-xs text-charcoal/60">
                Quay về (fallback) sẽ phát hành lại dữ liệu của phiên bản đã chọn thành phiên bản mới nhất; lượt đánh giá cũ của người dùng giữ nguyên.
            </p>
        </div>
    );
}

function SourcesTab(): JSX.Element {
    return (
        <div>
            <p className="m-0 mb-3 rounded-md bg-gold/15 px-3 py-2 text-xs text-charcoal/80">
                Dữ liệu mẫu: danh mục lấy theo tieu-chi.md; bản chụp và trạng thái chưa nối backend.
            </p>
            <div className="overflow-x-auto rounded-lg border border-charcoal/10">
                <table className="w-full min-w-[56rem] border-collapse text-sm">
                    <thead className="bg-charcoal/[0.03] text-left text-xs text-charcoal/60">
                        <tr>
                            <th className="px-3 py-2 font-semibold">Nguồn</th>
                            <th className="px-3 py-2 font-semibold">Dùng cho</th>
                            <th className="px-3 py-2 font-semibold">Bản đang dùng</th>
                            <th className="px-3 py-2 font-semibold">Bản mới</th>
                            <th className="px-3 py-2 font-semibold">Trạng thái</th>
                            <th className="px-3 py-2 text-right font-semibold">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {DATASET_SOURCES.map((source) => (
                            <SourceRow key={source.id} source={source} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SourceRow({ source }: { source: DatasetSource }): JSX.Element {
    return (
        <tr className="border-t border-charcoal/10 align-top">
            <td className="px-3 py-2.5">
                <span className="block font-semibold">{source.name}</span>
                <span className="block text-xs text-charcoal/55">
                    {source.license} · {source.cadence}
                </span>
            </td>
            <td className="px-3 py-2.5 text-charcoal/80">{source.covers}</td>
            <td className="px-3 py-2.5 tabular-nums">{source.snapshot ?? <span className="text-charcoal/45">—</span>}</td>
            <td className="px-3 py-2.5 tabular-nums">{source.staged ?? <span className="text-charcoal/45">—</span>}</td>
            <td className="px-3 py-2.5">
                <span className={`inline-flex rounded px-1.5 py-px text-xs font-semibold whitespace-nowrap ${STATUS_CLASS[source.status]}`}>
                    {SOURCE_STATUS_LABEL[source.status]}
                </span>
            </td>
            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                <span className="inline-flex gap-1.5">
                    <button type="button" className={BUTTON_GHOST} onClick={() => notYet(`Tải bản mới ${source.name}`)}>
                        <RefreshCw size={14} aria-hidden /> Tải bản mới
                    </button>
                    <button type="button" className={BUTTON_GHOST} onClick={() => notYet(`Nhập tệp cho ${source.name}`)} aria-label={`Nhập tệp cho ${source.name}`}>
                        <Upload size={14} aria-hidden />
                    </button>
                </span>
            </td>
        </tr>
    );
}

function ReleaseTab({ current, onReleased }: { current: DatasetVersion | null; onReleased: (created: DatasetVersion) => void }): JSX.Element {
    const usable = DATASET_SOURCES.filter((source) => source.status !== "missing");
    const [picked, setPicked] = useState<Set<string>>(() => new Set(usable.filter((source) => source.status === "staged").map((source) => source.id)));
    const [note, setNote] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [pending, setPending] = useState(false);
    const noteId = useId();
    const next = (current?.version ?? 0) + 1;
    const valid = note.trim().length >= 3;

    function toggle(id: string): void {
        setConfirming(false);
        setPicked((old) => {
            const copy = new Set(old);
            if (copy.has(id)) copy.delete(id);
            else copy.add(id);
            return copy;
        });
    }

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (!valid) return;
        if (!confirming) {
            setConfirming(true);
            return;
        }
        setPending(true);
        try {
            const created = await releaseDatasetVersion(note.trim());
            onReleased(created);
            setNote("");
            setConfirming(false);
            showToast({ title: `Đã phát hành dữ liệu v${created.version}`, description: "Lượt đánh giá mới (và Đánh giá lại) sẽ theo phiên bản này." });
        } catch (failure) {
            showToast({ title: "Chưa phát hành được", description: mapErrorMessage(failure, "Không phát hành được phiên bản mới."), tone: "error" });
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={(event) => void submit(event)} className="grid max-w-3xl gap-4">
            <fieldset className="m-0 rounded-lg border border-charcoal/10 p-0">
                <legend className="px-3 text-sm font-semibold">Nguồn đưa vào v{next}</legend>
                <p className="m-0 px-3 pt-1 text-xs text-charcoal/60">Chọn bản chụp mới cho từng nguồn (UI mẫu: lựa chọn chưa gửi lên backend).</p>
                <ul className="m-0 list-none p-0">
                    {usable.map((source) => {
                        const nextSnapshot = picked.has(source.id) && source.staged ? source.staged : source.snapshot;
                        return (
                            <li key={source.id} className="flex items-center gap-3 border-t border-charcoal/10 px-3 py-2 first:border-t-0">
                                <input
                                    id={`${noteId}-${source.id}`}
                                    type="checkbox"
                                    disabled={!source.staged}
                                    checked={picked.has(source.id)}
                                    onChange={() => toggle(source.id)}
                                    className="size-4 accent-green"
                                />
                                <label htmlFor={`${noteId}-${source.id}`} className="min-w-0 flex-1 text-sm">
                                    <span className="font-semibold">{source.name}</span>
                                    <span className="block text-xs text-charcoal/60 tabular-nums">
                                        {source.staged ? `${source.snapshot ?? "—"} → ${nextSnapshot ?? "—"}` : `Giữ ${source.snapshot ?? "—"} (không có bản mới)`}
                                    </span>
                                </label>
                                {picked.has(source.id) ? <Check size={16} className="text-green" aria-hidden /> : null}
                            </li>
                        );
                    })}
                </ul>
            </fieldset>

            <div className="grid gap-1.5">
                <label htmlFor={noteId} className="text-sm font-semibold">
                    Ghi chú phát hành
                </label>
                <textarea
                    id={noteId}
                    value={note}
                    maxLength={500}
                    rows={3}
                    placeholder="Ví dụ: Cập nhật OSM 01/11/2026, GTFS 02/10/2026"
                    onChange={(event) => {
                        setNote(event.target.value);
                        setConfirming(false);
                    }}
                    className="w-full resize-none rounded-md border border-charcoal/15 bg-white px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green"
                />
            </div>

            {confirming ? (
                <p className="m-0 rounded-md bg-gold/15 px-3 py-2 text-sm text-charcoal/85">
                    Phát hành v{next}? Không hoàn tác trực tiếp (dùng “Quay về phiên bản này” nếu cần). Kết quả cũ của người dùng giữ nguyên.
                </p>
            ) : null}
            <div className="flex gap-2">
                <button type="submit" disabled={!valid || pending || !current} className={BUTTON_PRIMARY}>
                    {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Rocket size={15} aria-hidden />}
                    {confirming ? `Xác nhận phát hành v${next}` : `Chốt và phát hành v${next}`}
                </button>
                {confirming ? (
                    <button type="button" className={BUTTON_GHOST} onClick={() => setConfirming(false)}>
                        Hủy
                    </button>
                ) : null}
            </div>
        </form>
    );
}
