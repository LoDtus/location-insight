import { buildCriteriaSnapshot, canonicalJson, diffCriteria, hashCriteriaSnapshot } from './criteria-snapshot.js';

describe('criteria-snapshot (research.md Bản ghi 9)', () => {
  it('canonicalJson không phụ thuộc thứ tự khóa', () => {
    expect(canonicalJson({ b: 1, a: { d: [1, { y: 2, x: 1 }], c: null } })).toBe(canonicalJson({ a: { c: null, d: [1, { x: 1, y: 2 }] }, b: 1 }));
  });

  it('hash ổn định giữa hai lần chụp cùng code', () => {
    expect(hashCriteriaSnapshot(buildCriteriaSnapshot())).toBe(hashCriteriaSnapshot(buildCriteriaSnapshot()));
  });

  it('đổi một ngưỡng thì hash đổi', () => {
    const snapshot = buildCriteriaSnapshot();
    const changed = snapshot.map((item, index) => (index === 0 ? { ...item, defaultWeight: (item.defaultWeight ?? 0) + 1 } : item));
    expect(hashCriteriaSnapshot(changed)).not.toBe(hashCriteriaSnapshot(snapshot));
  });

  it('liệt kê tiêu chí thêm, bỏ và đổi so với bản trước', () => {
    const next = buildCriteriaSnapshot();
    const [first, second, ...rest] = next;
    const previous = [{ ...first, defaultWeight: 99 }, ...rest, { id: 'tieu-chi-cu', definition: {}, defaultWeight: 1 }];
    const changes = diffCriteria(previous, next);
    expect(changes).toEqual(
      expect.arrayContaining([
        { criterionId: first.id, change: 'changed' },
        { criterionId: second.id, change: 'added' },
        { criterionId: 'tieu-chi-cu', change: 'removed' },
      ]),
    );
    expect(changes).toHaveLength(3);
  });

  it('bỏ qua phần tử hỏng trong bản chụp cũ', () => {
    expect(diffCriteria([null, 5, 'x'], [])).toEqual([]);
  });
});
