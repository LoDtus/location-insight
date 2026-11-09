"""
Bộ dữ liệu nền bản beta/demo v0 cho các tiêu chí đánh giá (018-location-data, research.md Bản ghi 15).

Dữ liệu thật đã có trên máy, chuẩn hóa thành gói chuẩn nhãn `v0-beta`:
    osm.places         điểm tiện ích OSM đã gộp trùng (data/curated/places/2026-10-18)        point@1
    osm.roads          đường motorway → tertiary trong hộp Hà Nội, từ file .pbf OSM          line@1
    worldpop.pop_100m  dân số WorldPop R2025A lấy mẫu theo ô 100 m lưới vn2000-100m            grid@1
    esa.green_100m     % diện tích có cây/cỏ/đất ngập nước (ESA WorldCover 2021) mỗi ô 100 m   grid@1
Chưa có nguồn thật phủ Hà Nội, dùng SỐ LIỆU DEMO (ghi rõ trong ghi công lớp, chỉ dùng nội bộ):
    demo.flood_rp100   độ sâu ngập giả dọc sông Hồng (ô JRC đã tải chỉ phủ 10–20°B)              grid@1
    demo.elev_100m     cao độ giả: đồng bằng 6–12 m, dâng về phía Ba Vì (chưa tải FABDEM)        grid@1

Cần thư viện ngoài, cài vào .venv (git bỏ qua):
    python3 -m venv .venv && .venv/bin/pip install numpy rasterio pyproj osmium
    .venv/bin/python tools/data/seed_v0.py            # dựng dữ liệu + đóng gói vào data/packages/*/v0-beta
Không ghi database: gói tải lên /admin/datasets như mọi gói khác (data/README.md).
"""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import sys
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import osmium
import rasterio
from pyproj import CRS, Transformer
from rasterio.windows import from_bounds

sys.path.insert(0, str(Path(__file__).resolve().parent))
from health_kinds import health_kind  # noqa: E402
from package_tool import CONTRACTS, ROOT, pack  # noqa: E402

LABEL = "v0-beta"
DATA = ROOT / "data"
BBOX = CONTRACTS["bbox"]  # hộp Hà Nội mở rộng
# Lưới vn2000-100m (geo.grids) và đúng chuỗi proj của EPSG:3405 trong PostGIS (spatial_ref_sys), để ô tính ở đây
# khớp ô backend tra bằng ST_Transform.
GRID = {"code": "vn2000-100m", "origin_x": 523600.0, "origin_y": 2268000.0, "size": 100.0, "columns": 878, "rows": 1034}
VN2000_UTM48 = CRS.from_proj4(
    "+proj=utm +zone=48 +ellps=WGS84 +towgs84=-191.90441429,-39.30318279,-111.45032835,0.00928836,-0.01975479,"
    "0.00427372,0.252906278 +units=m +no_defs"
)
TO_WGS84 = Transformer.from_crs(VN2000_UTM48, "EPSG:4326", always_xy=True)

ROAD_CLASSES = ("motorway", "trunk", "primary", "secondary", "tertiary")
# ESA WorldCover: 10 cây, 20 cây bụi, 30 cỏ, 90 đất ngập nước, 95 rừng ngập mặn.
GREEN_CLASSES = (10, 20, 30, 90, 95)

SNAPSHOTS = DATA / "catalog/snapshots"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def update_snapshot(rel: str, sha: str, extra_files: list[Path] | None = None, note: str | None = None, base: dict | None = None) -> str:
    """Điền sha256 (bắt buộc với package_tool) và danh sách file vào biên bản nguồn; trả về đường dẫn tương đối."""
    path = SNAPSHOTS / rel
    record = json.loads(path.read_text(encoding="utf-8")) if path.exists() else dict(base or {})
    record["sha256"] = sha
    if extra_files:
        files = {item["path"]: item for item in record.get("files", []) if isinstance(item, dict)}
        for file in extra_files:
            key = str(file.relative_to(DATA))
            files[key] = {"path": key, "sha256": sha256_file(file), "bytes": file.stat().st_size}
        record["files"] = sorted(files.values(), key=lambda item: item["path"])
    if note:
        record["notes"] = note
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return str(path.relative_to(ROOT))


