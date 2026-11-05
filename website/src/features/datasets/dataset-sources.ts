/**
 * Danh mục nguồn dữ liệu nền cho đánh giá địa điểm (theo workspace/features/000-ideas/tieu-chi.md và
 * nguon-du-lieu.md). GIAI ĐOẠN UI: số liệu bản chụp và trạng thái là dữ liệu mẫu, chưa nối backend.
 */
export type SourceStatus = "active" | "staged" | "missing" | "reference";

export interface DatasetSource {
    id: string;
    name: string;
    /** Dùng cho tiêu chí nào. */
    covers: string;
    license: string;
    cadence: string;
    status: SourceStatus;
    /** Bản chụp đang dùng (mẫu). */
    snapshot: string | null;
    /** Bản chụp mới đã tải về nhưng chưa đưa vào phiên bản (mẫu). */
    staged: string | null;
}

export const SOURCE_STATUS_LABEL: Record<SourceStatus, string> = {
    active: "Đang dùng",
    staged: "Có bản mới",
    missing: "Chưa nhập",
    reference: "Đối chiếu",
};

export const DATASET_SOURCES: readonly DatasetSource[] = [
    { id: "osm", name: "OpenStreetMap (Geofabrik)", covers: "Tiện ích 500 m, đường, công viên, trường, ga", license: "ODbL", cadence: "Hằng ngày", status: "staged", snapshot: "2026-10-01", staged: "2026-11-01" },
    { id: "overture", name: "Overture Places", covers: "Đối chiếu mật độ tiện ích", license: "CDLA Permissive 2.0", cadence: "Hằng tháng", status: "reference", snapshot: "2026-09-18", staged: null },
    { id: "worldpop", name: "WorldPop 100 m (R2025A)", covers: "Mật độ dân cư", license: "CC BY 4.0", cadence: "Hằng năm", status: "active", snapshot: "R2025A", staged: null },
    { id: "ghsl", name: "GHSL GHS-POP R2023A", covers: "Đối chiếu dân số", license: "Ghi nguồn EC JRC", cadence: "Vài năm", status: "reference", snapshot: "R2023A", staged: null },
    { id: "openaq", name: "OpenAQ v3", covers: "Không khí (PM2.5)", license: "Theo từng trạm", cadence: "Theo giờ", status: "missing", snapshot: null, staged: null },
    { id: "fabdem", name: "FABDEM V1-0 Việt Nam", covers: "Độ cao tương đối", license: "CC BY 4.0", cadence: "Tĩnh (2021)", status: "active", snapshot: "V1-0", staged: null },
    { id: "jrc-flood", name: "JRC Global River Flood Hazard", covers: "Ngập sông (mô hình)", license: "Copernicus", cadence: "Tĩnh", status: "missing", snapshot: null, staged: null },
    { id: "worldcover", name: "ESA WorldCover 10 m", covers: "Mảng xanh", license: "CC BY 4.0", cadence: "Tĩnh (2021)", status: "missing", snapshot: null, staged: null },
    { id: "gtfs", name: "GTFS Hà Nội (busmaps)", covers: "Điểm xe buýt, ga metro", license: "Miễn phí", cadence: "Theo đợt", status: "staged", snapshot: "2026-06-30", staged: "2026-10-02" },
    { id: "land-price", name: "Bảng giá đất NQ 52/2025/NQ-HĐND", covers: "Mốc giá sàn (chưa dùng tự động)", license: "Văn bản nhà nước", cadence: "Theo nghị quyết", status: "missing", snapshot: null, staged: null },
];
