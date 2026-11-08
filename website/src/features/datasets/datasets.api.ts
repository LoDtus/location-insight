import { AuthApiError, apiRequest } from "@/features/auth/auth.api";

/** API dữ liệu nền (018-location-data, interfaces/rest-api.yml). Chỉ admin. */

export type ReleaseKind = "data" | "criteria" | "rollback" | "hotfix";
export type ReleaseStatus = "draft" | "published" | "withdrawn" | "abandoned";
export type ContractId = "point@1" | "line@1" | "area@1" | "grid@1";
export type LayerUsage = "public" | "internal" | "blocked";
export type LayerVersionStatus = "building" | "ready" | "retired";
export type ImportStatus = "uploaded" | "validating" | "validated" | "rejected" | "saving" | "saved" | "discarded" | "failed";

export interface QualityCheck {
    code: string;
    severity: "blocking" | "warning";
    status: "pass" | "fail";
    expected: string;
    observed: string;
}

export interface DiffSummary {
    baseLayerVersionId: string | null;
    baseRowCount: number | null;
    rowCount: number;
    added: number | null;
    removed: number | null;
    byCategory: Record<string, { before: number; after: number }>;
}

export interface DatasetRelease {
    version: number;
    kind: ReleaseKind;
    status: ReleaseStatus;
    baseVersion: number | null;
    note: string;
    criteriaHash: string | null;
    backendCommit: string | null;
    createdBy: string | null;
    releasedBy: string | null;
    releasedAt: string | null;
    withdrawnAt: string | null;
    withdrawReason: string | null;
    layerCount: number;
    current: boolean;
}

export interface ReleaseLayer {
    layerCode: string;
    layerVersionId: string;
    label: string | null;
    status: string | null;
    rowCount: number | null;
    changedFromCurrent: boolean;
    diffSummary: DiffSummary | null;
    warnings: string[];
}

export interface DatasetReleaseDetail extends DatasetRelease {
    layers: ReleaseLayer[];
    checks: QualityCheck[];
    goldenReport: Record<string, unknown> | null;
    criteriaChanged: Array<{ criterionId: string; change: "added" | "removed" | "changed" }>;
}

export interface LayerVersion {
    id: string;
    label: string;
    status: LayerVersionStatus;
    rowCount: number | null;
    packageSha256: string;
    integrityOk: boolean | null;
    integrityCheckedAt: string | null;
    createdAt: string;
    readyAt: string | null;
    retiredAt: string | null;
    diffSummary: DiffSummary | null;
    checks: QualityCheck[];
    acceptedWarnings: string | null;
    sources: Array<{ catalog: string; license: string }>;
    inReleases: number[];
}

export interface DatasetLayer {
    code: string;
    geometryKind: "point" | "line" | "area" | "grid";
    contract: ContractId;
    sourceCode: string;
    usage: LayerUsage;
    attribution: string;
    description: string;
    usageReason: string | null;
    createdAt: string;
    versions: LayerVersion[];
}

export interface PackageManifest {
    contract: ContractId;
    layer: string;
    label: string;
    sourceDate: string | null;
    crs: string;
    sources: Array<{ catalog: string; url: string; sha256: string; license: string }>;
    pipeline: { tool: string; commit: string; dirty: boolean };
    manualSteps: string[];
    rowCount: number;
    categories: Record<string, number>;
    dataSha256: string;
    gridCode: string | null;
    params: Record<string, string | number | boolean>;
    notes: string;
}

export interface ImportJob {
    id: string;
    layerCode: string;
    label: string;
    contract: ContractId;
    purpose: "new" | "restore";
    status: ImportStatus;
    packageSha256: string;
    sizeBytes: number;
    manifest: PackageManifest;
    checks: QualityCheck[];
    diffSummary: DiffSummary | null;
    preview: Array<Record<string, unknown>> | null;
    rowCount: number | null;
    error: string | null;
    uploadedBy: string;
    decidedBy: string | null;
    acceptedWarnings: string | null;
    layerVersionId: string | null;
    createdAt: string;
    finishedAt: string | null;
}

interface UploadTicket {
    uploadId: string;
    url: string;
    method: "PUT";
    headers: Record<string, string>;
    expiresAt: string;
    maxBytes: number;
}

// ───────────────────────────── bản phát hành ─────────────────────────────

export function listReleases(signal?: AbortSignal): Promise<DatasetRelease[]> {
    return apiRequest("/admin/map/dataset-versions", signal ? { signal } : {});
}

