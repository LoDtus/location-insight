import { buildPackage } from '../../../../test/helpers/package-zip.js';
import { parseManifest } from './package-contracts.js';

function validManifest(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const { manifest } = buildPackage({ data: Buffer.from('feature_key,category,lat,lng\n'), rowCount: 0 });
  return { ...manifest, ...overrides };
}

describe('parseManifest (package-contracts.md mục 2)', () => {
  it('nhận manifest đúng khuôn và giữ nguyên các trường', () => {
    const result = parseManifest(validManifest({ categories: { market: 3 } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.manifest.layer).toBe('osm.places');
    expect(result.manifest.contract).toBe('point@1');
    expect(result.manifest.categories).toEqual({ market: 3 });
    expect(result.manifest.gridCode).toBeNull();
  });

  it('gom mọi lỗi thay vì dừng ở lỗi đầu', () => {
    const result = parseManifest(validManifest({ contract: 'point@9', layer: 'OSM places', rowCount: -1, dataSha256: 'xyz' }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });

  it('không nhận hệ tọa độ mà khuôn không cho phép', () => {
    const result = parseManifest(validManifest({ crs: 'EPSG:3405' }));
    expect(result.ok).toBe(false);
  });

  it('khuôn grid bắt buộc gridCode', () => {
    const { manifest } = buildPackage({ contract: 'grid@1', data: Buffer.from('cell_id,value\n'), rowCount: 0 });
    expect(parseManifest(manifest).ok).toBe(true);
    expect(parseManifest({ ...manifest, gridCode: undefined }).ok).toBe(false);
  });

  it('nguồn phải trỏ vào data/catalog/snapshots và có giấy phép', () => {
    const traversal = parseManifest(validManifest({ sources: [{ catalog: 'data/catalog/snapshots/../../etc/passwd', sha256: 'a'.repeat(64), license: 'x' }] }));
    const noLicense = parseManifest(validManifest({ sources: [{ catalog: 'data/catalog/snapshots/a.json', sha256: 'a'.repeat(64), license: '' }] }));
    const empty = parseManifest(validManifest({ sources: [] }));
    expect(traversal.ok).toBe(false);
    expect(noLicense.ok).toBe(false);
    expect(empty.ok).toBe(false);
  });

  it('pipeline cần commit git và cờ dirty', () => {
    expect(parseManifest(validManifest({ pipeline: { tool: 'x', commit: 'not-a-commit', dirty: false } })).ok).toBe(false);
    expect(parseManifest(validManifest({ pipeline: { tool: 'x', commit: 'abc1234' } })).ok).toBe(false);
  });

  it('từ chối giá trị không phải object', () => {
    expect(parseManifest(null).ok).toBe(false);
    expect(parseManifest([1, 2]).ok).toBe(false);
  });
});
