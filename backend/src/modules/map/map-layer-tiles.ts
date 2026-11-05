import { MAP_LAYER_TILE_ZOOM, VN_BOUNDS } from './map.constants.js';

/** Hộp bao [minLng, minLat, maxLng, maxLat] của ô Web Mercator (z, x, y). */
export function tileBounds(x: number, y: number, z = MAP_LAYER_TILE_ZOOM): [number, number, number, number] {
  const n = 2 ** z;
  const lngOf = (value: number): number => (value / n) * 360 - 180;
  const latOf = (value: number): number => (Math.atan(Math.sinh(Math.PI * (1 - (2 * value) / n))) * 180) / Math.PI;
  return [lngOf(x), latOf(y + 1), lngOf(x + 1), latOf(y)];
}

/** Ô có chạm hộp bao Việt Nam không (ngoài thì khỏi truy vấn). */
export function tileInVietnam(x: number, y: number, z = MAP_LAYER_TILE_ZOOM): boolean {
  const [minLng, minLat, maxLng, maxLat] = tileBounds(x, y, z);
  return maxLng >= VN_BOUNDS[0] && minLng <= VN_BOUNDS[2] && maxLat >= VN_BOUNDS[1] && minLat <= VN_BOUNDS[3];
}
