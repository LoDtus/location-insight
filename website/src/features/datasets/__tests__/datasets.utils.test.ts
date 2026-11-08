import { describe, expect, it } from "vitest";

import { AuthApiError } from "@/features/auth/auth.api";
import type { DatasetLayer, LayerVersion, QualityCheck } from "@/features/datasets/datasets.api";
import { datasetErrorMessage, formatBytes, isImportRunning, precheckPackageFile, readyVersions, shortId, summarizeChecks, ZIP_MAX_BYTES } from "@/features/datasets/datasets.utils";

function check(code: string, severity: QualityCheck["severity"], status: QualityCheck["status"]): QualityCheck {
    return { code, severity, status, expected: "", observed: "" };
}

function version(overrides: Partial<LayerVersion>): LayerVersion {
    return {
        id: "v",
        label: "2026-11-01",
        status: "ready",
        rowCount: 1,
        packageSha256: "a".repeat(64),
        integrityOk: true,
        integrityCheckedAt: null,
        createdAt: "2026-11-01T00:00:00Z",
        readyAt: "2026-11-01T00:00:00Z",
        retiredAt: null,
        diffSummary: null,
        checks: [],
        acceptedWarnings: null,
        sources: [],
        inReleases: [],
        ...overrides,
    };
}

function layer(usage: DatasetLayer["usage"], versions: LayerVersion[]): DatasetLayer {
    return { code: "osm.places", geometryKind: "point", contract: "point@1", sourceCode: "osm", usage, attribution: "", description: "", usageReason: null, createdAt: "", versions };
}

function zipFile(bytes: number[], name = "package.zip", size?: number): File {
    const file = new File([new Uint8Array(bytes)], name, { type: "application/zip" });
    if (size !== undefined) Object.defineProperty(file, "size", { value: size });
    return file;
}

describe("summarizeChecks", () => {
    it("tách lỗi chặn, cảnh báo và đếm số đạt", () => {
        const summary = summarizeChecks([check("a", "blocking", "fail"), check("b", "warning", "fail"), check("c", "blocking", "pass"), check("d", "warning", "pass")]);
        expect(summary.blocking.map((item) => item.code)).toEqual(["a"]);
        expect(summary.warnings.map((item) => item.code)).toEqual(["b"]);
        expect(summary.passed).toBe(2);
    });
});

describe("precheckPackageFile (kiểm sơ bộ trước khi tải; server kiểm lại)", () => {
    it("nhận zip có chữ ký PK", async () => {
        expect(await precheckPackageFile(zipFile([0x50, 0x4b, 0x03, 0x04, 0]))).toBeNull();
    });

    it("từ chối đuôi khác .zip, tệp rỗng, tệp quá lớn và tệp đổi đuôi", async () => {
        expect(await precheckPackageFile(zipFile([0x50, 0x4b, 0x03, 0x04], "data.csv"))).toMatch(/package\.zip/);
        expect(await precheckPackageFile(zipFile([]))).toMatch(/rỗng/);
        expect(await precheckPackageFile(zipFile([0x50, 0x4b, 0x03, 0x04], "package.zip", ZIP_MAX_BYTES + 1))).toMatch(/vượt/);
        expect(await precheckPackageFile(zipFile([0x25, 0x50, 0x44, 0x46]))).toMatch(/không phải zip/);
    });
});

describe("readyVersions", () => {
    it("chỉ lấy phiên bản ready còn toàn vẹn", () => {
        const versions = [version({ id: "1" }), version({ id: "2", status: "retired" }), version({ id: "3", integrityOk: false }), version({ id: "4", integrityOk: null })];
        expect(readyVersions(layer("public", versions)).map((item) => item.id)).toEqual(["1", "4"]);
    });

    it("lớp bị chặn không có phiên bản nào để chọn", () => {
        expect(readyVersions(layer("blocked", [version({})]))).toEqual([]);
    });
});

describe("tiện ích hiển thị", () => {
    it("formatBytes", () => {
        expect(formatBytes(512)).toBe("512 B");
        expect(formatBytes(1536)).toMatch(/^1,5 KB$/);
        expect(formatBytes(200 * 1024 * 1024)).toBe("200 MB");
        expect(formatBytes(-1)).toBe("—");
    });

    it("shortId giữ đầu và cuối", () => {
        expect(shortId("0123456789abcdef")).toBe("01234567…cdef");
        expect(shortId("short")).toBe("short");
    });

    it("isImportRunning", () => {
        expect(isImportRunning("validating")).toBe(true);
        expect(isImportRunning("validated")).toBe(false);
    });

    it("datasetErrorMessage hiện lý do nghiệp vụ nhưng giấu lỗi 5xx", () => {
        expect(datasetErrorMessage(new AuthApiError("Gói này đã được nhập.", 409), "x")).toBe("Gói này đã được nhập.");
        expect(datasetErrorMessage(new AuthApiError("stack trace", 500), "Lỗi chung")).toBe("Lỗi chung");
        expect(datasetErrorMessage(new Error("boom"), "Lỗi chung")).toBe("Lỗi chung");
    });
});
