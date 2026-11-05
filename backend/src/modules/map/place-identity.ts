import { haversineM } from './map.mapper.js';

/**
 * Nhận diện "một địa điểm" để đánh giá. Không dùng tọa độ thô (lệch 1–2 m là thành điểm khác), mà:
 *
 * 1. Cùng địa chỉ: điểm bấm có địa chỉ chính xác (Reverse cách điểm bấm ≤ 25 m) trùng khóa địa chỉ đã chuẩn hóa
 *    của một địa điểm có sẵn trong 150 m → cùng địa điểm (bấm hai góc của một tòa nhà vẫn là một).
 * 2. Gần nhau: không khớp địa chỉ thì lấy địa điểm gần nhất trong 20 m, với điều kiện địa điểm đó không mang
 *    một địa chỉ KHÁC (hai nhà liền kề cách 15 m vẫn là hai địa điểm).
 * 3. Không có → tạo địa điểm mới tại điểm bấm.
 */
export const PLACE_RADIUS_M = 20;
export const ADDRESS_MATCH_MAX_M = 150;
export const ADDRESS_PRECISE_M = 25;
/** Hộp tìm ứng viên quanh điểm bấm (đủ phủ bán kính khớp địa chỉ). */
export const CANDIDATE_BOX_M = ADDRESS_MATCH_MAX_M;

export interface PlaceCandidate {
  id: string;
  lat: number;
  lng: number;
  addressKey: string | null;
}

/** Chuẩn hóa địa chỉ để so: bỏ dấu, đ→d, thường hóa, bỏ dấu câu, gộp khoảng trắng. Quá ngắn thì không dùng. */
export function addressKeyOf(text: string | null | undefined): string | null {
  if (!text) return null;
  const key = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
  return key.length >= 8 ? key.slice(0, 300) : null;
}

/** Khóa địa chỉ chỉ dùng khi địa chỉ Reverse đủ sát điểm bấm. */
export function preciseAddressKey(display: string | null | undefined, distanceM: number | null | undefined): string | null {
  if (distanceM === null || distanceM === undefined || distanceM > ADDRESS_PRECISE_M) return null;
  return addressKeyOf(display);
}

/** Chọn địa điểm có sẵn cho điểm bấm theo quy tắc ở đầu file; null nếu phải tạo mới. */
export function pickPlace(
  point: { lat: number; lng: number },
  addressKey: string | null,
  candidates: readonly PlaceCandidate[],
): PlaceCandidate | null {
  const withDistance = candidates
    .map((candidate) => ({ candidate, distance: haversineM(point, candidate) }))
    .sort((a, b) => a.distance - b.distance);
  if (addressKey) {
    const same = withDistance.find((item) => item.candidate.addressKey === addressKey && item.distance <= ADDRESS_MATCH_MAX_M);
    if (same) return same.candidate;
  }
  const near = withDistance.find(
    (item) =>
      item.distance <= PLACE_RADIUS_M &&
      (item.candidate.addressKey === null || addressKey === null || item.candidate.addressKey === addressKey),
  );
  return near?.candidate ?? null;
}

/** Hộp bao [minLat, maxLat, minLng, maxLng] quanh điểm để lọc ứng viên bằng index trước khi tính haversine. */
export function boxAround(point: { lat: number; lng: number }, meters: number): [number, number, number, number] {
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.max(0.1, Math.cos((point.lat * Math.PI) / 180)));
  return [point.lat - dLat, point.lat + dLat, point.lng - dLng, point.lng + dLng];
}

/** Ô lưới ~100 m dùng làm khóa advisory lock khi tạo địa điểm, tránh hai yêu cầu đồng thời tạo trùng. */
export function gridCellOf(point: { lat: number; lng: number }): string {
  return `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
}
