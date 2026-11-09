"""
Phân loại điểm y tế OSM theo tên (018-location-data): thẻ `amenity=hospital|clinic` trên OSM Hà Nội gắn lẫn trạm
y tế phường, phòng khám, nhà hộ sinh, thậm chí spa. Tiêu chí "Bệnh viện" chỉ đọc kind `hospital`, tiêu chí
"Cơ sở y tế" đọc kind `clinic` (backend criteria.ts).

    health_kind("Bệnh viện Bạch Mai", "clinic")   → "hospital"
    health_kind("Trạm y tế phường Láng Hạ", "hospital") → "clinic"
    health_kind("Bình An Spa", "hospital")          → None   (không phải cơ sở y tế: bỏ khỏi gói)

Dùng chung cho tools/data/osm_places.py và tools/data/seed_v0.py.
"""

from __future__ import annotations

import re
import unicodedata

NON_MEDICAL = re.compile(
    r"\b(spa|massage|tham my vien|nha thuoc|hieu thuoc|paris miki|kinh mat|thu y|pet|kinh doanh|day nha|chung cu)\b"
)
# Tên bắt đầu bằng loại cơ sở nhỏ thì là cơ sở y tế, kể cả khi nhắc bệnh viện chủ quản
# ("Phòng khám đa khoa Bệnh viện Đại học Y Hà Nội - Cơ sở Cầu Giấy").
CLINIC_PREFIX = re.compile(r"^(phong kham|pk|pkck|tram y te|tram xa|diem y te|diem tram|nha ho sinh|nha khoa|trung tam y te|ttyt)\b")
HOSPITAL = re.compile(r"(^|\b)(benh vien|bv|hospital|thu cuc)\b|^vien\b")
CLINIC = re.compile(
    r"\b(tram y te|tram xa|diem y te|diem tram|phong kham|pk|pkck|nha khoa|nha ho sinh|trung tam y te|ttyt|phong y te|"
    r"tiem chung|vac.?xin|vnvc|clinic|medical|y hoc|cham soc suc khoe|phuc hoi chuc nang|chiropractic|y te)\b"
)


def normalize(name: str) -> str:
    """Chữ thường, bỏ dấu tiếng Việt (đ → d), gộp khoảng trắng."""
    text = unicodedata.normalize("NFD", name.lower().replace("đ", "d"))
    text = "".join(ch for ch in text if unicodedata.category(ch) != "Mn")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", text)).strip()


def health_kind(name: str | None, osm_kind: str) -> str | None:
    """`hospital`, `clinic`, hoặc None nếu không phải cơ sở y tế (bỏ khỏi gói)."""
    text = normalize(name or "")
    if not text:
        # Không tên: không đủ căn cứ là bệnh viện, xếp vào cơ sở y tế.
        return "clinic"
    if NON_MEDICAL.search(text) and not HOSPITAL.search(text):
        return None
    if CLINIC_PREFIX.search(text):
        return "clinic"
    if HOSPITAL.search(text):
        return "hospital"
    if CLINIC.search(text):
        return "clinic"
    # Tên không nói gì (mã nhà, địa danh): giữ trong nhóm y tế nhưng không coi là bệnh viện.
    return "clinic" if osm_kind in ("hospital", "clinic") else None
