import type { District } from "@/features/landing-page/data/listings";

/** Tâm gần đúng của từng quận/huyện, dùng khi tin chưa có tọa độ chính xác. */
export const DISTRICT_CENTERS: Record<District, { lat: number; lng: number }> = {
    "Hoàn Kiếm": { lat: 21.0287, lng: 105.8523 },
    "Ba Đình": { lat: 21.0341, lng: 105.8143 },
    "Đống Đa": { lat: 21.0181, lng: 105.8292 },
    "Hai Bà Trưng": { lat: 21.0059, lng: 105.8573 },
    "Cầu Giấy": { lat: 21.0326, lng: 105.793 },
    "Tây Hồ": { lat: 21.07, lng: 105.819 },
    "Long Biên": { lat: 21.0469, lng: 105.893 },
    "Hoàng Mai": { lat: 20.9756, lng: 105.8636 },
    "Nam Từ Liêm": { lat: 21.013, lng: 105.765 },
    "Bắc Từ Liêm": { lat: 21.07, lng: 105.754 },
    "Đông Anh": { lat: 21.137, lng: 105.85 },
    "Hoài Đức": { lat: 21.03, lng: 105.7 },
};
