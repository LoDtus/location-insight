import { describe, expect, it } from 'vitest';
import {
  cleanText,
  normalizeDepartAt,
  parseLatLng,
  redactUrl,
  reverseCacheKey,
  routeCacheKey,
  searchCacheKey,
  simplify,
  toPlaceFromPlace,
  toPlaceFromReverse,
  toRoutes,
  toSuggestions,
} from './map.mapper.js';

describe('cleanText', () => {
  it('bỏ ký tự điều khiển và gộp khoảng trắng', () => {
    expect(cleanText('  hồ\r\n gươm\t\u0000 ')).toBe('hồ gươm');
  });
  it('cắt độ dài', () => {
    expect(cleanText('a'.repeat(500), 10)).toHaveLength(10);
  });
});

describe('redactUrl', () => {
  it('che khóa API ở mọi vị trí', () => {
    expect(redactUrl('https://x/y?apikey=abc123&text=a')).toBe('https://x/y?apikey=***&text=a');
    expect(redactUrl('https://x/y?text=a&apikey=abc123')).toBe('https://x/y?text=a&apikey=***');
  });
});

describe('parseLatLng', () => {
  it('nhận tọa độ hợp lệ trong Việt Nam', () => {
    expect(parseLatLng('21.0285,105.8542')).toEqual([21.0285, 105.8542]);
    expect(parseLatLng(' 21.0285 , 105.8542 ')).toEqual([21.0285, 105.8542]);
  });
  it('từ chối sai hình dạng, ngoài hộp bao và đảo lat/lng', () => {
    expect(parseLatLng('abc')).toBeNull();
    expect(parseLatLng('21.0285')).toBeNull();
    expect(parseLatLng('48.85,2.35')).toBeNull();
    expect(parseLatLng('105.8542,21.0285')).toBeNull();
    expect(parseLatLng('21.0285,105.8542&apikey=x')).toBeNull();
  });
});

describe('khóa cache', () => {
  it('gợi ý: không phân biệt hoa thường/khoảng trắng, focus gần nhau trùng khóa', () => {
    const a = searchCacheKey('Hồ  Gươm', 21.0281, 105.8542, 8);
    const b = searchCacheKey('hồ gươm ', 21.0284, 105.8539, 8);
    expect(a).toBe(b);
    expect(searchCacheKey('hồ gươm', 21.1, 105.85, 8)).not.toBe(a);
  });
  it('reverse và route làm tròn 5 chữ số', () => {
    expect(reverseCacheKey(21.0285001, 105.8542004)).toBe('21.0285,105.8542');
    expect(routeCacheKey([105.1, 21.1], [105.2, 21.2], 'car', false)).toBe(
      'car|one|105.1,21.1|105.2,21.2||',
    );
  });
});

describe('bộ lọc trong khóa cache', () => {
  it('bộ lọc khác nhau → khóa khác nhau', () => {
    const base = searchCacheKey('cafe', 21.0285, 105.8542, 8);
    expect(searchCacheKey('cafe', 21.0285, 105.8542, 8, { cats: '3001' })).not.toBe(base);
    expect(searchCacheKey('cafe', 21.0285, 105.8542, 8, { radius: 500 })).not.toBe(base);
    expect(searchCacheKey('cafe', 21.0285, 105.8542, 8, { distId: 1291 })).not.toBe(
      searchCacheKey('cafe', 21.0285, 105.8542, 8, { wardId: 1291 }),
    );
  });
  it('route: tránh phà và giờ khởi hành đổi khóa', () => {
    const a = routeCacheKey([1, 2], [3, 4], 'car', false);
    expect(routeCacheKey([1, 2], [3, 4], 'car', false, 'ferry')).not.toBe(a);
    expect(routeCacheKey([1, 2], [3, 4], 'car', false, '', '2026-11-03T01:00:00Z')).not.toBe(a);
  });
});

describe('normalizeDepartAt', () => {
  it('làm tròn xuống 15 phút', () => {
    expect(normalizeDepartAt('2026-11-03T01:07:30Z')).toBe('2026-11-03T01:00:00Z');
    expect(normalizeDepartAt('2026-11-03T01:44:00Z')).toBe('2026-11-03T01:30:00Z');
  });
  it('từ chối sai dạng hoặc ngày không có thật', () => {
    expect(normalizeDepartAt('2026-11-03 01:00')).toBeNull();
    expect(normalizeDepartAt('2026-13-45T01:00:00Z')).toBeNull();
    expect(normalizeDepartAt('2026-11-03T01:00:00+07:00')).toBeNull();
  });
});

describe('toSuggestions', () => {
  const raw = [
    {
      ref_id: 'auto:ABC',
      name: 'Hồ Gươm Plaza',
      address: 'Phường Hàng Bạc, Quận Hoàn Kiếm, Thành phố Hà Nội',
      display: 'Hồ Gươm Plaza Phường Hàng Bạc, Quận Hoàn Kiếm, Thành phố Hà Nội',
      distance: 0.46,
      data_new: {
        address: 'Phường Hoàn Kiếm, Thành phố Hà Nội',
        display: 'Hồ Gươm Plaza, Phường Hoàn Kiếm, Thành phố Hà Nội',
      },
    },
    { name: 'thiếu ref_id' },
    'rác',
  ];
  it('ưu tiên địa chỉ mới, giữ địa chỉ cũ, bỏ phần tử hỏng', () => {
    const out = toSuggestions(raw);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      refId: 'auto:ABC',
      address: 'Phường Hoàn Kiếm, Thành phố Hà Nội',
      addressOld: 'Phường Hàng Bạc, Quận Hoàn Kiếm, Thành phố Hà Nội',
      distanceKm: 0.46,
    });
  });
  it('rơi về địa chỉ cũ khi không có data_new; chịu đầu vào không phải mảng', () => {
    const out = toSuggestions([{ ref_id: 'x', name: 'A', address: 'B', display: 'A B' }]);
    expect(out[0]).toMatchObject({ address: 'B', addressOld: null });
    expect(toSuggestions(null)).toEqual([]);
    expect(toSuggestions({})).toEqual([]);
  });
  it('tôn trọng limit', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ ref_id: `r${i}`, name: `n${i}` }));
    expect(toSuggestions(many, 3)).toHaveLength(3);
    expect(toSuggestions(many, 99)).toHaveLength(10);
  });
});

