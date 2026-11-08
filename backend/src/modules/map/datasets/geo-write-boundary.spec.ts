import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * Test kiến trúc (018-location-data AC-12, threat model T11): chỉ module datasets được ghi vào schema geo
 * hoặc bật cờ geo.write_mode. Mọi đường ghi khác phải đi qua gói chuẩn tải lên /admin/datasets.
 */
const SRC = resolve(__dirname, '../../..');
const ALLOWED_DIR = resolve(__dirname);
const WRITE_PATTERN = /\b(INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE(\s+TABLE)?|COPY)\s+"?geo(_staging)?"?\./i;
const FLAG_PATTERN = /geo\.write_mode/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return name.endsWith('.ts') && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

describe('ranh giới ghi schema geo', () => {
  it('chỉ module datasets có lệnh ghi geo hoặc dùng geo.write_mode', () => {
    const offenders = sourceFiles(SRC)
      .filter((path) => !path.startsWith(ALLOWED_DIR))
      .filter((path) => {
        const text = readFileSync(path, 'utf8');
        return WRITE_PATTERN.test(text) || FLAG_PATTERN.test(text);
      })
      .map((path) => relative(SRC, path));
    expect(offenders).toEqual([]);
  });

  it('mẫu tìm kiếm bắt được lệnh ghi (để test trên không đạt nhờ regex hỏng)', () => {
    expect(WRITE_PATTERN.test('INSERT INTO geo.point_features (id)')).toBe(true);
    expect(WRITE_PATTERN.test('delete from geo_staging.point_rows')).toBe(true);
    expect(WRITE_PATTERN.test('SELECT * FROM geo.point_features')).toBe(false);
  });
});