# ───────────────────────────── lưới ─────────────────────────────


def grid_centers() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Mã ô và tâm ô (WGS84) của toàn lưới; cell_id = hàng * columns + cột, hàng từ origin_y đi lên."""
    cols = np.arange(GRID["columns"])
    rows = np.arange(GRID["rows"])
    col_grid, row_grid = np.meshgrid(cols, rows)
    x = GRID["origin_x"] + (col_grid + 0.5) * GRID["size"]
    y = GRID["origin_y"] + (row_grid + 0.5) * GRID["size"]
    lng, lat = TO_WGS84.transform(x.ravel(), y.ravel())
    cell_id = (row_grid * GRID["columns"] + col_grid).ravel()
    return cell_id, np.asarray(lng), np.asarray(lat)


def inside_bbox(lng: np.ndarray, lat: np.ndarray) -> np.ndarray:
    return (lng >= BBOX["minLng"]) & (lng <= BBOX["maxLng"]) & (lat >= BBOX["minLat"]) & (lat <= BBOX["maxLat"])


def write_grid_csv(path: Path, cell_id: np.ndarray, values: np.ndarray, digits: int) -> int:
    """`values` NaN = ngoài vùng phủ (ô để trống)."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        handle.write("cell_id,value\n")
        for cid, value in zip(cell_id.tolist(), values.tolist()):
            handle.write(f"{cid},\n" if math.isnan(value) else f"{cid},{round(value, digits)}\n")
    return len(cell_id)


class RasterSampler:
    """Lấy giá trị raster EPSG:4326 tại các tọa độ (điểm gần nhất), chỉ đọc cửa sổ hộp Hà Nội."""

    def __init__(self, path: Path):
        self.source = rasterio.open(path)
        window = from_bounds(BBOX["minLng"] - 0.01, BBOX["minLat"] - 0.01, BBOX["maxLng"] + 0.01, BBOX["maxLat"] + 0.01, self.source.transform)
        window = window.round_offsets().round_lengths().intersection(rasterio.windows.Window(0, 0, self.source.width, self.source.height))
        self.data = self.source.read(1, window=window)
        self.transform = self.source.window_transform(window)
        self.nodata = self.source.nodata

    def sample(self, lng: np.ndarray, lat: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
        """(giá trị, có-phủ). Ngoài cửa sổ đã đọc thì có-phủ = False."""
        inverse = ~self.transform
        col, row = inverse * (lng, lat)
        col = np.floor(col).astype(np.int64)
        row = np.floor(row).astype(np.int64)
        covered = (row >= 0) & (row < self.data.shape[0]) & (col >= 0) & (col < self.data.shape[1])
        values = np.zeros(lng.shape, dtype=np.float64)
        values[covered] = self.data[row[covered], col[covered]]
        return values, covered


# ───────────────────────────── từng lớp ─────────────────────────────


def build_places() -> Path:
    source = DATA / "curated/places/2026-10-18/places.ndjson"
    out = DATA / f"processed/places/osm/{LABEL}/points.csv"
    out.parent.mkdir(parents=True, exist_ok=True)
    rows = 0
    with source.open(encoding="utf-8") as reader, out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["feature_key", "category", "kind", "name", "lat", "lng", "is_planned", "attrs"])
        for line in reader:
            item = json.loads(line)
            if item["category"] == "hospital":
                # Bệnh viện / cơ sở y tế theo tên; điểm không phải y tế (spa, nhà thuốc…) bỏ khỏi gói.
                kind = health_kind(item.get("name"), item.get("kind") or "")
                if kind is None:
                    continue
                item["kind"] = kind
            writer.writerow([f"osm:{item['sourceId']}", item["category"], item.get("kind") or "", (item.get("name") or "")[:200], item["lat"], item["lng"], "false", ""])
            rows += 1
    print(f"osm.places: {rows} điểm")
    return out


