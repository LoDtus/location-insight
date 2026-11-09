"""
Sinh gói chuẩn GIẢ để thử kéo thả ở /admin/datasets (018-location-data, package-contracts.md).
Dữ liệu ngẫu nhiên có hạt giống cố định, không phải dữ liệu thật: chỉ dùng trên máy dev.

    python3 tools/data/mock_packages.py            # ghi vào data/mock/packages/ (git bỏ qua)
    python3 tools/data/mock_packages.py --force    # xóa và sinh lại

Các lớp dùng nguồn `mock` để không lẫn với lớp thật. Tạo lớp trên tab "Lớp dữ liệu" trước khi tải gói
(danh sách và thứ tự thử nằm trong data/mock/packages/README.md do script sinh ra).
"""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import math
import random
import shutil
import sys
import zipfile
from collections import Counter
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
from package_tool import CONTRACTS, ROOT, git_commit, validate_zip  # noqa: E402

OUT = ROOT / "data/mock/packages"
SOURCE_DATE = "2026-11-01"
# Tâm Hà Nội và bán kính rải điểm (độ). Vẫn nằm gọn trong hộp của package-contracts.json.
CENTER = (105.8342, 21.0278)
SPREAD = (0.09, 0.07)
GRID = {"code": "vn2000-100m", "columns": 878, "rows": 1034}

LAYERS = [
    ("mock.places", "point@1", "Điểm tiện ích giả: chợ, nhà thuốc, trường, bệnh viện…"),
    ("mock.roads", "line@1", "Đường giả có road_class"),
    ("mock.landuse", "area@1", "Vùng sử dụng đất giả (ODT, CLN, LUC, DGT)"),
    ("mock.pop_100m", "grid@1", "Mật độ dân số giả trên lưới vn2000-100m"),
]

PLACE_CATEGORIES = {
    "market": ("marketplace", "Chợ"),
    "pharmacy": ("pharmacy", "Nhà thuốc"),
    "school": ("school", "Trường"),
    "hospital": ("hospital", "Bệnh viện"),
    "park": ("park", "Công viên"),
    "supermarket": ("supermarket", "Siêu thị"),
    "bus_stop": ("bus_stop", "Điểm dừng xe buýt"),
}
STREETS = ["Hàng Bông", "Kim Mã", "Láng", "Trường Chinh", "Giải Phóng", "Nguyễn Trãi", "Cầu Giấy", "Lạc Long Quân", "Bạch Mai", "Đội Cấn"]
ROAD_CLASSES = ["trunk", "primary", "secondary", "tertiary", "residential", "residential", "alley", "alley"]
LAND_CODES = {"ODT": "residential", "CLN": "orchard", "LUC": "rice_field", "DGT": "transport"}


# ───────────────────────────── dữ liệu ─────────────────────────────


def random_point(rng: random.Random) -> tuple[float, float]:
    return (round(CENTER[0] + rng.uniform(-1, 1) * SPREAD[0], 6), round(CENTER[1] + rng.uniform(-1, 1) * SPREAD[1], 6))


def csv_cell(value: str) -> str:
    return '"' + value.replace('"', '""') + '"' if any(ch in value for ch in ',"\n') else value


def places(seed: int, count: int) -> list[dict[str, str]]:
    rng = random.Random(seed)
    rows = []
    for index in range(count):
        category = rng.choice(list(PLACE_CATEGORIES))
        kind, prefix = PLACE_CATEGORIES[category]
        lng, lat = random_point(rng)
        attrs = {"opening_hours": "06:00-21:00"} if category in ("market", "pharmacy", "supermarket") else {}
        rows.append(
            {
                "feature_key": f"mock:p{index:05d}",
                "category": category,
                "kind": kind,
                "name": f"{prefix} {rng.choice(STREETS)} {index}",
                "lat": f"{lat}",
                "lng": f"{lng}",
                "is_planned": "true" if rng.random() < 0.03 else "false",
                "attrs": json.dumps(attrs, ensure_ascii=False) if attrs else "",
            }
        )
    return rows


def places_csv(rows: list[dict[str, str]]) -> bytes:
    columns = CONTRACTS["contracts"]["point@1"]["columns"]
    lines = [",".join(columns)] + [",".join(csv_cell(row[name]) for name in columns) for row in rows]
    return ("\n".join(lines) + "\n").encode("utf-8")


