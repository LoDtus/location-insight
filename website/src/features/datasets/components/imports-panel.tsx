"use client";

import { FileArchive, Loader2, RefreshCw, Save, Trash2, Upload } from "lucide-react";
import { useEffect, useId, useState, type ChangeEvent, type JSX } from "react";

import { BUTTON_DANGER, BUTTON_GHOST, BUTTON_PRIMARY, Badge, CheckList, EmptyNote, INPUT, Mono, Skeleton, type Tone } from "@/features/datasets/components/dataset-ui";
import { discardImport, getImport, listImports, saveImport, uploadPackage, type ImportJob, type ImportStatus } from "@/features/datasets/datasets.api";
import {
    IMPORT_STATUS_LABEL,
    datasetErrorMessage,
    formatBytes,
    formatDateTime,
    isImportRunning,
    precheckPackageFile,
    shortId,
    summarizeChecks,
} from "@/features/datasets/datasets.utils";
import { showToast } from "@/shared/components/toast/toast-store";

const POLL_MS = 3000;

const STATUS_TONE: Record<ImportStatus, Tone> = {
    uploaded: "muted",
    validating: "gold",
    validated: "green",
    rejected: "red",
    saving: "gold",
    saved: "green",
    discarded: "muted",
    failed: "red",
};

/** Nhập gói chuẩn: tải lên → kiểm tra ở nền → xem kết quả → Lưu hoặc Bỏ (research.md Bản ghi 12). */
export default function ImportsPanel({ onSaved }: { onSaved: () => void }): JSX.Element {
    const [jobs, setJobs] = useState<ImportJob[] | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const controller = new AbortController();
        listImports(controller.signal)
            .then((list) => {
                setJobs(list);
                setError(null);
            })
            .catch((failure: unknown) => {
                if (!(failure instanceof DOMException && failure.name === "AbortError")) setError(datasetErrorMessage(failure, "Không tải được danh sách gói."));
            });
        return () => controller.abort();
    }, [refreshKey]);

    const hasRunning = jobs?.some((job) => isImportRunning(job.status)) ?? false;
    useEffect(() => {
        if (!hasRunning) return;
        const timer = window.setInterval(() => setRefreshKey((key) => key + 1), POLL_MS);
        return () => window.clearInterval(timer);
    }, [hasRunning]);

    const selected = jobs?.find((job) => job.id === selectedId) ?? null;

    return (
        <div className="grid gap-4">
            <UploadBox
                onUploaded={(job) => {
                    setJobs((list) => [job, ...(list ?? [])]);
                    setSelectedId(job.id);
                }}
            />
            {error ? (
                <p role="alert" className="m-0 text-sm text-red-700">
                    {error}
                </p>
            ) : null}
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                <JobList jobs={jobs} selectedId={selectedId} onSelect={setSelectedId} onRefresh={() => setRefreshKey((key) => key + 1)} />
                {selected ? (
                    <JobDetail
                        key={selected.id}
                        summary={selected}
                        onChanged={(job) => {
                            setJobs((list) => (list ?? []).map((item) => (item.id === job.id ? job : item)));
                            if (job.status === "saved") onSaved();
                        }}
                    />
                ) : (
                    <EmptyNote>Chọn một gói để xem kết quả kiểm tra.</EmptyNote>
                )}
            </div>
        </div>
    );
}