class RoadHandler(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.lines: list[str] = []

    def way(self, way: osmium.osm.Way) -> None:  # noqa: D401
        road_class = way.tags.get("highway")
        if road_class not in ROAD_CLASSES:
            return
        try:
            coords = [(node.lon, node.lat) for node in way.nodes if node.location.valid()]
        except osmium.InvalidLocationError:
            return
        if len(coords) < 2:
            return
        if not any(BBOX["minLng"] <= lng <= BBOX["maxLng"] and BBOX["minLat"] <= lat <= BBOX["maxLat"] for lng, lat in coords):
            return
        width = way.tags.get("width")
        try:
            width_m = float(width) if width else None
        except ValueError:
            width_m = None
        name = way.tags.get("name:vi") or way.tags.get("name") or ""
        feature = {
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": [[round(lng, 6), round(lat, 6)] for lng, lat in coords]},
            "properties": {
                "feature_key": f"osm:w{way.id}",
                "category": "road",
                "road_class": road_class,
                "width_m": width_m if width_m and width_m > 0 else None,
                "name": name[:200],
                "is_planned": False,
                "attrs": {"ref": way.tags.get("ref")} if way.tags.get("ref") else {},
            },
        }
        self.lines.append(json.dumps(feature, ensure_ascii=False, separators=(",", ":")))


def build_roads() -> tuple[Path, Path]:
    pbf = next((DATA / "raw/places/osm/2026-10-18").glob("*.osm.pbf"))
    handler = RoadHandler()
    handler.apply_file(str(pbf), locations=True, idx="flex_mem")
    out = DATA / f"processed/transport/osm/{LABEL}/roads.geojsonl.gz"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(gzip.compress(("\n".join(handler.lines) + "\n").encode("utf-8"), mtime=0))
    print(f"osm.roads: {len(handler.lines)} đường")
    return out, pbf


def build_population(cell_id: np.ndarray, lng: np.ndarray, lat: np.ndarray) -> tuple[Path, Path]:
    raster = DATA / "raw/environment/worldpop/R2025A/vnm_pop_2025_CN_100m_R2025A_v1.tif"
    sampler = RasterSampler(raster)
    values, covered = sampler.sample(lng, lat)
    nodata = sampler.nodata
    values = np.where(values == nodata, 0.0, values)  # constrained: ngoài khu dân cư là 0 người
    values = np.maximum(values, 0.0)
    # Ô WorldPop 3" (~87 × 93 m ở Hà Nội) nhỏ hơn ô 100 m: quy đổi theo diện tích.
    res_x, res_y = sampler.source.res
    pixel_area = (res_x * 111320 * np.cos(np.radians(lat))) * (res_y * 111320)
    values = values * (GRID["size"] ** 2) / pixel_area
    values = np.where(covered, values, np.nan)
    out = DATA / f"processed/environment/worldpop/{LABEL}/pop_100m.csv"
    rows = write_grid_csv(out, cell_id, values, 1)
    print(f"worldpop.pop_100m: {rows} ô, tổng {np.nansum(values):,.0f} người trong hộp Hà Nội")
    return out, raster


def build_green(cell_id: np.ndarray) -> tuple[Path, list[Path]]:
    tiles = sorted((DATA / "raw/environment/esa-worldcover/v200-2021").glob("*N18E105*.tif")) + sorted(
        (DATA / "raw/environment/esa-worldcover/v200-2021").glob("*N21E105*.tif")
    )
    samplers = [RasterSampler(tile) for tile in tiles]
    # 5 × 5 điểm mẫu đều trong mỗi ô 100 m (ô ESA 10 m): tỷ lệ điểm rơi vào lớp phủ xanh.
    offsets = (np.arange(5) - 2) * 20.0
    rows_ = cell_id // GRID["columns"]
    cols_ = cell_id % GRID["columns"]
    cx = GRID["origin_x"] + (cols_ + 0.5) * GRID["size"]
    cy = GRID["origin_y"] + (rows_ + 0.5) * GRID["size"]
    green = np.zeros(cell_id.shape, dtype=np.float64)
    seen = np.zeros(cell_id.shape, dtype=np.float64)
    for dx in offsets:
        for dy in offsets:
            lng, lat = TO_WGS84.transform(cx + dx, cy + dy)
            lng = np.asarray(lng)
            lat = np.asarray(lat)
            for sampler in samplers:
                values, covered = sampler.sample(lng, lat)
                valid = covered & (values != 0)
                seen += valid
                green += valid & np.isin(values, GREEN_CLASSES)
    values = np.where(seen > 0, green / np.maximum(seen, 1) * 100, np.nan)
    out = DATA / f"processed/environment/esa-worldcover/{LABEL}/green_100m.csv"
    rows = write_grid_csv(out, cell_id, values, 1)
    print(f"esa.green_100m: {rows} ô, {int(np.sum(~np.isnan(values)))} ô có số liệu")
    return out, tiles


# Đường giữa sông Hồng qua Hà Nội (gần đúng, chỉ để sinh số liệu demo).
RED_RIVER = [(105.33, 21.23), (105.50, 21.15), (105.65, 21.11), (105.73, 21.10), (105.80, 21.08), (105.858, 21.043), (105.88, 21.00), (105.90, 20.95), (105.94, 20.85), (105.97, 20.75), (106.02, 20.62)]


def distance_to_river_m(lng: np.ndarray, lat: np.ndarray) -> np.ndarray:
    kx = 111320 * np.cos(np.radians(21.0))
    ky = 111320
    best = np.full(lng.shape, np.inf)
    for (x1, y1), (x2, y2) in zip(RED_RIVER, RED_RIVER[1:]):
        ax, ay = (lng - x1) * kx, (lat - y1) * ky
        bx, by = (x2 - x1) * kx, (y2 - y1) * ky
        t = np.clip((ax * bx + ay * by) / (bx * bx + by * by), 0, 1)
        best = np.minimum(best, np.hypot(ax - t * bx, ay - t * by))
    return best


def build_demo_grids(cell_id: np.ndarray, lng: np.ndarray, lat: np.ndarray) -> tuple[Path, Path]:
    rng = np.random.default_rng(20261109)
    river = distance_to_river_m(lng, lat)
    # Ngập demo: lòng sông và bãi sông (≤ 900 m) sâu 0,2–2,2 m, giảm dần ra xa; ngoài đê 0.
    depth = np.where(river <= 900, np.clip(2.2 * (1 - river / 900) + rng.normal(0, 0.15, river.shape), 0.05, None), 0.0)
    flood = DATA / f"processed/environment/demo/{LABEL}/flood_rp100.csv"
    write_grid_csv(flood, cell_id, np.where(inside_bbox(lng, lat), depth, np.nan), 2)
    # Cao độ demo: đồng bằng 6–12 m dốc nhẹ từ tây bắc xuống đông nam, bãi sông thấp hơn, dâng về núi Ba Vì.
    plain = 9 + (lat - 21.0) * 8 - (lng - 105.8) * 6
    ba_vi = 320 * np.exp(-np.hypot((lng - 105.37) * 104000, (lat - 21.07) * 111320) / 7000)
    bank = np.where(river <= 900, -2.5 * (1 - river / 900), 0)
    elevation = plain + ba_vi + bank + rng.normal(0, 0.4, lng.shape)
    elev = DATA / f"processed/environment/demo/{LABEL}/elev_100m.csv"
    write_grid_csv(elev, cell_id, np.where(inside_bbox(lng, lat), elevation, np.nan), 1)
    print("demo.flood_rp100, demo.elev_100m: số liệu demo")
    return flood, elev


# ───────────────────────────── đóng gói ─────────────────────────────


def package(layer: str, contract: str, data: Path, sources: list[str], tool: str, notes: str, grid: bool = False, manual: list[str] | None = None) -> None:
    target = DATA / "packages" / layer / LABEL / "package.zip"
    if target.exists():
        print(f"Bỏ qua {layer}: {target.relative_to(ROOT)} đã có (gói không ghi đè).")
        return
    args = SimpleNamespace(
        contract=contract,
        layer=layer,
        label=LABEL,
        data=str(data),
        source=sources,
        tool=tool,
        source_date=None,
        crs=None,
        coverage=None,
        grid_code=GRID["code"] if grid else None,
        param=["cell_m=100"] if grid else [],
        manual_step=manual or [],
        notes=notes,
    )
    if pack(args) != 0:
        raise SystemExit(f"Đóng gói {layer} thất bại.")


def main() -> int:
    global LABEL
    parser = argparse.ArgumentParser(description="Dựng bộ dữ liệu nền beta/demo v0 và đóng gói.")
    parser.add_argument("--only", nargs="*", default=None, help="chỉ dựng các lớp này (mã lớp)")
    parser.add_argument("--label", default=LABEL, help="nhãn gói (sửa gói thì thêm hậu tố, ví dụ v0-beta-r2)")
    args = parser.parse_args()
    LABEL = args.label
    want = (lambda code: args.only is None or code in args.only)
    tool = "tools/data/seed_v0.py"

    if want("osm.places"):
        data = build_places()
        catalog = update_snapshot("places/curated/2026-10-18.json", sha256_file(DATA / "curated/places/2026-10-18/places.ndjson"))
        package("osm.places", "point@1", data, [catalog], "tools/data/osm_places.py + tools/data/seed_v0.py", "Bản beta v0: điểm tiện ích OSM đã gộp trùng.")

    if want("osm.roads"):
        data, pbf = build_roads()
        catalog = update_snapshot("places/osm/2026-10-18.json", sha256_file(pbf))
        package("osm.roads", "line@1", data, [catalog], tool, "Bản beta v0: đường motorway–tertiary trong hộp Hà Nội.")

    need_grid = any(want(code) for code in ("worldpop.pop_100m", "esa.green_100m", "demo.flood_rp100", "demo.elev_100m"))
    if need_grid:
        cell_id, lng, lat = grid_centers()
        inside = inside_bbox(lng, lat)
        cell_id, lng, lat = cell_id[inside], lng[inside], lat[inside]

        if want("worldpop.pop_100m"):
            data, raster = build_population(cell_id, lng, lat)
            catalog = update_snapshot("environment/worldpop/R2025A.json", sha256_file(raster))
            package("worldpop.pop_100m", "grid@1", data, [catalog], tool, "Bản beta v0: dân số mỗi ô 100 m (lấy mẫu điểm gần nhất, quy đổi diện tích).", grid=True)

        if want("esa.green_100m"):
            data, tiles = build_green(cell_id)
            main_tile = next(tile for tile in tiles if "N21E105" in tile.name)
            catalog = update_snapshot(
                "environment/esa-worldcover/v200-2021.json",
                sha256_file(main_tile),
                extra_files=tiles,
                note="Ô N21E105 (21–24°B) và N18E105 (18–21°B) cùng phủ Hà Nội. sha256 chính là ô N21E105, từng ô có sha trong files.",
            )
            package("esa.green_100m", "grid@1", data, [catalog], tool, "Bản beta v0: % diện tích cây, cây bụi, cỏ, đất ngập nước mỗi ô 100 m (25 điểm mẫu/ô).", grid=True)

        if want("demo.flood_rp100") or want("demo.elev_100m"):
            flood, elev = build_demo_grids(cell_id, lng, lat)
            base = {
                "domain": "environment",
                "source": "demo",
                "version": LABEL,
                "stage": "processed",
                "url": None,
                "license": "CC0-1.0 (số liệu demo tự sinh, không phải đo thật)",
                "path": f"processed/environment/demo/{LABEL}",
            }
            if want("demo.flood_rp100"):
                catalog = update_snapshot(f"environment/demo/flood-{LABEL}.json", sha256_file(flood), extra_files=[flood], base=base, note="Độ sâu ngập GIẢ dọc sông Hồng. Thay bằng JRC ô 20–30°B khi tải được.")
                package("demo.flood_rp100", "grid@1", flood, [catalog], tool, "SỐ LIỆU DEMO: độ sâu ngập giả dọc sông Hồng, chỉ để thử.", grid=True, manual=["Sinh số liệu demo bằng tools/data/seed_v0.py (không phải đo thật)."])
            if want("demo.elev_100m"):
                catalog = update_snapshot(f"environment/demo/elev-{LABEL}.json", sha256_file(elev), extra_files=[elev], base=base, note="Cao độ GIẢ. Thay bằng FABDEM khi tải được.")
                package("demo.elev_100m", "grid@1", elev, [catalog], tool, "SỐ LIỆU DEMO: cao độ giả, chỉ để thử.", grid=True, manual=["Sinh số liệu demo bằng tools/data/seed_v0.py (không phải đo thật)."])
    return 0


if __name__ == "__main__":
    sys.exit(main())
