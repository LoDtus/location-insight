"""
Đóng gói và kiểm gói dữ liệu chuẩn để tải lên /admin/datasets (018-location-data, package-contracts.md).
Chỉ dùng thư viện chuẩn Python 3.11+. Không kết nối database: server kiểm lại mọi thứ khi nhận gói.

    # Đóng gói tệp đã chuẩn hóa (CSV cho point/grid, GeoJSONSeq .geojsonl hoặc .geojsonl.gz cho line/area)
    python3 tools/data/package_tool.py pack --layer osm.places --label 2026-11-01 --contract point@1 \\
        --data data/processed/places/osm/2026-11-01/points.csv \\
        --source data/catalog/snapshots/places/osm/2026-11-01.json --tool tools/data/osm_places.py

    # Kiểm một gói trước khi tải lên
    python3 tools/data/package_tool.py validate data/packages/osm.places/2026-11-01/package.zip

Ra (byte dữ liệu không vào git, xem data/README.md):
    data/packages/{layer}/{label}/package.zip
    data/catalog/packages/{layer}/{label}.json     bản sao manifest, được commit
Quy ước khuôn đọc từ backend/src/modules/map/datasets/package-contracts.json (một nguồn cho cả backend).
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import re
import subprocess
import sys
import zipfile
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterator

ROOT = Path(__file__).resolve().parents[2]
CONTRACTS_PATH = ROOT / "backend/src/modules/map/datasets/package-contracts.json"
MANIFEST_FILE = "manifest.json"
COVERAGE_FILE = "coverage.geojson"
ROW_ERRORS_SHOWN = 20


def load_contracts() -> dict[str, Any]:
    return json.loads(CONTRACTS_PATH.read_text(encoding="utf-8"))


CONTRACTS = load_contracts()
LIMITS: dict[str, int] = CONTRACTS["limits"]
BBOX: dict[str, float] = CONTRACTS["bbox"]
PATTERNS = {name: re.compile(value) for name, value in CONTRACTS["patterns"].items() if not name.startswith("$")}


@dataclass
class Report:
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    row_errors: int = 0
    total_rows: int = 0
    categories: Counter[str] = field(default_factory=Counter)

    def row_error(self, line_no: int, message: str) -> None:
        self.row_errors += 1
        if self.row_errors <= ROW_ERRORS_SHOWN:
            self.errors.append(f"Dòng {line_no}: {message}")

    @property
    def ok(self) -> bool:
        return not self.errors and self.row_errors == 0


# ───────────────────────────── kiểm dòng ─────────────────────────────


def check_common(row: dict[str, Any], line_no: int, report: Report) -> bool:
    key = str(row.get("feature_key") or "").strip()
    category = str(row.get("category") or "").strip()
    name = str(row.get("name") or "")
    planned = str(row.get("is_planned") or "").strip().lower()
    attrs = row.get("attrs")
    if not PATTERNS["featureKey"].fullmatch(key):
        report.row_error(line_no, "feature_key trống, quá 120 ký tự hoặc có ký tự lạ.")
        return False
    if not PATTERNS["category"].fullmatch(category):
        report.row_error(line_no, "category phải là chữ thường, số, gạch dưới.")
        return False
    if len(name) > 200:
        report.row_error(line_no, "name dài quá 200 ký tự.")
        return False
    if planned not in ("", "true", "false"):
        report.row_error(line_no, "is_planned phải là true hoặc false.")
        return False
    if isinstance(attrs, str) and attrs.strip():
        if len(attrs.encode("utf-8")) > LIMITS["attrsMaxBytes"]:
            report.row_error(line_no, "attrs quá lớn.")
            return False
        try:
            attrs = json.loads(attrs)
        except json.JSONDecodeError:
            report.row_error(line_no, "attrs không phải JSON.")
            return False
    if attrs not in (None, "") and not isinstance(attrs, dict):
        report.row_error(line_no, "attrs phải là object JSON.")
        return False
    report.categories[category] += 1
    return True


def in_bbox(lng: float, lat: float) -> bool:
    return BBOX["minLng"] <= lng <= BBOX["maxLng"] and BBOX["minLat"] <= lat <= BBOX["maxLat"]


def check_csv(text: str, contract: str, report: Report) -> None:
    spec = CONTRACTS["contracts"][contract]
    reader = csv.reader(io.StringIO(text.lstrip("﻿"), newline=""))
    header = next(reader, None)
    if header is None:
        report.errors.append("data.csv rỗng.")
        return
    header = [name.strip() for name in header]
    unknown = [name for name in header if name not in spec["columns"]]
    missing = [name for name in spec["requiredColumns"] if name not in header]
    if unknown or missing or len(set(header)) != len(header):
        report.errors.append(f"Tiêu đề sai khuôn {contract}: thừa {unknown}, thiếu {missing}.")
        return
    keys: set[str] = set()
    inside = 0
    for line_no, cells in enumerate(reader, start=2):
        if not cells or cells == [""]:
            continue
        report.total_rows += 1
        if len(cells) != len(header):
            report.row_error(line_no, f"có {len(cells)} ô, khuôn cần {len(header)}.")
            continue
        row = dict(zip(header, (cell.strip() for cell in cells)))
        if spec["geometryKind"] == "grid":
            if not re.fullmatch(r"\d{1,15}", row["cell_id"]):
                report.row_error(line_no, "cell_id phải là số nguyên không âm.")
            elif row["value"] != "" and not is_number(row["value"]):
                report.row_error(line_no, "value phải là số hoặc để trống.")
            elif row["cell_id"] in keys:
                report.row_error(line_no, "cell_id bị trùng.")
            keys.add(row["cell_id"])
            continue
        if not check_common(row, line_no, report):
            continue
        if not (is_number(row.get("lat", "")) and is_number(row.get("lng", ""))):
            report.row_error(line_no, "lat/lng không hợp lệ.")
            continue
        if row["feature_key"] in keys:
            report.row_error(line_no, "feature_key bị trùng.")
        keys.add(row["feature_key"])
        inside += in_bbox(float(row["lng"]), float(row["lat"]))
    if spec["geometryKind"] != "grid":
        check_inside_ratio(inside, report)


def check_geojsonl(lines: Iterator[str], contract: str, crs: str, report: Report) -> None:
    spec = CONTRACTS["contracts"][contract]
    keys: set[str] = set()
    for line_no, raw in enumerate(lines, start=1):
        text = raw.lstrip("\x1e").strip()
        if not text:
            continue
        report.total_rows += 1
        try:
            feature = json.loads(text)
        except json.JSONDecodeError:
            report.row_error(line_no, "không phải JSON.")
            continue
        geometry = feature.get("geometry") if isinstance(feature, dict) else None
        props = feature.get("properties") if isinstance(feature, dict) else None
        if feature.get("type") != "Feature" or not isinstance(geometry, dict) or not isinstance(props, dict):
            report.row_error(line_no, "phải là GeoJSON Feature có geometry và properties.")
            continue
        if geometry.get("type") not in spec["geometryTypes"]:
            report.row_error(line_no, f"geometry phải là {' hoặc '.join(spec['geometryTypes'])}.")
            continue
        extra = [key for key in props if key not in spec["properties"]]
        if extra:
            report.row_error(line_no, f"thuộc tính ngoài khuôn {extra[:3]} (đưa vào attrs).")
            continue
        if not check_common(props, line_no, report):
            continue
        road_class = props.get("road_class")
        if contract.startswith("line") and road_class not in (None, "") and road_class not in CONTRACTS["roadClasses"]:
            report.row_error(line_no, "road_class không hợp lệ.")
        if contract.startswith("line") and props["feature_key"] in keys:
            report.row_error(line_no, "feature_key bị trùng.")
        keys.add(props["feature_key"])
    if crs != "EPSG:4326":
        report.warnings.append("Hệ tọa độ khác EPSG:4326: kiểm vị trí trong hộp Hà Nội để server làm sau khi đổi hệ.")


def check_inside_ratio(inside: int, report: Report) -> None:
    valid = report.total_rows - report.row_errors
    if valid > 0 and inside / valid < BBOX["insideRatioMin"]:
        report.errors.append(f"Chỉ {inside}/{valid} điểm nằm trong hộp Hà Nội (cần ≥ {BBOX['insideRatioMin'] * 100}%).")


def is_number(value: str) -> bool:
    try:
        return value.strip() != "" and float(value) == float(value) and abs(float(value)) != float("inf")
    except ValueError:
        return False


def check_data(data: bytes, contract: str, crs: str) -> Report:
    report = Report()
    if CONTRACTS["contracts"][contract]["dataFile"] == "data.csv":
        if b"\x00" in data[:4096]:
            report.errors.append("data.csv có byte 0, không phải văn bản.")
            return report
        check_csv(data.decode("utf-8"), contract, report)
    else:
        if data[:2] != b"\x1f\x8b":
            report.errors.append("data.geojsonl.gz không phải gzip.")
            return report
        check_geojsonl(iter(gzip.decompress(data).decode("utf-8").splitlines()), contract, crs, report)
    return report


# ───────────────────────────── pack ─────────────────────────────


def git_commit() -> tuple[str, bool]:
    commit = subprocess.run(["git", "rev-parse", "HEAD"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip()
    dirty = subprocess.run(["git", "status", "--porcelain", "--", "tools/data"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.strip() != ""
    return commit, dirty


def read_source(path_text: str) -> dict[str, str]:
    path = (ROOT / path_text).resolve() if not Path(path_text).is_absolute() else Path(path_text).resolve()
    snapshots = (ROOT / "data/catalog/snapshots").resolve()
    if snapshots not in path.parents:
        raise SystemExit(f"--source phải là biên bản trong data/catalog/snapshots: {path_text}")
    record = json.loads(path.read_text(encoding="utf-8"))
    sha = record.get("sha256")
    if not isinstance(sha, str) or not PATTERNS["sha256"].fullmatch(sha):
        raise SystemExit(f"Biên bản {path_text} chưa có sha256 của file raw. Tính sha256 và điền trước khi đóng gói.")
    if not record.get("license"):
        raise SystemExit(f"Biên bản {path_text} thiếu license.")
    return {"catalog": str(path.relative_to(ROOT)), "url": str(record.get("url") or ""), "sha256": sha, "license": str(record["license"])}


def parse_params(values: list[str]) -> dict[str, str | int | float | bool]:
    params: dict[str, str | int | float | bool] = {}
    for item in values:
        key, _, raw = item.partition("=")
        if not re.fullmatch(r"[a-z][a-z0-9_]{0,39}", key):
            raise SystemExit(f"--param sai dạng khóa=giá_trị: {item}")
        if raw in ("true", "false"):
            params[key] = raw == "true"
        elif re.fullmatch(r"-?\d+", raw):
            params[key] = int(raw)
        elif is_number(raw):
            params[key] = float(raw)
        else:
            params[key] = raw
    return params


def read_data_file(path: Path, contract: str) -> bytes:
    data = path.read_bytes()
    if CONTRACTS["contracts"][contract]["dataFile"].endswith(".gz") and data[:2] != b"\x1f\x8b":
        data = gzip.compress(data, mtime=0)
    return data


def pack(args: argparse.Namespace) -> int:
    contract: str = args.contract
    spec = CONTRACTS["contracts"][contract]
    if not PATTERNS["layerCode"].fullmatch(args.layer) or not PATTERNS["label"].fullmatch(args.label):
        raise SystemExit("--layer hoặc --label sai dạng (xem package-contracts.json patterns).")
    crs = args.crs or spec["crs"][0]
    if crs not in spec["crs"]:
        raise SystemExit(f"Khuôn {contract} chỉ nhận crs {spec['crs']}.")
    if spec["geometryKind"] == "grid" and not args.grid_code:
        raise SystemExit("Khuôn grid cần --grid-code (ví dụ vn2000-100m).")

    data = read_data_file(Path(args.data), contract)
    report = check_data(data, contract, crs)
    print_report(report)
    if not report.ok:
        return 1

    commit, dirty = git_commit()
    manifest: dict[str, Any] = {
        "contract": contract,
        "layer": args.layer,
        "label": args.label,
        "sourceDate": args.source_date,
        "crs": crs,
        "sources": [read_source(item) for item in args.source],
        "pipeline": {"tool": args.tool, "commit": commit, "dirty": dirty},
        "manualSteps": args.manual_step,
        "rowCount": report.total_rows,
        "categories": dict(sorted(report.categories.items())),
        "dataSha256": hashlib.sha256(data).hexdigest(),
        "gridCode": args.grid_code,
        "params": parse_params(args.param),
        "notes": args.notes,
    }
    out_dir = ROOT / "data/packages" / args.layer / args.label
    out_zip = out_dir / "package.zip"
    if out_zip.exists():
        raise SystemExit(f"{out_zip} đã có. Gói không ghi đè: dùng label mới (ví dụ {args.label}-r2).")
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest_text = json.dumps(manifest, ensure_ascii=False, indent=2) + "\n"
    with zipfile.ZipFile(out_zip, "x", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(MANIFEST_FILE, manifest_text)
        compress = zipfile.ZIP_STORED if spec["dataFile"].endswith(".gz") else zipfile.ZIP_DEFLATED
        archive.writestr(spec["dataFile"], data, compress_type=compress)
        if args.coverage:
            archive.writestr(COVERAGE_FILE, Path(args.coverage).read_bytes())
    out_zip.chmod(0o444)
    catalog_copy = ROOT / "data/catalog/packages" / args.layer / f"{args.label}.json"
    catalog_copy.parent.mkdir(parents=True, exist_ok=True)
    catalog_copy.write_text(manifest_text, encoding="utf-8")
    if dirty:
        print("CẢNH BÁO: tools/data có thay đổi chưa commit (pipeline.dirty = true).")
    print(f"Đã tạo {out_zip.relative_to(ROOT)} ({out_zip.stat().st_size} byte), sha256 {hashlib.sha256(out_zip.read_bytes()).hexdigest()}")
    print(f"Manifest: {catalog_copy.relative_to(ROOT)} (commit file này)")
    return validate_zip(out_zip)


# ───────────────────────────── validate ─────────────────────────────


def validate_zip(path: Path) -> int:
    report = Report()
    size = path.stat().st_size
    if size > LIMITS["packageMaxBytes"]:
        report.errors.append(f"Gói {size} byte, vượt {LIMITS['packageMaxBytes']}.")
    data_files = {spec["dataFile"] for spec in CONTRACTS["contracts"].values()}
    allowed = {MANIFEST_FILE, COVERAGE_FILE, *data_files}
    with zipfile.ZipFile(path) as archive:
        infos = archive.infolist()
        names = [info.filename for info in infos]
        total = sum(info.file_size for info in infos)
        if len(infos) > LIMITS["entriesMax"] or len(set(names)) != len(names):
            report.errors.append(f"Gói có {len(infos)} mục (tối đa {LIMITS['entriesMax']}, không trùng tên).")
        for info in infos:
            if info.filename not in allowed:
                report.errors.append(f"Mục không được phép: {info.filename}")
            if info.flag_bits & 0x1:
                report.errors.append(f"Mục bị mã hóa: {info.filename}")
            if info.file_size / max(info.compress_size, 1) > LIMITS["compressionRatioMax"]:
                report.errors.append(f"Tỷ lệ nén của {info.filename} vượt 1:{LIMITS['compressionRatioMax']}.")
        if total > LIMITS["uncompressedMaxBytes"]:
            report.errors.append("Tổng dung lượng giải nén vượt giới hạn.")
        if report.errors:
            print_report(report)
            return 1
        manifest = json.loads(archive.read(MANIFEST_FILE))
        contract = manifest.get("contract")
        if contract not in CONTRACTS["contracts"]:
            report.errors.append(f"contract không hỗ trợ: {contract}")
            print_report(report)
            return 1
        data_name = CONTRACTS["contracts"][contract]["dataFile"]
        if data_name not in names:
            report.errors.append(f"Thiếu {data_name}.")
            print_report(report)
            return 1
        data = archive.read(data_name)
    if hashlib.sha256(data).hexdigest() != manifest.get("dataSha256"):
        report.errors.append("dataSha256 trong manifest không khớp dữ liệu.")
    data_report = check_data(data, contract, str(manifest.get("crs", "")))
    report.errors.extend(data_report.errors)
    report.warnings.extend(data_report.warnings)
    report.row_errors = data_report.row_errors
    report.total_rows = data_report.total_rows
    if data_report.total_rows != manifest.get("rowCount"):
        report.errors.append(f"rowCount {manifest.get('rowCount')} khác số dòng thật {data_report.total_rows}.")
    if manifest.get("categories") and dict(data_report.categories) != manifest["categories"]:
        report.errors.append("categories trong manifest không khớp dữ liệu.")
    if manifest.get("pipeline", {}).get("dirty"):
        report.warnings.append("pipeline.dirty = true: gói dựng từ code chưa commit.")
    print_report(report)
    if report.ok:
        print(f"Gói hợp lệ: {manifest.get('layer')}/{manifest.get('label')}, {report.total_rows} dòng. Tải lên /admin/datasets.")
    return 0 if report.ok else 1


def print_report(report: Report) -> None:
    for message in report.errors:
        print(f"LỖI: {message}")
    if report.row_errors > ROW_ERRORS_SHOWN:
        print(f"... và {report.row_errors - ROW_ERRORS_SHOWN} dòng lỗi khác.")
    for message in report.warnings:
        print(f"CẢNH BÁO: {message}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Đóng gói và kiểm gói dữ liệu nền (018-location-data).")
    commands = parser.add_subparsers(dest="command", required=True)

    pack_cmd = commands.add_parser("pack", help="Tạo package.zip từ tệp đã chuẩn hóa")
    pack_cmd.add_argument("--layer", required=True, help="mã lớp, ví dụ osm.places")
    pack_cmd.add_argument("--label", required=True, help="nhãn phiên bản, thường là ngày nguồn")
    pack_cmd.add_argument("--contract", required=True, choices=sorted(CONTRACTS["contracts"]))
    pack_cmd.add_argument("--data", required=True, help="CSV (point/grid) hoặc .geojsonl[.gz] (line/area)")
    pack_cmd.add_argument("--source", action="append", required=True, help="biên bản data/catalog/snapshots/... (lặp được)")
    pack_cmd.add_argument("--tool", required=True, help="script đã dựng dữ liệu, ví dụ tools/data/osm_places.py")
    pack_cmd.add_argument("--source-date", default=None, help="YYYY-MM-DD")
    pack_cmd.add_argument("--crs", default=None)
    pack_cmd.add_argument("--coverage", default=None, help="coverage.geojson (đa giác vùng có dữ liệu)")
    pack_cmd.add_argument("--grid-code", default=None)
    pack_cmd.add_argument("--param", action="append", default=[], help="khóa=giá_trị (khuôn grid, ví dụ radius_m=500)")
    pack_cmd.add_argument("--manual-step", action="append", default=[], help="mô tả bước làm tay (lặp được)")
    pack_cmd.add_argument("--notes", default="")

    validate_cmd = commands.add_parser("validate", help="Kiểm một package.zip")
    validate_cmd.add_argument("package", type=Path)

    args = parser.parse_args()
    if args.command == "pack":
        return pack(args)
    return validate_zip(args.package)


if __name__ == "__main__":
    sys.exit(main())