function UploadBox({ onUploaded }: { onUploaded: (job: ImportJob) => void }): JSX.Element {
    const inputId = useId();
    const [pending, setPending] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);

    async function onFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        const precheck = await precheckPackageFile(file);
        setProblem(precheck);
        if (precheck) return;
        setPending(true);
        try {
            const job = await uploadPackage(file);
            onUploaded(job);
            showToast({ title: `Đã nhận gói ${job.layerCode}/${job.label}`, description: "Đang kiểm tra ở nền; kết quả hiện bên dưới." });
        } catch (failure) {
            setProblem(datasetErrorMessage(failure, "Không tải được gói. Thử lại."));
        } finally {
            setPending(false);
        }
    }

    return (
        <section aria-labelledby={`${inputId}-title`} className="rounded-lg border border-charcoal/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 id={`${inputId}-title`} className="m-0 text-base font-semibold">
                        Tải gói chuẩn
                    </h2>
                    <p className="m-0 mt-1 max-w-2xl text-sm text-charcoal/70">
                        Gói <Mono value="package.zip" /> do <Mono value="tools/data/package_tool.py pack" /> tạo. Lớp phải có sẵn ở tab Lớp dữ liệu. Gói chỉ vào
                        dữ liệu nền sau khi kiểm tra đạt và bạn bấm Lưu.
                    </p>
                </div>
                <label htmlFor={inputId} className={`${BUTTON_PRIMARY} cursor-pointer ${pending ? "pointer-events-none opacity-50" : ""}`}>
                    {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Upload size={15} aria-hidden />}
                    {pending ? "Đang tải lên…" : "Chọn gói .zip"}
                </label>
                <input
                    id={inputId}
                    type="file"
                    accept=".zip,application/zip"
                    className="sr-only"
                    disabled={pending}
                    onChange={(event) => void onFile(event)}
                />
            </div>
            {problem ? (
                <p role="alert" className="m-0 mt-3 text-sm text-red-700">
                    {problem}
                </p>
            ) : null}
        </section>
    );
}

