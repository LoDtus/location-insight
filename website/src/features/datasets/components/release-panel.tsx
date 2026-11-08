"use client";

import { FilePlus2, Loader2, RotateCcw, Rocket, Trash2 } from "lucide-react";
import { useEffect, useId, useState, type FormEvent, type JSX } from "react";

import { BUTTON_DANGER, BUTTON_GHOST, BUTTON_PRIMARY, Badge, CheckList, EmptyNote, INPUT, Mono, Skeleton, type Tone } from "@/features/datasets/components/dataset-ui";
import {
    abandonDraft,
    createDraft,
    getRelease,
    publishRelease,
    removeDraftLayer,
    setDraftLayer,
    withdrawRelease,
    type DatasetLayer,
    type DatasetRelease,
    type DatasetReleaseDetail,
    type ReleaseStatus,
} from "@/features/datasets/datasets.api";
import { RELEASE_KIND_LABEL, RELEASE_STATUS_LABEL, datasetErrorMessage, formatDateTime, readyVersions, shortId } from "@/features/datasets/datasets.utils";
import { showToast } from "@/shared/components/toast/toast-store";

const STATUS_TONE: Record<ReleaseStatus, Tone> = { draft: "gold", published: "green", withdrawn: "red", abandoned: "muted" };

/**
 * Bản phát hành: nháp → phát hành → thu hồi bằng bản mới (018-location-data). Lượt đánh giá cũ của người dùng giữ
 * nguyên bản đã ghim; người dùng tự bấm "Đánh giá lại".
 */