describe('toPlaceFromPlace', () => {
  it('lấy tọa độ và ghép địa chỉ không lặp', () => {
    const place = toPlaceFromPlace({
      display: 'Quận Hoàn Kiếm, Thành phố Hà Nội',
      name: 'Quận Hoàn Kiếm',
      address: 'Quận Hoàn Kiếm, Thành phố Hà Nội',
      city: 'Thành phố Hà Nội',
      district: 'Quận Hoàn Kiếm',
      ward: '',
      lat: 21.0287,
      lng: 105.8507,
    });
    expect(place).toMatchObject({ lat: 21.0287, lng: 105.8507, name: 'Quận Hoàn Kiếm' });
    expect(place?.address).toBe('Quận Hoàn Kiếm, Thành phố Hà Nội');
  });
  it('ghép số nhà + phường + thành phố', () => {
    const place = toPlaceFromPlace({
      display: '197 Đường Trần Phú,Phường Chợ Quán,Thành Phố Hồ Chí Minh',
      address: '197 Đường Trần Phú',
      ward: 'Phường Chợ Quán',
      district: '',
      city: 'Thành Phố Hồ Chí Minh',
      lat: 10.7592,
      lng: 106.6759,
    });
    expect(place?.address).toBe('197 Đường Trần Phú, Phường Chợ Quán, Thành Phố Hồ Chí Minh');
    expect(place?.display).toBe('197 Đường Trần Phú, Phường Chợ Quán, Thành Phố Hồ Chí Minh');
  });
  it('từ chối tọa độ ngoài Việt Nam hoặc không phải số', () => {
    expect(toPlaceFromPlace({ lat: 48, lng: 2, display: 'x' })).toBeNull();
    expect(toPlaceFromPlace({ lat: '21', lng: '105' })).toBeNull();
    expect(toPlaceFromPlace(null)).toBeNull();
  });
});

describe('toPlaceFromReverse', () => {
  it('lấy địa chỉ mới từ data_new, cũ ở addressOld', () => {
    const place = toPlaceFromReverse([
      {
        lat: 21.0285,
        lng: 105.8542,
        name: '17 Trần Nguyên Hãn',
        address: 'Phường Lý Thái Tổ,Quận Hoàn Kiếm,Thành Phố Hà Nội',
        display: '17 Trần Nguyên Hãn Phường Lý Thái Tổ,Quận Hoàn Kiếm,Thành Phố Hà Nội',
        data_new: {
          address: 'Phường Hoàn Kiếm,Thành phố Hà Nội',
          display: '17 Trần Nguyên Hãn Phường Hoàn Kiếm,Thành phố Hà Nội',
        },
      },
    ]);
    expect(place?.address).toBe('Phường Hoàn Kiếm, Thành phố Hà Nội');
    expect(place?.addressOld).toContain('Lý Thái Tổ');
  });
  it('mảng rỗng hoặc hỏng → null', () => {
    expect(toPlaceFromReverse([])).toBeNull();
    expect(toPlaceFromReverse([{ lat: 1 }])).toBeNull();
  });
});

describe('toRoutes', () => {
  const raw = {
    paths: [
      {
        distance: 4679.8,
        time: 991385,
        bbox: [105.8, 21.0, 105.9, 21.1],
        points: {
          type: 'LineString',
          coordinates: [
            [105.85, 21.02],
            [105.86, 21.03],
            [105.87, 21.04],
          ],
        },
        instructions: [{ text: 'rẽ phải vào Lý Thái Tổ', distance: 1257, time: 351970, sign: 2, street_name: 'Lý Thái Tổ' }, { text: '' }],
        annotations: {
          congestion: [
            { value: 'heavy', first: 0, last: 1 },
            { value: 'weird', first: 1, last: 2 },
          ],
        },
      },
      { points: { coordinates: [[1, 1]] } },
    ],
  };
  it('chuẩn hóa tuyến, đổi ms → giây, tắc theo đoạn, bỏ tuyến/bước hỏng', () => {
    const routes = toRoutes(raw);
    expect(routes).toHaveLength(1);
    expect(routes[0].durationS).toBe(991);
    expect(routes[0].steps).toEqual([
      { text: 'rẽ phải vào Lý Thái Tổ', distanceM: 1257, durationS: 352, sign: 2, street: 'Lý Thái Tổ' },
    ]);
    expect(routes[0].congestion).toEqual(['heavy', 'unknown']);
    expect(routes[0].geometry[0]).toEqual([105.85, 21.02]);
  });
  it('đầu vào hỏng → mảng rỗng', () => {
    expect(toRoutes(null)).toEqual([]);
    expect(toRoutes({ paths: 'x' })).toEqual([]);
  });
});

describe('simplify', () => {
  it('giữ đỉnh đầu/cuối và không vượt trần', () => {
    const pts = Array.from({ length: 1000 }, (_, i) => [i, i] as [number, number]);
    const out = simplify(pts, 100);
    expect(out).toHaveLength(100);
    expect(out[0]).toEqual([0, 0]);
    expect(out[99]).toEqual([999, 999]);
  });
});