function JobList({
    jobs,
    selectedId,
    onSelect,
    onRefresh,
}: {
    jobs: ImportJob[] | null;
    selectedId: string | null;
    onSelect: (id: string) => void;
    onRefresh: () => void;
}): JSX.Element {
    if (!jobs) return <Skeleton />;
    return (
        <section aria-label="Các gói đã tải" className="min-w-0">
            <div className="mb-2 flex items-center justify-between">
                <h2 className="m-0 text-sm font-semibold text-charcoal/80">Gói đã tải ({jobs.length})</h2>
                <button type="button" className={BUTTON_GHOST} onClick={onRefresh}>
                    <RefreshCw size={14} aria-hidden /> Làm mới
                </button>
            </div>
            {jobs.length === 0 ? (
                <EmptyNote>Chưa có gói nào. Tạo lớp rồi tải gói đầu tiên.</EmptyNote>
            ) : (
                <ul className="m-0 grid list-none gap-1.5 p-0">
                    {jobs.map((job) => (
                        <li key={job.id}>
                            <button
                                type="button"
                                onClick={() => onSelect(job.id)}
                                aria-pressed={job.id === selectedId}
                                className={`flex w-full items-start gap-3 rounded-lg border px-3 py-2 text-left text-sm focus-visible:outline-2 focus-visible:outline-green ${job.id === selectedId ? "border-green bg-green/5" : "border-charcoal/10 bg-white hover:bg-charcoal/[0.03]"}`}
                            >
                                <FileArchive size={18} className="mt-0.5 shrink-0 text-charcoal/50" aria-hidden />
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate font-semibold">
                                        {job.layerCode} / {job.label}
                                    </span>
                                    <span className="block text-xs text-charcoal/60 tabular-nums">
                                        {formatDateTime(job.createdAt)} · {formatBytes(job.sizeBytes)}
                                        {job.rowCount !== null ? ` · ${job.rowCount.toLocaleString("vi-VN")} dòng` : ""}
                                    </span>
                                </span>
                                <Badge tone={STATUS_TONE[job.status]}>
                                    {isImportRunning(job.status) ? <Loader2 size={12} className="mr-1 animate-spin" aria-hidden /> : null}
                                    {IMPORT_STATUS_LABEL[job.status]}
                                </Badge>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}

function JobDetail({ summary, onChanged }: { summary: ImportJob; onChanged: (job: ImportJob) => void }): JSX.Element {
    const [job, setJob] = useState<ImportJob>(summary);
    const [reason, setReason] = useState("");
    const [pending, setPending] = useState<"save" | "discard" | null>(null);
    const [confirmDiscard, setConfirmDiscard] = useState(false);
    const reasonId = useId();

    useEffect(() => {
        const controller = new AbortController();
        getImport(summary.id, controller.signal)
            .then(setJob)
            .catch(() => undefined);
        return () => controller.abort();
    }, [summary.id, summary.status]);

    const checks = summarizeChecks(job.checks);
    const canSave = job.status === "validated" && checks.blocking.length === 0;
    const needsReason = checks.warnings.length > 0;
    const canDiscard = ["uploaded", "validated", "rejected", "failed"].includes(job.status);

    async function run(action: "save" | "discard"): Promise<void> {
        setPending(action);
        try {
            const updated = action === "save" ? await saveImport(job.id, needsReason ? reason.trim() : undefined) : await discardImport(job.id);
            setJob(updated);
            onChanged(updated);
            setConfirmDiscard(false);
            showToast({
                title: action === "save" ? `Đã lưu ${updated.layerCode}/${updated.label}` : "Đã bỏ gói",
                description: action === "save" ? "Phiên bản lớp đã sẵn sàng; chọn nó trong bản nháp để phát hành." : undefined,
            });
        } catch (failure) {
            showToast({ title: "Chưa thực hiện được", description: datasetErrorMessage(failure, "Thử lại sau ít phút."), tone: "error" });
        } finally {
            setPending(null);
        }
    }

    return (
        <section aria-label={`Gói ${job.layerCode}/${job.label}`} className="min-w-0 rounded-lg border border-charcoal/10 p-4">
            <header className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    <h2 className="m-0 truncate text-base font-semibold">
                        {job.layerCode} / {job.label}
                    </h2>
                    <p className="m-0 mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-charcoal/65">
                        <span>
                            Khuôn <Mono value={job.contract} />
                        </span>
                        <span>
                            sha256 <Mono value={job.packageSha256} display={shortId(job.packageSha256)} />
                        </span>
                        <span>
                            commit <Mono value={job.manifest.pipeline.commit} display={job.manifest.pipeline.commit.slice(0, 8)} />
                        </span>
                    </p>
                </div>
                <Badge tone={STATUS_TONE[job.status]}>{IMPORT_STATUS_LABEL[job.status]}</Badge>
            </header>

            {job.error ? (
                <p role="alert" className="m-0 mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
                    {job.error}
                </p>
            ) : null}

            <h3 className="m-0 mt-4 mb-2 text-sm font-semibold">Kiểm tra</h3>
            {isImportRunning(job.status) ? <p className="m-0 text-sm text-charcoal/60">Đang kiểm tra ở nền…</p> : <CheckList checks={job.checks} />}

            {job.diffSummary ? <DiffView job={job} /> : null}
            <SourcesView job={job} />
            {job.preview && job.preview.length > 0 ? <PreviewTable rows={job.preview} /> : null}

            {canSave || canDiscard ? (
                <div className="mt-4 grid gap-3 border-t border-charcoal/10 pt-4">
                    {canSave && needsReason ? (
                        <div className="grid gap-1.5">
                            <label htmlFor={reasonId} className="text-sm font-semibold">
                                Lý do chấp nhận cảnh báo
                            </label>
                            <textarea id={reasonId} rows={2} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} className={`${INPUT} resize-none`} />
                        </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                        {canSave ? (
                            <button
                                type="button"
                                className={BUTTON_PRIMARY}
                                disabled={pending !== null || (needsReason && reason.trim().length < 3)}
                                onClick={() => void run("save")}
                            >
                                {pending === "save" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <Save size={15} aria-hidden />}
                                Lưu thành phiên bản {job.label}
                            </button>
                        ) : null}
                        {canDiscard && !confirmDiscard ? (
                            <button type="button" className={BUTTON_DANGER} disabled={pending !== null} onClick={() => setConfirmDiscard(true)}>
                                <Trash2 size={15} aria-hidden /> Bỏ gói
                            </button>
                        ) : null}
                        {confirmDiscard ? (
                            <span className="inline-flex flex-wrap items-center gap-2 text-sm">
                                Bỏ {job.layerCode}/{job.label}? Dữ liệu tạm bị xóa, gói xóa khỏi kho sau 30 ngày.
                                <button type="button" className={BUTTON_DANGER} disabled={pending !== null} onClick={() => void run("discard")}>
                                    Xác nhận bỏ
                                </button>
                                <button type="button" className={BUTTON_GHOST} onClick={() => setConfirmDiscard(false)}>
                                    Hủy
                                </button>
                            </span>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </section>
    );
}

function DiffView({ job }: { job: ImportJob }): JSX.Element | null {
    const diff = job.diffSummary;
    if (!diff) return null;
    const categories = Object.entries(diff.byCategory).sort(([a], [b]) => a.localeCompare(b));
    return (
        <>
            <h3 className="m-0 mt-4 mb-2 text-sm font-semibold">So với bản đang phát hành</h3>
            <p className="m-0 text-sm text-charcoal/80 tabular-nums">
                {diff.baseRowCount === null
                    ? `Lớp chưa có trong bản phát hành; ${diff.rowCount.toLocaleString("vi-VN")} dòng.`
                    : `${diff.baseRowCount.toLocaleString("vi-VN")} → ${diff.rowCount.toLocaleString("vi-VN")} dòng` +
                      (diff.added !== null ? ` · thêm ${diff.added.toLocaleString("vi-VN")}, bớt ${(diff.removed ?? 0).toLocaleString("vi-VN")}` : "")}
            </p>
            {categories.length > 0 ? (
                <div className="mt-2 overflow-x-auto">
                    <table className="w-full min-w-[20rem] border-collapse text-sm">
                        <thead className="text-left text-xs text-charcoal/60">
                            <tr>
                                <th className="py-1 pr-3 font-semibold">Loại</th>
                                <th className="py-1 pr-3 text-right font-semibold">Trước</th>
                                <th className="py-1 text-right font-semibold">Sau</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(([category, value]) => (
                                <tr key={category} className="border-t border-charcoal/10">
                                    <td className="py-1 pr-3">
                                        <Mono value={category} />
                                    </td>
                                    <td className="py-1 pr-3 text-right tabular-nums">{value.before.toLocaleString("vi-VN")}</td>
                                    <td className="py-1 text-right tabular-nums">{value.after.toLocaleString("vi-VN")}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </>
    );
}

function SourcesView({ job }: { job: ImportJob }): JSX.Element {
    const { manifest } = job;
    return (
        <>
            <h3 className="m-0 mt-4 mb-2 text-sm font-semibold">Nguồn gốc (khai trong manifest)</h3>
            <ul className="m-0 grid list-none gap-1 p-0 text-sm text-charcoal/80">
                {manifest.sources.map((source) => (
                    <li key={source.catalog} className="break-all">
                        <Mono value={source.catalog} /> · {source.license}
                    </li>
                ))}
                <li>
                    Script <Mono value={manifest.pipeline.tool} />
                    {manifest.pipeline.dirty ? <span className="ml-2 text-xs text-red-700">(có thay đổi chưa commit)</span> : null}
                </li>
                {manifest.manualSteps.map((step) => (
                    <li key={step}>Làm tay: {step}</li>
                ))}
            </ul>
        </>
    );
}

function PreviewTable({ rows }: { rows: Array<Record<string, unknown>> }): JSX.Element {
    const columns = Object.keys(rows[0] ?? {});
    return (
        <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold">Xem {rows.length} dòng đầu</summary>
            <div className="mt-2 max-h-80 overflow-auto rounded-md border border-charcoal/10">
                <table className="w-full border-collapse text-xs">
                    <thead className="sticky top-0 bg-white text-left text-charcoal/60">
                        <tr>
                            {columns.map((column) => (
                                <th key={column} className="px-2 py-1 font-semibold whitespace-nowrap">
                                    {column}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row, index) => (
                            <tr key={index} className="border-t border-charcoal/10">
                                {columns.map((column) => (
                                    <td key={column} className="max-w-60 truncate px-2 py-1 font-mono" title={cellText(row[column])}>
                                        {cellText(row[column])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </details>
    );
}

function cellText(value: unknown): string {
    if (value === null || value === undefined) return "";
    return typeof value === "object" ? JSON.stringify(value) : String(value);
}
