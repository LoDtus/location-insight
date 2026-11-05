import { describe, expect, it } from 'vitest';
import { addressKeyOf, pickPlace, preciseAddressKey, type PlaceCandidate } from './place-identity.js';

/** Đặc tả: workspace/features/013-map/README.md §4d (nhận diện địa điểm). */
const base = { lat: 21.0287, lng: 105.8524 };
/** Dời điểm về phía bắc `meters` mét. */
function north(meters: number): { lat: number; lng: number } {
  return { lat: base.lat + meters / 111_320, lng: base.lng };
}

const home: PlaceCandidate = { id: 'home', ...base, addressKey: addressKeyOf('20 Lê Thái Tổ, Phường Hoàn Kiếm, Hà Nội') };

describe('place-identity', () => {
  it('bấm lệch 1–2 m vẫn là cùng địa điểm', () => {
    expect(pickPlace(north(2), null, [home])?.id).toBe('home');
    expect(pickPlace(north(19), null, [home])?.id).toBe('home');
  });

  it('xa hơn 20 m và không khớp địa chỉ thì là địa điểm mới', () => {
    expect(pickPlace(north(30), null, [home])).toBeNull();
  });

  it('cùng địa chỉ trong 150 m là cùng địa điểm (hai góc một tòa nhà)', () => {
    expect(pickPlace(north(80), addressKeyOf('20 Le Thai To, phuong Hoan Kiem, Ha Noi'), [home])?.id).toBe('home');
    expect(pickPlace(north(200), home.addressKey, [home])).toBeNull();
  });

  it('nhà liền kề có địa chỉ khác thì không gộp dù chỉ cách 15 m', () => {
    expect(pickPlace(north(15), addressKeyOf('22 Lê Thái Tổ, Phường Hoàn Kiếm, Hà Nội'), [home])).toBeNull();
  });

  it('chọn địa điểm gần nhất khi có nhiều ứng viên', () => {
    const other: PlaceCandidate = { id: 'other', ...north(12), addressKey: null };
    expect(pickPlace(north(10), null, [home, other])?.id).toBe('other');
  });

  it('chỉ dùng khóa địa chỉ khi Reverse đủ sát điểm bấm', () => {
    expect(preciseAddressKey('20 Lê Thái Tổ, Hoàn Kiếm', 8)).toBe('20 le thai to hoan kiem');
    expect(preciseAddressKey('20 Lê Thái Tổ, Hoàn Kiếm', 60)).toBeNull();
    expect(addressKeyOf('Hà Nội')).toBeNull();
  });
});
