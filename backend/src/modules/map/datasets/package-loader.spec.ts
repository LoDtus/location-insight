import { Readable } from 'node:stream';
import { readCommon, readLines } from './package-loader.js';
import { coverageGeometries } from './dataset-import.service.js';

describe('readCommon (cột chung của khuôn đối tượng)', () => {
  it('nhận dòng hợp lệ và chuẩn hóa attrs', () => {
    const result = readCommon('osm:n1', 'market', 'Chợ Hôm', 'TRUE', '{ "a" : 1 }');
    expect(result.error).toBeNull();
    expect(result.value).toEqual({ featureKey: 'osm:n1', category: 'market', name: 'Chợ Hôm', isPlanned: true, attrs: '{"a":1}' });
  });

  it.each([
    ['feature_key trống', ['', 'market', '', '', '']],
    ['feature_key có khoảng trắng', ['osm n1', 'market', '', '', '']],
    ['category viết hoa', ['k', 'Market', '', '', '']],
    ['is_planned lạ', ['k', 'market', '', 'yes', '']],
    ['attrs không phải object', ['k', 'market', '', '', '[1,2]']],
    ['attrs không phải JSON', ['k', 'market', '', '', '{a:1}']],
    ['attrs quá lớn', ['k', 'market', '', '', JSON.stringify({ a: 'x'.repeat(5000) })]],
    ['name quá dài', ['k', 'market', 'x'.repeat(201), '', '']],
  ] as Array<[string, [string, string, string, string, string]]>)('từ chối %s', (_label, args) => {
    expect(readCommon(...args).error).not.toBeNull();
  });
});

describe('readLines', () => {
  it('tách dòng qua ranh chunk và bỏ \\r', async () => {
    const lines: string[] = [];
    for await (const line of readLines(Readable.from([Buffer.from('a\r\nb'), Buffer.from('c\nd')]), 100)) lines.push(line);
    expect(lines).toEqual(['a', 'bc', 'd']);
  });

  it('báo lỗi dòng quá dài', async () => {
    const run = async (): Promise<void> => {
      for await (const line of readLines(Readable.from([Buffer.from('x'.repeat(50))]), 10)) void line;
    };
    await expect(run()).rejects.toThrow(/dài quá/);
  });
});

describe('coverageGeometries', () => {
  const polygon = { type: 'Polygon', coordinates: [[[105.8, 21], [105.9, 21], [105.9, 21.1], [105.8, 21]]] };

  it('nhận Geometry, Feature và FeatureCollection đa giác', () => {
    expect(coverageGeometries(JSON.stringify(polygon))).toHaveLength(1);
    expect(coverageGeometries(JSON.stringify({ type: 'Feature', geometry: polygon, properties: {} }))).toHaveLength(1);
    expect(
      coverageGeometries(JSON.stringify({ type: 'FeatureCollection', features: [{ type: 'Feature', geometry: polygon }, { type: 'Feature', geometry: polygon }] })),
    ).toHaveLength(2);
  });

  it('từ chối JSON hỏng hoặc không có đa giác', () => {
    expect(() => coverageGeometries('{')).toThrow();
    expect(() => coverageGeometries(JSON.stringify({ type: 'Point', coordinates: [1, 2] }))).toThrow();
  });
});
