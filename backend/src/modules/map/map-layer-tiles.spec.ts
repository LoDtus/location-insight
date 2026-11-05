import { describe, expect, it } from 'vitest';
import { tileBounds, tileInVietnam } from './map-layer-tiles.js';

/** Đặc tả: workspace/features/013-map/README.md §4g (ô lớp bản đồ zoom 13). */
function tileOf(lat: number, lng: number, z = 13): { x: number; y: number } {
  const n = 2 ** z;
  const rad = (lat * Math.PI) / 180;
  return {
    x: Math.floor(((lng + 180) / 360) * n),
    y: Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n),
  };
}

describe('ô lớp bản đồ', () => {
  it('ô chứa Hồ Gươm bao đúng Hồ Gươm, cạnh ~4,6 km ở vĩ độ Hà Nội', () => {
    const { x, y } = tileOf(21.0287, 105.8524);
    const [minLng, minLat, maxLng, maxLat] = tileBounds(x, y);
    expect(minLng).toBeLessThanOrEqual(105.8524);
    expect(maxLng).toBeGreaterThan(105.8524);
    expect(minLat).toBeLessThanOrEqual(21.0287);
    expect(maxLat).toBeGreaterThan(21.0287);
    expect((maxLng - minLng) * 111.32 * Math.cos((21.03 * Math.PI) / 180)).toBeCloseTo(4.57, 1);
  });

  it('ô ngoài Việt Nam không truy vấn', () => {
    const paris = tileOf(48.85, 2.35);
    expect(tileInVietnam(paris.x, paris.y)).toBe(false);
    const hanoi = tileOf(21.0287, 105.8524);
    expect(tileInVietnam(hanoi.x, hanoi.y)).toBe(true);
  });
});
