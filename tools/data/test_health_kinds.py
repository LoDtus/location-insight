"""python3 -m unittest tools/data/test_health_kinds.py"""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from health_kinds import health_kind, normalize  # noqa: E402


class HealthKindTest(unittest.TestCase):
    def test_hospitals(self) -> None:
        for name in ["Bệnh viện Bạch Mai", "BV Thận Hà Nội", "Viện Huyết học", "Thu Cúc TCI Thanh Xuân", "District Hospital", "Bệnh viện Thẩm mỹ Kangnam"]:
            self.assertEqual(health_kind(name, "clinic"), "hospital", name)

    def test_clinics(self) -> None:
        for name in ["Trạm y tế phường Láng Hạ", "Tram y te Thach That", "Điểm Trạm Y Tế Hoàng Văn Thụ", "Phòng khám đa khoa Medlatec", "Nhà hộ sinh Đống Đa", "Trung tâm Y tế quận Thanh Xuân", "Nha khoa Paris", "VNVC Phố Nhổn", "",
                     "Phòng khám đa khoa Bệnh viện Đại học Y Hà Nội - Cơ sở Cầu Giấy", "Phòng khám Đa khoa Kỹ thuật cao Bệnh viện Hà Thành"]:
            self.assertEqual(health_kind(name, "hospital"), "clinic", name)

    def test_non_medical(self) -> None:
        for name in ["Bình An Spa", "Thẩm mỹ viện Ngọc Dung", "Nhà thuốc đông y Bùi Tộc", "Paris Miki Vietnam", "KINH DOANH"]:
            self.assertIsNone(health_kind(name, "hospital"), name)

    def test_normalize(self) -> None:
        self.assertEqual(normalize("  Đường  Láng-Hạ "), "duong lang ha")


if __name__ == "__main__":
    unittest.main()
