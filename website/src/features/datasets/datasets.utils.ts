import { AuthApiError } from "@/features/auth/auth.api";
import type { DatasetLayer, ImportStatus, LayerUsage, QualityCheck, ReleaseKind, ReleaseStatus } from "@/features/datasets/datasets.api";

export const RELEASE_STATUS_LABEL: Record<ReleaseStatus, string> = {
    draft: "Bản nháp",
    published: "Đã phát hành",
    withdrawn: "Đã thu hồi",
    abandoned: "Đã bỏ",
};

export const RELEASE_KIND_LABEL: Record<ReleaseKind, string> = {
    data: "Dữ liệu",
    criteria: "Tiêu chí",
    rollback: "Thu hồi",
    hotfix: "Sửa gấp",
};

export const IMPORT_STATUS_LABEL: Record<ImportStatus, string> = {
    uploaded: "Chờ kiểm tra",
    validating: "Đang kiểm tra",
    validated: "Kiểm tra đạt",
    rejected: "Bị từ chối",
    saving: "Đang lưu",
    saved: "Đã lưu",
    discarded: "Đã bỏ",
    failed: "Lỗi",
};

export const USAGE_LABEL: Record<LayerUsage, string> = {
    public: "Công khai",
    internal: "Nội bộ",
    blocked: "Bị chặn",
};

/** Job còn đang chạy ở nền: giao diện hỏi lại định kỳ cho tới khi xong. */
export function isImportRunning(status: ImportStatus): boolean {
    return status === "uploaded" || status === "validating" || status === "saving";
}

export interface CheckSummary {
    blocking: QualityCheck[];
    warnings: QualityCheck[];
    passed: number;
}

export function summarizeChecks(checks: readonly QualityCheck[]): CheckSummary {
    return {
        blocking: checks.filter((check) => check.status === "fail" && check.severity === "blocking"),
        warnings: checks.filter((check) => check.status === "fail" && check.severity === "warning"),
        passed: checks.filter((check) => check.status === "pass").length,
    };
}

export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let value = bytes / 1024;
    let unit = 0;
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024;
        unit += 1;
    }
    return `${value.toLocaleString("vi-VN", { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}

export function formatDateTime(iso: string | null): string {
    if (!iso) return "—";
    const date = new Date(iso);
    return Number.isNaN(date.getTime())
        ? "—"
        : date.toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Rút gọn mã băm/ID ở giữa, giữ đầu và cuối để đối chiếu. */
export function shortId(value: string, head = 8, tail = 4): string {
    return value.length <= head + tail + 1 ? value : `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export const ZIP_MAX_BYTES = 200 * 1024 * 1024;

/** Kiểm sơ bộ trước khi tải (server kiểm lại): đuôi .zip, chữ ký PK\x03\x04, không vượt giới hạn. */
export async function precheckPackageFile(file: File): Promise<string | null> {
    if (!file.name.toLowerCase().endsWith(".zip")) return "Chọn tệp package.zip do tools/data/package_tool.py tạo.";
    if (file.size === 0) return "Tệp rỗng.";
    if (file.size > ZIP_MAX_BYTES) return `Gói vượt ${formatBytes(ZIP_MAX_BYTES)}.`;
    const head = await readHead(file, 4);
    const isZip = head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
    return isZip ? null : "Tệp không phải zip (sai chữ ký đầu tệp).";
}

function readHead(file: Blob, bytes: number): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result instanceof ArrayBuffer ? reader.result : new ArrayBuffer(0)));
        reader.onerror = () => reject(reader.error ?? new Error("Không đọc được tệp."));
        reader.readAsArrayBuffer(file.slice(0, bytes));
    });
}

/** Phiên bản ready mới nhất của mỗi lớp còn dùng được, để gợi ý khi dựng bản nháp. */
export function readyVersions(layer: DatasetLayer): DatasetLayer["versions"] {
    if (layer.usage === "blocked") return [];
    return layer.versions.filter((version) => version.status === "ready" && version.integrityOk !== false);
}

/** Admin cần thấy lý do nghiệp vụ (409/422…) do backend trả; lỗi 5xx chỉ hiện câu chung. */
export function datasetErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof AuthApiError && error.status < 500 && error.message) return error.message;
    return fallback;
}