def roads(seed: int, count: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    features = []
    for index in range(count):
        road_class = rng.choice(ROAD_CLASSES)
        lng, lat = random_point(rng)
        heading = rng.uniform(0, math.pi)
        coords = []
        for step in range(rng.randint(3, 8)):
            heading += rng.uniform(-0.3, 0.3)
            lng += math.cos(heading) * 0.002
            lat += math.sin(heading) * 0.002
            coords.append([round(lng, 6), round(lat, 6)])
        width = {"trunk": 30, "primary": 20, "secondary": 14, "tertiary": 10, "residential": 6}.get(road_class)
        features.append(
            feature(
                {"type": "LineString", "coordinates": coords},
                {
                    "feature_key": f"mock:r{index:05d}",
                    "category": "road",
                    "road_class": road_class,
                    "width_m": width,
                    "name": f"Phố {rng.choice(STREETS)} {index}",
                    "is_planned": rng.random() < 0.05,
                    "attrs": {},
                },
            )
        )
    return features


def landuse(seed: int, count: int) -> list[dict[str, Any]]:
    rng = random.Random(seed)
    features = []
    for index in range(count):
        code, category = rng.choice(list(LAND_CODES.items()))
        lng, lat = random_point(rng)
        radius = rng.uniform(0.002, 0.006)
        ring = [
            [round(lng + math.cos(a) * radius * rng.uniform(0.7, 1.0), 6), round(lat + math.sin(a) * radius * rng.uniform(0.7, 1.0), 6)]
            for a in (2 * math.pi * k / 8 for k in range(8))
        ]
        ring.append(ring[0])
        features.append(
            feature(
                {"type": "Polygon", "coordinates": [ring]},
                {
                    "feature_key": f"mock:a{index:05d}",
                    "category": category,
                    "code": code,
                    "name": f"Khu {code} {index}",
                    "valid_from": "2021-01-01",
                    "valid_to": "2030-12-31",
                    "attrs": {"plan": "QHSDĐ 2021-2030 (giả)"},
                },
            )
        )
    return features


def feature(geometry: dict[str, Any], properties: dict[str, Any]) -> dict[str, Any]:
    return {"type": "Feature", "geometry": geometry, "properties": properties}


def geojsonl(features: list[dict[str, Any]]) -> bytes:
    text = "".join(json.dumps(item, ensure_ascii=False, separators=(",", ":")) + "\n" for item in features)
    return gzip.compress(text.encode("utf-8"), mtime=0)


def population_csv(seed: int) -> bytes:
    """Ô lưới quanh trung tâm (cell_id = hàng * columns + cột). Một phần ô để trống = ngoài vùng phủ."""
    rng = random.Random(seed)
    center_row, center_col = 520, 440
    lines = ["cell_id,value"]
    for row in range(center_row - 60, center_row + 60):
        for col in range(center_col - 80, center_col + 80):
            distance = math.hypot(row - center_row, col - center_col)
            cell = row * GRID["columns"] + col
            if distance > 75:
                lines.append(f"{cell},")
                continue
            value = 2500 * math.exp(-((distance / 35) ** 2)) * rng.uniform(0.7, 1.3)
            lines.append(f"{cell},{value:.1f}")
    return ("\n".join(lines) + "\n").encode("utf-8")


# ───────────────────────────── gói ─────────────────────────────


def manifest_for(contract: str, layer: str, label: str, data: bytes, rows: int, categories: dict[str, int], **extra: Any) -> dict[str, Any]:
    commit, dirty = git_commit()
    source = layer.split(".")[1]
    manifest: dict[str, Any] = {
        "contract": contract,
        "layer": layer,
        "label": label,
        "sourceDate": SOURCE_DATE,
        "crs": CONTRACTS["contracts"][contract]["crs"][0],
        "sources": [
            {
                "catalog": f"data/catalog/snapshots/mock/{source}/{SOURCE_DATE}.json",
                "url": "https://example.invalid/mock",
                "sha256": hashlib.sha256(f"mock-raw:{layer}".encode()).hexdigest(),
                "license": "CC0-1.0",
            }
        ],
        "pipeline": {"tool": "tools/data/mock_packages.py", "commit": commit, "dirty": dirty},
        "manualSteps": [],
        "rowCount": rows,
        "categories": categories,
        "dataSha256": hashlib.sha256(data).hexdigest(),
        "gridCode": None,
        "params": {},
        "notes": "Dữ liệu GIẢ sinh bởi tools/data/mock_packages.py, chỉ để thử trên máy dev.",
    }
    manifest.update(extra)
    return manifest


def write_zip(name: str, manifest: dict[str, Any], data: bytes, extra_entries: dict[str, bytes] | None = None) -> Path:
    path = OUT / f"{name}.zip"
    data_file = CONTRACTS["contracts"][manifest["contract"]]["dataFile"]
    with zipfile.ZipFile(path, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("manifest.json", json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
        archive.writestr(data_file, data, compress_type=zipfile.ZIP_STORED if data_file.endswith(".gz") else zipfile.ZIP_DEFLATED)
        for entry, content in (extra_entries or {}).items():
            archive.writestr(entry, content)
    return path


def place_package(name: str, label: str, rows: list[dict[str, str]], **extra: Any) -> tuple[Path, dict[str, Any], bytes]:
    data = places_csv(rows)
    categories = dict(sorted(Counter(row["category"] for row in rows).items()))
    manifest = manifest_for("point@1", "mock.places", label, data, len(rows), categories, **extra)
    return write_zip(name, manifest, data), manifest, data


def coverage_geojson() -> bytes:
    (lng, lat), (dx, dy) = CENTER, SPREAD
    ring = [[lng - dx, lat - dy], [lng + dx, lat - dy], [lng + dx, lat + dy], [lng - dx, lat + dy], [lng - dx, lat - dy]]
    return json.dumps({"type": "Polygon", "coordinates": [[[round(x, 6), round(y, 6)] for x, y in ring]]}).encode()


def build() -> list[tuple[str, str, str]]:
    """Trả về (file, kết quả mong đợi, ghi chú) theo thứ tự nên thử."""
    base_places = places(seed=1, count=320)
    plan: list[tuple[str, str, str]] = []

    place_package("01-mock.places-2026-11-01", "2026-11-01", base_places)
    plan.append(("01-mock.places-2026-11-01.zip", "validated", "Gói điểm đầu tiên. Lưu, rồi chọn vào bản nháp và phát hành để các gói sau có bản so sánh."))

    roads_data = roads(seed=2, count=80)
    data = geojsonl(roads_data)
    write_zip("02-mock.roads-2026-11-01", manifest_for("line@1", "mock.roads", "2026-11-01", data, len(roads_data), {"road": len(roads_data)}), data)
    plan.append(("02-mock.roads-2026-11-01.zip", "validated", "Khuôn line@1 (GeoJSONSeq nén gzip)."))

    areas = landuse(seed=3, count=40)
    data = geojsonl(areas)
    categories = dict(sorted(Counter(item["properties"]["category"] for item in areas).items()))
    manifest = manifest_for("area@1", "mock.landuse", "2026-11-01", data, len(areas), categories)
    write_zip("03-mock.landuse-2026-11-01", manifest, data, {"coverage.geojson": coverage_geojson()})
    plan.append(("03-mock.landuse-2026-11-01.zip", "validated", "Khuôn area@1, có coverage.geojson."))

    data = population_csv(seed=4)
    rows = data.count(b"\n") - 1
    manifest = manifest_for("grid@1", "mock.pop_100m", "R2026-mock", data, rows, {}, gridCode=GRID["code"], params={"radius_m": 0})
    manifest["crs"] = "EPSG:3405"
    write_zip("04-mock.pop_100m-R2026-mock", manifest, data)
    plan.append(("04-mock.pop_100m-R2026-mock.zip", "validated", "Khuôn grid@1 trên lưới vn2000-100m, có ô trống (ngoài vùng phủ)."))

    # Bản mới của mock.places: bỏ 3 điểm, thêm 5 điểm → 8/320 = 2.5% thay đổi, dưới ngưỡng cảnh báo 5%.
    added = [dict(row, feature_key=f"mock:p9{index:04d}") for index, row in enumerate(places(seed=11, count=5))]
    updated = base_places[3:] + added
    place_package("05-mock.places-2026-11-08", "2026-11-08", updated, sourceDate="2026-11-08")
    plan.append(("05-mock.places-2026-11-08.zip", "validated", "Bản cập nhật: so với bản đang phát hành thấy +5 / −3 điểm."))

    drifted = base_places[:300] + [dict(row, feature_key=f"mock:p8{index:04d}") for index, row in enumerate(places(seed=12, count=8))]
    place_package("06-mock.places-2026-11-08-r1", "2026-11-08-r1", drifted, sourceDate="2026-11-08")
    plan.append(("06-mock.places-2026-11-08-r1.zip", "validated, có cảnh báo (row_count_delta_warn)", "−20 / +8 điểm (8.75%): phải ghi lý do chấp nhận mới Lưu được."))

    shrunk = base_places[:200]
    place_package("07-mock.places-2026-11-08-r2", "2026-11-08-r2", shrunk, sourceDate="2026-11-08")
    plan.append(("07-mock.places-2026-11-08-r2.zip", "rejected (row_count_delta)", "Mất 37.5% số dòng so với bản phát hành, vượt ngưỡng chặn 20%. Cần đã phát hành gói 01."))

    # ── Gói lỗi cố ý ──
    # Gói lỗi dựa trên bản 01 (320 dòng) để chỉ hiện đúng một lỗi, không kèm lỗi lệch số dòng.
    rows_ = [dict(row) for row in base_places]
    data = places_csv(rows_)
    manifest = manifest_for("point@1", "mock.places", "bad-checksum", data, len(rows_), dict(sorted(Counter(r["category"] for r in rows_).items())))
    manifest["dataSha256"] = "0" * 64
    write_zip("90-bad-checksum", manifest, data)
    plan.append(("90-bad-checksum.zip", "rejected (data_checksum)", "dataSha256 trong manifest không khớp data.csv."))

    rows_ = [dict(row) for row in base_places]
    for row in rows_[:10]:
        row["lat"], row["lng"] = "10.776889", "106.700806"  # TP.HCM
    place_package("91-bad-outside-bbox", "bad-outside-bbox", rows_)
    plan.append(("91-bad-outside-bbox.zip", "rejected (inside_bbox)", "10/320 điểm nằm ở TP.HCM."))

    rows_ = [dict(row) for row in base_places]
    rows_[5]["feature_key"] = rows_[4]["feature_key"]
    place_package("92-bad-duplicate-key", "bad-duplicate-key", rows_)
    plan.append(("92-bad-duplicate-key.zip", "rejected (duplicate_key)", "Hai dòng trùng feature_key."))

    rows_ = places(seed=24, count=30)
    data = places_csv(rows_)
    manifest = manifest_for("point@1", "mock.unknown", "2026-11-01", data, len(rows_), dict(Counter(r["category"] for r in rows_)))
    write_zip("93-bad-unknown-layer", manifest, data)
    plan.append(("93-bad-unknown-layer.zip", "bị từ chối khi nộp (layer_known)", "Lớp mock.unknown chưa có trong geo.layers."))

    rows_ = places(seed=25, count=30)
    data = places_csv(rows_)
    manifest = manifest_for("point@1", "mock.places", "bad-extra-entry", data, len(rows_), dict(Counter(r["category"] for r in rows_)))
    write_zip("94-bad-extra-entry", manifest, data, {"readme.txt": b"file thua\n"})
    plan.append(("94-bad-extra-entry.zip", "bị từ chối khi nộp (package_shape)", "Zip có mục lạ readme.txt."))

    plan.append(("95-not-a-zip.zip", "bị chặn ngay ở trình duyệt", "File văn bản đổi đuôi .zip."))
    (OUT / "95-not-a-zip.zip").write_bytes(b"day khong phai file zip\n")
    return plan


def write_readme(plan: list[tuple[str, str, str]]) -> None:
    layers = "\n".join(f"| `{code}` | `{contract}` | `mock` | public | Dữ liệu giả (CC0) | {note} |" for code, contract, note in LAYERS)
    files = "\n".join(f"| `{name}` | {result} | {note} |" for name, result, note in plan)
    (OUT / "README.md").write_text(
        f"""# Gói giả để thử /admin/datasets

Sinh bởi `python3 tools/data/mock_packages.py`. Dữ liệu ngẫu nhiên, **không phải dữ liệu thật**, chỉ dùng trên máy dev.

## 1. Tạo lớp (tab "Lớp dữ liệu")

| Mã lớp | Khuôn | Nguồn | Dùng | Ghi công | Mô tả |
| --- | --- | --- | --- | --- | --- |
{layers}

## 2. Tải gói (tab "Nhập gói"), theo thứ tự

| File | Kết quả mong đợi | Ghi chú |
| --- | --- | --- |
{files}

Sau gói 01–04: tab "Bản phát hành" → tạo bản nháp, chọn 4 phiên bản lớp vừa Lưu, phát hành. Rồi thử 05 và 06.
Gói đã nộp thì nộp lại bị từ chối (`package_duplicate`); muốn thử lại từ đầu thì chạy `/reset` hoặc xóa job/phiên bản tương ứng.
""",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Sinh gói giả để thử /admin/datasets.")
    parser.add_argument("--force", action="store_true", help="xóa data/mock/packages rồi sinh lại")
    args = parser.parse_args()
    if OUT.exists():
        if not args.force:
            raise SystemExit(f"{OUT.relative_to(ROOT)} đã có. Dùng --force để sinh lại.")
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    plan = build()
    write_readme(plan)
    print(f"Đã sinh {len(plan)} gói vào {OUT.relative_to(ROOT)}/ (xem README.md trong đó).")
    failed = [name for name, result, _ in plan if result == "validated" and validate_zip(OUT / name) != 0]
    if failed:
        print(f"LỖI: gói hợp lệ nhưng validate thất bại: {failed}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