export default function ReleasePanel({
    releases,
    layers,
    onChanged,
}: {
    releases: DatasetRelease[] | null;
    layers: DatasetLayer[] | null;
    onChanged: () => void;
}): JSX.Element {
    const [selected, setSelected] = useState<number | null>(null);
    if (!releases) return <Skeleton />;
    const draft = releases.find((item) => item.status === "draft") ?? null;
    const shown = selected ?? draft?.version ?? releases.find((item) => item.current)?.version ?? null;

    return (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <section aria-label="Danh sách bản phát hành" className="min-w-0">
                {!draft ? <CreateDraftForm onCreated={(version) => { setSelected(version); onChanged(); }} /> : null}
                <ul className="m-0 mt-3 grid list-none gap-1.5 p-0">
                    {releases.map((item) => (
                        <li key={item.version}>
                            <button
                                type="button"
                                aria-pressed={item.version === shown}
                                onClick={() => setSelected(item.version)}
                                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-green ${item.version === shown ? "border-green bg-green/5" : "border-charcoal/10 bg-white hover:bg-charcoal/[0.03]"}`}
                            >
                                <span className="w-10 shrink-0 font-semibold tabular-nums">v{item.version}</span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate">{item.note || "—"}</span>
                                    <span className="block text-xs text-charcoal/60 tabular-nums">
                                        {RELEASE_KIND_LABEL[item.kind]} · {item.layerCount} lớp · {formatDateTime(item.releasedAt)}
                                    </span>
                                </span>
                                <span className="flex shrink-0 flex-col items-end gap-1">
                                    <Badge tone={STATUS_TONE[item.status]}>{RELEASE_STATUS_LABEL[item.status]}</Badge>
                                    {item.current ? <Badge tone="green">Hiện hành</Badge> : null}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            </section>
            {shown !== null ? (
                <ReleaseDetail key={shown} version={shown} releases={releases} layers={layers ?? []} onChanged={onChanged} />
            ) : (
                <EmptyNote>Chọn một bản để xem chi tiết.</EmptyNote>
            )}
        </div>
    );
}

function CreateDraftForm({ onCreated }: { onCreated: (version: number) => void }): JSX.Element {
    const [kind, setKind] = useState<"data" | "criteria" | "hotfix">("data");
    const [note, setNote] = useState("");
    const [pending, setPending] = useState(false);
    const id = useId();

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (note.trim().length < 3) return;
        setPending(true);
        try {
            const created = await createDraft(kind, note.trim());
            setNote("");
            onCreated(created.version);
        } catch (failure) {
            showToast({ title: "Chưa tạo được bản nháp", description: datasetErrorMessage(failure, "Thử lại."), tone: "error" });
        } finally {
            setPending(false);
        }
    }

    return (
        <form onSubmit={(event) => void submit(event)} className="grid gap-2 rounded-lg border border-charcoal/10 p-3">
            <p className="m-0 text-sm font-semibold">Tạo bản nháp (chép bảng kê từ bản hiện hành)</p>
            <div className="flex flex-wrap gap-2">
                <label htmlFor={`${id}-kind`} className="sr-only">
                    Loại bản
                </label>
                <select id={`${id}-kind`} value={kind} onChange={(event) => setKind(event.target.value as typeof kind)} className={`${INPUT} w-auto`}>
                    <option value="data">Dữ liệu mới</option>
                    <option value="criteria">Đổi tiêu chí</option>
                    <option value="hotfix">Sửa gấp</option>
                </select>
                <label htmlFor={`${id}-note`} className="sr-only">
                    Ghi chú
                </label>
                <input
                    id={`${id}-note`}
                    value={note}
                    maxLength={500}
                    placeholder="Ví dụ: OSM 01/11/2026"
                    onChange={(event) => setNote(event.target.value)}
                    className={`${INPUT} min-w-0 flex-1`}
                />
                <button type="submit" className={BUTTON_PRIMARY} disabled={pending || note.trim().length < 3}>
                    {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <FilePlus2 size={15} aria-hidden />} Tạo
                </button>
            </div>
        </form>
    );
}

function ReleaseDetail({
    version,
    releases,
    layers,
    onChanged,
}: {
    version: number;
    releases: DatasetRelease[];
    layers: DatasetLayer[];
    onChanged: () => void;
}): JSX.Element {
    const [detail, setDetail] = useState<DatasetReleaseDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const summary = releases.find((item) => item.version === version);

    useEffect(() => {
        const controller = new AbortController();
        getRelease(version, controller.signal)
            .then(setDetail)
            .catch((failure: unknown) => {
                if (!(failure instanceof DOMException && failure.name === "AbortError")) setError(datasetErrorMessage(failure, "Không tải được bản này."));
            });
        return () => controller.abort();
    }, [version, summary?.status, summary?.layerCount]);

    if (error) return <p role="alert" className="m-0 text-sm text-red-700">{error}</p>;
    if (!detail) return <Skeleton />;

    const refresh = (next: DatasetReleaseDetail | null): void => {
        if (next) setDetail(next);
        onChanged();
    };

    return (
        <section aria-label={`Bản v${detail.version}`} className="min-w-0 rounded-lg border border-charcoal/10 p-4">
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="m-0 text-base font-semibold">
                        v{detail.version} · {RELEASE_KIND_LABEL[detail.kind]}
                    </h2>
                    <p className="m-0 mt-1 text-sm text-charcoal/75">{detail.note}</p>
                    <p className="m-0 mt-1 flex flex-wrap gap-x-3 text-xs text-charcoal/60">
                        <span>Phát hành {formatDateTime(detail.releasedAt)}</span>
                        {detail.baseVersion ? <span>Gốc v{detail.baseVersion}</span> : null}
                        {detail.criteriaHash ? (
                            <span>
                                Tiêu chí <Mono value={detail.criteriaHash} display={shortId(detail.criteriaHash)} />
                            </span>
                        ) : null}
                        {detail.withdrawReason ? <span className="text-red-700">Thu hồi: {detail.withdrawReason}</span> : null}
                    </p>
                </div>
                <Badge tone={STATUS_TONE[detail.status]}>{RELEASE_STATUS_LABEL[detail.status]}</Badge>
            </header>

            <h3 className="m-0 mt-4 mb-2 text-sm font-semibold">Bảng kê lớp</h3>
            {detail.status === "draft" ? <DraftLayers detail={detail} layers={layers} onChanged={refresh} /> : <ManifestTable detail={detail} />}

            {detail.criteriaChanged.length > 0 ? (
                <>
                    <h3 className="m-0 mt-4 mb-2 text-sm font-semibold">Tiêu chí đổi so với bản hiện hành</h3>
                    <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                        {detail.criteriaChanged.map((item) => (
                            <li key={item.criterionId}>
                                <Badge tone={item.change === "removed" ? "red" : item.change === "added" ? "green" : "gold"}>
                                    {item.change === "added" ? "+" : item.change === "removed" ? "−" : "~"} {item.criterionId}
                                </Badge>
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}

            {detail.checks.length > 0 ? (
                <>
                    <h3 className="m-0 mt-4 mb-2 text-sm font-semibold">Kiểm tra lúc phát hành</h3>
                    <CheckList checks={detail.checks} />
                </>
            ) : null}
            {detail.goldenReport && detail.goldenReport.skipped === true ? (
                <p className="m-0 mt-2 text-xs text-charcoal/60">Điểm mẫu: chưa chạy ({String(detail.goldenReport.reason ?? "")}).</p>
            ) : null}

            {detail.status === "draft" ? <DraftActions detail={detail} onChanged={refresh} /> : null}
            {detail.current ? <WithdrawForm detail={detail} releases={releases} onChanged={refresh} /> : null}
        </section>
    );
}

function ManifestTable({ detail }: { detail: DatasetReleaseDetail }): JSX.Element {
    if (detail.layers.length === 0) return <p className="m-0 text-sm text-charcoal/60">Không có lớp nào: đánh giá chạy ở chế độ mẫu.</p>;
    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
                <thead className="text-left text-xs text-charcoal/60">
                    <tr>
                        <th className="py-1 pr-3 font-semibold">Lớp</th>
                        <th className="py-1 pr-3 font-semibold">Phiên bản</th>
                        <th className="py-1 pr-3 text-right font-semibold">Số dòng</th>
                        <th className="py-1 font-semibold">So với hiện hành</th>
                    </tr>
                </thead>
                <tbody>
                    {detail.layers.map((layer) => (
                        <tr key={layer.layerCode} className="border-t border-charcoal/10">
                            <td className="py-1.5 pr-3">
                                <Mono value={layer.layerCode} />
                            </td>
                            <td className="py-1.5 pr-3">
                                {layer.label ?? <Mono value={layer.layerVersionId} display={shortId(layer.layerVersionId)} />} {layer.status && layer.status !== "ready" ? <Badge tone="red">{layer.status}</Badge> : null}
                            </td>
                            <td className="py-1.5 pr-3 text-right tabular-nums">{layer.rowCount?.toLocaleString("vi-VN") ?? "—"}</td>
                            <td className="py-1.5">{layer.changedFromCurrent ? <Badge tone="gold">Khác</Badge> : <span className="text-xs text-charcoal/50">Giữ</span>}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function DraftLayers({ detail, layers, onChanged }: { detail: DatasetReleaseDetail; layers: DatasetLayer[]; onChanged: (next: DatasetReleaseDetail | null) => void }): JSX.Element {
    const [pendingLayer, setPendingLayer] = useState<string | null>(null);
    const inManifest = new Map(detail.layers.map((layer) => [layer.layerCode, layer]));
    const rows = layers.filter((layer) => inManifest.has(layer.code) || readyVersions(layer).length > 0);

    async function change(layerCode: string, layerVersionId: string): Promise<void> {
        setPendingLayer(layerCode);
        try {
            onChanged(layerVersionId ? await setDraftLayer(detail.version, layerCode, layerVersionId) : await removeDraftLayer(detail.version, layerCode));
        } catch (failure) {
            showToast({ title: "Chưa đổi được bảng kê", description: datasetErrorMessage(failure, "Thử lại."), tone: "error" });
        } finally {
            setPendingLayer(null);
        }
    }

    if (rows.length === 0) return <EmptyNote>Chưa có phiên bản lớp nào sẵn sàng. Tải và Lưu gói ở tab Nhập gói.</EmptyNote>;
    return (
        <ul className="m-0 grid list-none gap-2 p-0">
            {rows.map((layer) => {
                const current = inManifest.get(layer.code);
                const options = readyVersions(layer);
                const selectId = `draft-${detail.version}-${layer.code}`;
                return (
                    <li key={layer.code} className="grid items-center gap-2 sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
                        <label htmlFor={selectId}>
                            <Mono value={layer.code} />
                        </label>
                        <select
                            id={selectId}
                            value={current?.layerVersionId ?? ""}
                            disabled={pendingLayer !== null}
                            onChange={(event) => void change(layer.code, event.target.value)}
                            className={INPUT}
                        >
                            <option value="">— Không dùng lớp này —</option>
                            {current && !options.some((option) => option.id === current.layerVersionId) ? (
                                <option value={current.layerVersionId}>{current.label ?? shortId(current.layerVersionId)} (không còn ready)</option>
                            ) : null}
                            {options.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label} · {option.rowCount?.toLocaleString("vi-VN") ?? "—"} dòng · {formatDateTime(option.readyAt)}
                                </option>
                            ))}
                        </select>
                        <span className="text-xs">
                            {pendingLayer === layer.code ? <Loader2 size={14} className="animate-spin" aria-label="Đang lưu" /> : current?.changedFromCurrent ? <Badge tone="gold">Khác hiện hành</Badge> : null}
                        </span>
                    </li>
                );
            })}
        </ul>
    );
}

function DraftActions({ detail, onChanged }: { detail: DatasetReleaseDetail; onChanged: (next: DatasetReleaseDetail | null) => void }): JSX.Element {
    const [step, setStep] = useState<"idle" | "publish" | "abandon">("idle");
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState(false);
    const reasonId = useId();

    async function run(): Promise<void> {
        setPending(true);
        try {
            if (step === "publish") {
                const released = await publishRelease(detail.version, reason.trim() || undefined);
                showToast({ title: `Đã phát hành v${released.version}`, description: "Lượt đánh giá mới và “Đánh giá lại” dùng bản này." });
            } else {
                await abandonDraft(detail.version);
                showToast({ title: `Đã bỏ bản nháp v${detail.version}` });
            }
            setStep("idle");
            onChanged(null);
        } catch (failure) {
            showToast({ title: "Chưa thực hiện được", description: datasetErrorMessage(failure, "Thử lại."), tone: "error" });
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="mt-4 grid gap-3 border-t border-charcoal/10 pt-4">
            {step === "publish" ? (
                <div className="grid gap-1.5">
                    <p className="m-0 rounded-md bg-gold/15 px-3 py-2 text-sm">
                        Phát hành v{detail.version} với {detail.layers.length} lớp? Bản này thành hiện hành ngay; kết quả cũ của người dùng giữ nguyên. Không sửa
                        được bản đã phát hành, chỉ thu hồi bằng bản mới.
                    </p>
                    <label htmlFor={reasonId} className="text-sm font-semibold">
                        Lý do chấp nhận cảnh báo (nếu có)
                    </label>
                    <input id={reasonId} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} className={INPUT} />
                </div>
            ) : null}
            {step === "abandon" ? <p className="m-0 text-sm text-red-700">Bỏ bản nháp v{detail.version}? Số phiên bản không được dùng lại.</p> : null}
            <div className="flex flex-wrap gap-2">
                {step === "idle" ? (
                    <>
                        <button type="button" className={BUTTON_PRIMARY} onClick={() => setStep("publish")}>
                            <Rocket size={15} aria-hidden /> Phát hành v{detail.version}
                        </button>
                        <button type="button" className={BUTTON_DANGER} onClick={() => setStep("abandon")}>
                            <Trash2 size={15} aria-hidden /> Bỏ bản nháp
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" className={step === "publish" ? BUTTON_PRIMARY : BUTTON_DANGER} disabled={pending} onClick={() => void run()}>
                            {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
                            {step === "publish" ? `Xác nhận phát hành v${detail.version}` : "Xác nhận bỏ"}
                        </button>
                        <button type="button" className={BUTTON_GHOST} onClick={() => setStep("idle")}>
                            Hủy
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}

function WithdrawForm({ detail, releases, onChanged }: { detail: DatasetReleaseDetail; releases: DatasetRelease[]; onChanged: (next: DatasetReleaseDetail | null) => void }): JSX.Element | null {
    const bases = releases.filter((item) => item.status === "published" && item.version < detail.version);
    const [isOpen, setIsOpen] = useState(false);
    const [base, setBase] = useState<number | null>(bases[0]?.version ?? null);
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState(false);
    const id = useId();
    if (bases.length === 0) return null;

    async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        if (base === null || reason.trim().length < 3) return;
        setPending(true);
        try {
            const created = await withdrawRelease(detail.version, reason.trim(), base);
            showToast({ title: `Đã thu hồi v${detail.version}`, description: `Bản v${created.version} (theo v${base}) là hiện hành.` });
            setIsOpen(false);
            onChanged(null);
        } catch (failure) {
            showToast({ title: "Chưa thu hồi được", description: datasetErrorMessage(failure, "Thử lại."), tone: "error" });
        } finally {
            setPending(false);
        }
    }

    return (
        <div className="mt-4 border-t border-charcoal/10 pt-4">
            {!isOpen ? (
                <button type="button" className={BUTTON_DANGER} onClick={() => setIsOpen(true)}>
                    <RotateCcw size={15} aria-hidden /> Thu hồi bản này
                </button>
            ) : (
                <form onSubmit={(event) => void submit(event)} className="grid gap-2">
                    <p className="m-0 text-sm text-red-700">
                        Thu hồi v{detail.version}: tạo bản mới chép bảng kê và tiêu chí của bản gốc, phát hành ngay. Kết quả đã tính theo v{detail.version} được
                        gắn nhãn “nên đánh giá lại”.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
                        <label htmlFor={`${id}-base`} className="text-sm font-semibold sm:pt-2">
                            Quay về bản
                        </label>
                        <select id={`${id}-base`} value={base ?? ""} onChange={(event) => setBase(Number(event.target.value))} className={INPUT}>
                            {bases.map((item) => (
                                <option key={item.version} value={item.version}>
                                    v{item.version} · {item.note.slice(0, 60)}
                                </option>
                            ))}
                        </select>
                        <label htmlFor={`${id}-reason`} className="text-sm font-semibold sm:pt-2">
                            Lý do
                        </label>
                        <input id={`${id}-reason`} value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} className={INPUT} />
                    </div>
                    <div className="flex gap-2">
                        <button type="submit" className={BUTTON_DANGER} disabled={pending || reason.trim().length < 3}>
                            {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <RotateCcw size={15} aria-hidden />} Xác nhận thu hồi
                        </button>
                        <button type="button" className={BUTTON_GHOST} onClick={() => setIsOpen(false)}>
                            Hủy
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
}
