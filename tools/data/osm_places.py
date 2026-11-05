"""
Trích điểm tiện ích Hà Nội từ OSM cho các lớp bản đồ (013-map §4g).

    python -m venv .venv && .venv/bin/pip install osmium
    .venv/bin/python tools/data/osm_places.py data/raw/places/osm/2026-10-18/vietnam-261017.osm.pbf 2026-10-18

Ra hai tệp (byte dữ liệu không vào git, xem data/README.md):
    data/processed/places/osm/{phien-ban}/places.ndjson   mỗi điểm OSM một dòng, chưa gộp trùng
    data/curated/places/{phien-ban}/places.ndjson         đã gộp trùng: cùng nhóm, cách nhau < 40 m là một chỗ
và biên bản data/catalog/snapshots/places/curated/{phien-ban}.json (được commit; không đụng biên bản raw).
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path

import osmium

# Hộp bao Hà Nội [minLng, minLat, maxLng, maxLat].
HANOI_BBOX = (105.28, 20.56, 106.02, 21.39)
DEDUPE_M = 40.0

# Nhóm lớp bản đồ ← thẻ OSM (khớp tieu-chi.md). Thứ tự quan trọng: thẻ đầu tiên khớp thắng.
RULES: list[tuple[str, str, set[str]]] = [
    ("school", "amenity", {"school", "kindergarten", "college", "university"}),
    ("bank", "amenity", {"bank", "atm"}),
    ("market", "amenity", {"marketplace"}),
    ("pharmacy", "amenity", {"pharmacy"}),
    ("hospital", "amenity", {"hospital", "clinic"}),
    ("food", "amenity", {"restaurant", "cafe", "fast_food"}),
    ("townhall", "amenity", {"townhall"}),
    ("supermarket", "shop", {"supermarket"}),
    ("hardware", "shop", {"doityourself", "hardware"}),
    ("park", "leisure", {"park"}),
    ("bus", "highway", {"bus_stop"}),
    ("metro", "station", {"subway"}),
]

ROOT = Path(__file__).resolve().parents[2]


def category_of(tags: osmium.osm.TagList) -> tuple[str, str] | None:
    for category, key, values in RULES:
        value = tags.get(key)
        if value in values:
            return category, value
    return None


def in_hanoi(lat: float, lng: float) -> bool:
    return HANOI_BBOX[0] <= lng <= HANOI_BBOX[2] and HANOI_BBOX[1] <= lat <= HANOI_BBOX[3]


def clean(value: str | None, limit: int) -> str:
    if not value:
        return ""
    return " ".join(value.split())[:limit]


class Handler(osmium.SimpleHandler):
    def __init__(self) -> None:
        super().__init__()
        self.rows: list[dict] = []

    def add(self, kind: str, osm_id: int, tags: osmium.osm.TagList, lat: float, lng: float) -> None:
        match = category_of(tags)
        if not match or not in_hanoi(lat, lng):
            return
        category, value = match
        self.rows.append(
            {
                "sourceId": f"{kind}{osm_id}",
                "category": category,
                "kind": value,
                "name": clean(tags.get("name:vi") or tags.get("name") or tags.get("brand") or tags.get("operator"), 160),
                "lat": round(lat, 6),
                "lng": round(lng, 6),
            }
        )

    def node(self, n: osmium.osm.Node) -> None:
        if n.tags and n.location.valid():
            self.add("n", n.id, n.tags, n.location.lat, n.location.lon)

    def way(self, w: osmium.osm.Way) -> None:
        if not w.tags or category_of(w.tags) is None:
            return
        points = [(node.location.lat, node.location.lon) for node in w.nodes if node.location.valid()]
        if not points:
            return
        lat = sum(point[0] for point in points) / len(points)
        lng = sum(point[1] for point in points) / len(points)
        self.add("w", w.id, w.tags, lat, lng)


def distance_m(a: dict, b: dict) -> float:
    rad = math.radians
    h = math.sin(rad(b["lat"] - a["lat"]) / 2) ** 2 + math.cos(rad(a["lat"])) * math.cos(rad(b["lat"])) * math.sin(rad(b["lng"] - a["lng"]) / 2) ** 2
    return 2 * 6371008.8 * math.asin(math.sqrt(h))


def dedupe(rows: list[dict]) -> list[dict]:
    """Cùng nhóm, cách nhau < 40 m là một chỗ. Giữ điểm có tên (rồi điểm vẽ dạng vùng)."""
    ordered = sorted(rows, key=lambda row: (row["name"] == "", row["sourceId"][0] != "w", row["sourceId"]))
    grid: dict[tuple[str, int, int], list[dict]] = defaultdict(list)
    kept: list[dict] = []
    cell = 0.0005  # ~50 m
    for row in ordered:
        gx, gy = int(row["lng"] / cell), int(row["lat"] / cell)
        neighbours = (
            other
            for dx in (-1, 0, 1)
            for dy in (-1, 0, 1)
            for other in grid[(row["category"], gx + dx, gy + dy)]
        )
        if any(distance_m(row, other) < DEDUPE_M for other in neighbours):
            continue
        grid[(row["category"], gx, gy)].append(row)
        kept.append(row)
    return kept


def write_ndjson(path: Path, rows: list[dict]) -> str:
    path.parent.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256()
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            line = json.dumps(row, ensure_ascii=False) + "\n"
            handle.write(line)
            digest.update(line.encode("utf-8"))
    return digest.hexdigest()


def main() -> None:
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    source = Path(sys.argv[1]).resolve()
    version = sys.argv[2]
    handler = Handler()
    handler.apply_file(str(source), locations=True, idx="flex_mem")
    raw = sorted(handler.rows, key=lambda row: row["sourceId"])
    curated = sorted(dedupe(raw), key=lambda row: (row["category"], row["sourceId"]))

    processed_path = ROOT / "data/processed/places/osm" / version / "places.ndjson"
    curated_path = ROOT / "data/curated/places" / version / "places.ndjson"
    processed_sha = write_ndjson(processed_path, raw)
    curated_sha = write_ndjson(curated_path, curated)

    # Biên bản theo mẫu data/catalog/snapshot.example.json; bản raw đã có biên bản riêng, không ghi đè.
    snapshot = {
        "domain": "places",
        "source": "osm",
        "version": version,
        "stage": "curated",
        "upstream_version": None,
        "retrieved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "url": None,
        "license": "ODbL",
        "path": str(curated_path.parent.relative_to(ROOT / "data")),
        "files": [
            {"path": str(processed_path.relative_to(ROOT / "data")), "sha256": processed_sha, "bytes": processed_path.stat().st_size, "records": len(raw)},
            {"path": str(curated_path.relative_to(ROOT / "data")), "sha256": curated_sha, "bytes": curated_path.stat().st_size, "records": len(curated)},
        ],
        "record_count": len(curated),
        "bbox": list(HANOI_BBOX),
        "by_category": dict(sorted(Counter(row["category"] for row in curated).items())),
        "notes": (
            f"Trích từ {source.relative_to(ROOT / 'data')}: điểm tiện ích Hà Nội cho lớp bản đồ. "
            f"Gộp trùng cùng nhóm cách nhau < {DEDUPE_M:g} m. Điểm dạng vùng lấy trung bình các đỉnh. "
            "Chợ cóc, cửa hàng vật tư rất thưa trên OSM."
        ),
    }
    catalog = ROOT / "data/catalog/snapshots/places/curated" / f"{version}.json"
    catalog.parent.mkdir(parents=True, exist_ok=True)
    catalog.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(snapshot, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
