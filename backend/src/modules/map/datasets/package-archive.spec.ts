import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildZip, type ZipFixtureEntry } from '../../../../test/helpers/package-zip.js';
import { extractArchiveEntry, PackageArchiveError, readArchiveEntries } from './package-archive.js';

const ALLOWED = new Set(['manifest.json', 'data.csv', 'coverage.geojson']);
const LIMITS = { entriesMax: 3, uncompressedMaxBytes: 1024 * 1024, compressionRatioMax: 100 };

describe('package-archive (threat model T14)', () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'archive-spec-'));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function writeZip(entries: ZipFixtureEntry[]): Promise<string> {
    const path = join(dir, 'package.zip');
    await writeFile(path, buildZip(entries));
    return path;
  }

  it('liệt kê và giải nén đúng nội dung, cả store lẫn deflate', async () => {
    const csv = Buffer.from('feature_key,category\nk1,market\n'.repeat(50));
    const path = await writeZip([
      { name: 'manifest.json', data: Buffer.from('{"a":1}'), method: 'store' },
      { name: 'data.csv', data: csv },
    ]);
    const entries = await readArchiveEntries(path, ALLOWED, LIMITS);
    expect(entries.map((entry) => entry.name)).toEqual(['manifest.json', 'data.csv']);
    for (const entry of entries) await extractArchiveEntry(path, entry, join(dir, entry.name));
    expect(await readFile(join(dir, 'data.csv'))).toEqual(csv);
    expect(await readFile(join(dir, 'manifest.json'), 'utf8')).toBe('{"a":1}');
  });

  it.each([
    ['tên không có trong danh sách', [{ name: 'evil.sh', data: Buffer.from('x') }]],
    ['đường dẫn thoát thư mục', [{ name: '../data.csv', data: Buffer.from('x') }]],
    ['thư mục con', [{ name: 'sub/data.csv', data: Buffer.from('x') }]],
    ['symlink', [{ name: 'data.csv', data: Buffer.from('/etc/passwd'), isSymlink: true }]],
    ['mục trùng tên', [{ name: 'data.csv', data: Buffer.from('a') }, { name: 'data.csv', data: Buffer.from('b') }]],
    ['quá nhiều mục', [{ name: 'manifest.json', data: Buffer.from('a') }, { name: 'data.csv', data: Buffer.from('a') }, { name: 'coverage.geojson', data: Buffer.from('a') }, { name: 'manifest.json', data: Buffer.from('a') }]],
  ] as Array<[string, ZipFixtureEntry[]]>)('từ chối gói có %s', async (_label, entries) => {
    const path = await writeZip(entries);
    await expect(readArchiveEntries(path, ALLOWED, LIMITS)).rejects.toBeInstanceOf(PackageArchiveError);
  });

  it('từ chối tỷ lệ nén vượt giới hạn (zip bomb khai thật)', async () => {
    const path = await writeZip([{ name: 'data.csv', data: Buffer.alloc(500_000, 0x61) }]);
    await expect(readArchiveEntries(path, ALLOWED, LIMITS)).rejects.toThrow(/tỷ lệ nén/);
  });

  it('dừng giải nén khi dữ liệu nhiều hơn kích thước khai (zip bomb khai gian)', async () => {
    const data = Buffer.from('x,y\n'.repeat(1000));
    const path = await writeZip([{ name: 'data.csv', data, method: 'store', declaredSize: 100 }]);
    const [entry] = await readArchiveEntries(path, ALLOWED, { ...LIMITS, compressionRatioMax: 1000 }).catch(() => [undefined]);
    // Mục store khai sai kích thước bị chặn ngay ở mục lục.
    expect(entry).toBeUndefined();

    const deflated = await writeZip([{ name: 'data.csv', data, declaredSize: 2000 }]);
    const entries = await readArchiveEntries(deflated, ALLOWED, { ...LIMITS, compressionRatioMax: 1000 });
    await expect(extractArchiveEntry(deflated, entries[0], join(dir, 'out.csv'))).rejects.toThrow(/nhiều hơn kích thước/);
  });

  it('phát hiện sai CRC', async () => {
    const path = await writeZip([{ name: 'data.csv', data: Buffer.from('a,b\n1,2\n'), declaredCrc: 12345 }]);
    const entries = await readArchiveEntries(path, ALLOWED, LIMITS);
    await expect(extractArchiveEntry(path, entries[0], join(dir, 'out.csv'))).rejects.toThrow(/CRC/);
  });

  it('từ chối tệp không phải zip', async () => {
    const path = join(dir, 'fake.zip');
    await writeFile(path, Buffer.from('%PDF-1.7 không phải zip, chỉ đổi đuôi tệp'));
    await expect(readArchiveEntries(path, ALLOWED, LIMITS)).rejects.toThrow(/không phải zip/);
  });
});