export function getRelease(version: number, signal?: AbortSignal): Promise<DatasetReleaseDetail> {
    return apiRequest(`/admin/map/dataset-versions/${version}`, signal ? { signal } : {});
}

export function createDraft(kind: Exclude<ReleaseKind, "rollback">, note: string): Promise<DatasetReleaseDetail> {
    return apiRequest("/admin/map/dataset-versions", { method: "POST", body: JSON.stringify({ kind, note }) });
}

export function setDraftLayer(version: number, layerCode: string, layerVersionId: string): Promise<DatasetReleaseDetail> {
    return apiRequest(`/admin/map/dataset-versions/${version}/layers/${encodeURIComponent(layerCode)}`, {
        method: "PUT",
        body: JSON.stringify({ layerVersionId }),
    });
}

export function removeDraftLayer(version: number, layerCode: string): Promise<DatasetReleaseDetail> {
    return apiRequest(`/admin/map/dataset-versions/${version}/layers/${encodeURIComponent(layerCode)}`, { method: "DELETE" });
}

export function abandonDraft(version: number): Promise<DatasetRelease> {
    return apiRequest(`/admin/map/dataset-versions/${version}`, { method: "DELETE" });
}

export function publishRelease(version: number, acceptWarnings?: string): Promise<DatasetRelease> {
    return apiRequest(`/admin/map/dataset-versions/${version}/publish`, {
        method: "POST",
        body: JSON.stringify(acceptWarnings ? { acceptWarnings } : {}),
    });
}

export function withdrawRelease(version: number, reason: string, baseVersion: number): Promise<DatasetRelease> {
    return apiRequest(`/admin/map/dataset-versions/${version}/withdraw`, { method: "POST", body: JSON.stringify({ reason, baseVersion }) });
}

// ───────────────────────────── lớp ─────────────────────────────

export function listLayers(signal?: AbortSignal): Promise<DatasetLayer[]> {
    return apiRequest("/admin/map/layers", signal ? { signal } : {});
}

export interface CreateLayerInput {
    code: string;
    contract: ContractId;
    sourceCode: string;
    usage: Exclude<LayerUsage, "blocked">;
    attribution: string;
    description?: string;
}

export function createLayer(input: CreateLayerInput): Promise<DatasetLayer> {
    return apiRequest("/admin/map/layers", { method: "POST", body: JSON.stringify(input) });
}

export function updateLayerUsage(code: string, usage: LayerUsage, reason: string): Promise<DatasetLayer> {
    return apiRequest(`/admin/map/layers/${encodeURIComponent(code)}`, { method: "PATCH", body: JSON.stringify({ usage, reason }) });
}

// ───────────────────────────── nhập gói ─────────────────────────────

export function listImports(signal?: AbortSignal): Promise<ImportJob[]> {
    return apiRequest("/admin/map/imports", signal ? { signal } : {});
}

export function getImport(jobId: string, signal?: AbortSignal): Promise<ImportJob> {
    return apiRequest(`/admin/map/imports/${encodeURIComponent(jobId)}`, signal ? { signal } : {});
}

export function saveImport(jobId: string, acceptWarnings?: string): Promise<ImportJob> {
    return apiRequest(`/admin/map/imports/${encodeURIComponent(jobId)}/save`, {
        method: "POST",
        body: JSON.stringify(acceptWarnings ? { acceptWarnings } : {}),
    });
}

export function discardImport(jobId: string): Promise<ImportJob> {
    return apiRequest(`/admin/map/imports/${encodeURIComponent(jobId)}/discard`, { method: "POST" });
}

/**
 * Tải gói: xin phiếu (URL ký sẵn) → PUT thẳng lên kho → báo backend nhận gói. Đi thẳng lên kho để không vướng
 * giới hạn kích thước body của proxy website.
 */
export async function uploadPackage(file: File): Promise<ImportJob> {
    const ticket = await apiRequest<UploadTicket>("/admin/map/imports/upload-tickets", {
        method: "POST",
        body: JSON.stringify({ sizeBytes: file.size }),
    });
    const uploaded = await fetch(ticket.url, { method: ticket.method, headers: ticket.headers, body: file });
    if (!uploaded.ok) throw new AuthApiError("Chưa tải được gói lên kho.", uploaded.status);
    return apiRequest("/admin/map/imports", { method: "POST", body: JSON.stringify({ uploadId: ticket.uploadId }) });
}
