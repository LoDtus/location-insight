import { describe, expect, it } from 'vitest';
import { buildIndexDefinition } from './search-analysis.js';
import {
  applyScoreCutoff,
  buildFieldClauses,
  buildSearchRequest,
  buildTextQuery,
} from './search-query.js';
import type { SearchFieldSpec } from './search.types.js';

const title: SearchFieldSpec = { name: 'title', boost: 1, short: true };
const body: SearchFieldSpec = { name: 'body', boost: 1, short: false };

describe('buildFieldClauses', () => {
  it('trường ngắn có đủ 7 tầng, tầng cụm đúng có dấu cao nhất', () => {
    const clauses = buildFieldClauses(title, 'hoan kiem');
    expect(clauses).toHaveLength(7);
    const boosts = clauses.map((clause) => {
      const match = /"boost":(\d+)/.exec(JSON.stringify(clause));
      return Number(match?.[1] ?? 0);
    });
    expect(Math.max(...boosts)).toBe(10);
    expect(boosts[0]).toBe(10);
  });

  it('trường dài không có chữ dính, gõ dở, fuzzy (BR-05)', () => {
    const clauses = buildFieldClauses(body, 'hoan kiem');
    const json = JSON.stringify(clauses);
    expect(clauses).toHaveLength(4);
    expect(json).not.toContain('fuzziness');
    expect(json).not.toContain('bool_prefix');
    expect(json).not.toContain('.compact');
  });

  it('nhân boost của trường vào mọi tầng', () => {
    const heavy = buildFieldClauses({ ...title, boost: 3 }, 'x y');
    expect(JSON.stringify(heavy[0])).toContain('"boost":30');
  });

  it('q đi vào ô query dạng chuỗi, không phải cú pháp truy vấn', () => {
    const hostile = '"a" OR title:* AND (b) \\ {"match_all":{}}';
    const query = buildTextQuery([title], hostile, []);
    const json = JSON.stringify(query);
    expect(json).not.toContain('query_string');
    expect(json).not.toContain('simple_query_string');
    const parsed = JSON.parse(json) as { bool: { should: unknown[] } };
    expect(parsed.bool.should).toHaveLength(7);
    // Mọi lần xuất hiện của q đều là giá trị của khóa "query".
    expect(json.split(JSON.stringify(hostile)).length - 1).toBe(7);
  });

  it('fuzzy giữ chữ đầu, giới hạn mở rộng', () => {
    const fuzzy = buildFieldClauses(title, 'kiem').find((c) =>
      JSON.stringify(c).includes('fuzziness'),
    );
    expect(JSON.stringify(fuzzy)).toContain('"fuzziness":"AUTO"');
    expect(JSON.stringify(fuzzy)).toContain('"prefix_length":1');
    expect(JSON.stringify(fuzzy)).toContain('"max_expansions":20');
  });
});

describe('buildSearchRequest', () => {
  const profile = {
    fields: [title],
    tieBreaker: [{ field: 'updatedAt', order: 'desc' as const }],
  };
  const filter = { term: { cityId: 'hn' } };

  it('mặc định: chỉ lấy id và điểm, xếp theo điểm rồi tieBreaker rồi docId', () => {
    const request = buildSearchRequest({
      index: 'places',
      profile,
      q: 'kiem',
      filters: [filter],
      page: { size: 20, from: 0 },
    });
    expect(request._source).toBe(false);
    expect(request.track_total_hits).toBe(false);
    expect(request.track_scores).toBe(false);
    expect(request.sort).toEqual([
      { _score: { order: 'desc' } },
      { updatedAt: { order: 'desc' } },
      { docId: { order: 'asc' } },
    ]);
    expect(request.query?.bool?.filter).toEqual([filter]);
  });

  it('sắp xếp tường minh: trường đó đứng đầu và vẫn tính điểm để cắt nhiễu (FR-06)', () => {
    const request = buildSearchRequest({
      index: 'places',
      profile,
      q: 'kiem',
      filters: [],
      page: { size: 10, from: 0 },
      sort: { field: 'createdAt', order: 'desc' },
    });
    expect(request.track_scores).toBe(true);
    expect((request.sort as unknown[])[0]).toEqual({
      createdAt: { order: 'desc' },
    });
  });
});

describe('applyScoreCutoff', () => {
  it('loại kết quả dưới 15% điểm cao nhất, giữ phần còn lại theo thứ tự', () => {
    const hits = [
      { id: 'a', score: 100 },
      { id: 'b', score: 40 },
      { id: 'c', score: 14.9 },
      { id: 'd', score: 15 },
    ];
    expect(applyScoreCutoff(hits).map((h) => h.id)).toEqual(['a', 'b', 'd']);
  });

  it('điểm tuyệt đối thấp vẫn được giữ khi nó là kết quả tốt nhất', () => {
    expect(applyScoreCutoff([{ id: 'only', score: 5.4 }])).toHaveLength(1);
  });

  it('giữ nguyên khi không có điểm', () => {
    const hits = [
      { id: 'a', score: null },
      { id: 'b', score: null },
    ];
    expect(applyScoreCutoff(hits)).toEqual(hits);
  });
});

describe('buildIndexDefinition', () => {
  const definition = buildIndexDefinition({
    fields: [title, body],
    filters: [{ name: 'cityId', type: 'keyword' }],
  });

  it('mapping strict, có docId và trường lọc', () => {
    expect(definition.mappings.dynamic).toBe('strict');
    expect(definition.mappings.properties).toHaveProperty('docId');
    expect(definition.mappings.properties).toHaveProperty('cityId');
  });

  it('trường ngắn có fold/compact/sayt, trường dài chỉ có fold', () => {
    const properties = definition.mappings.properties as Record<
      string,
      { fields?: Record<string, unknown> }
    >;
    expect(Object.keys(properties.title?.fields ?? {}).sort()).toEqual([
      'compact',
      'fold',
      'sayt',
    ]);
    expect(Object.keys(properties.body?.fields ?? {})).toEqual(['fold']);
  });

  it('refresh_interval mặc định 5s, ghi đè được theo profile', () => {
    expect(definition.settings.refresh_interval).toBe('5s');
    const fast = buildIndexDefinition({
      fields: [title],
      filters: [],
      refreshInterval: '1s',
    });
    expect(fast.settings.refresh_interval).toBe('1s');
  });
});
