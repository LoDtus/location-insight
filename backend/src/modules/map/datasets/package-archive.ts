import { createReadStream, createWriteStream } from 'node:fs';
import { open } from 'node:fs/promises';
import { Transform, type TransformCallback } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createInflateRaw, crc32 } from 'node:zlib';

/**
 * Bộ đọc zip tối thiểu cho gói dữ liệu chuẩn (threat model T14). Chỉ hỗ trợ đúng thứ gói cần: vài mục ở gốc,
 * nén `store` hoặc `deflate`, không mã hóa, không zip64. Đọc danh sách mục từ central directory, không tin
 * header cục bộ; giải nén từng mục ra đường dẫn do server chọn, đếm byte và kiểm CRC trong lúc chảy.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_BYTES = 22;
const EOCD_SEARCH_BYTES = EOCD_MIN_BYTES + 0xffff;
const ZIP64_MARKER = 0xffffffff;
const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;
const FLAG_ENCRYPTED = 0x0001;

export interface ArchiveLimits {
  entriesMax: number;
  uncompressedMaxBytes: number;
  compressionRatioMax: number;
}

export interface ArchiveEntry {
  name: string;
  method: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
}

export class PackageArchiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackageArchiveError';
  }
}

/** Đọc và kiểm danh sách mục. Lỗi hình dạng (tên lạ, mã hóa, zip64, vượt giới hạn) ném PackageArchiveError. */
export async function readArchiveEntries(
  filePath: string,
  allowedNames: ReadonlySet<string>,
  limits: ArchiveLimits,
): Promise<ArchiveEntry[]> {
  const handle = await open(filePath, 'r');
  try {
    const { size } = await handle.stat();
    if (size < EOCD_MIN_BYTES) throw new PackageArchiveError('Tệp quá nhỏ, không phải zip.');
    const head = Buffer.alloc(4);
    await handle.read(head, 0, 4, 0);
    if (head.readUInt32LE(0) !== LOCAL_SIGNATURE) throw new PackageArchiveError('Tệp không phải zip (sai chữ ký đầu tệp).');

    const tailLength = Math.min(size, EOCD_SEARCH_BYTES);
    const tail = Buffer.alloc(tailLength);
    await handle.read(tail, 0, tailLength, size - tailLength);
    const eocd = findEocd(tail);
    if (eocd < 0) throw new PackageArchiveError('Không tìm thấy mục lục zip.');

    const diskEntries = tail.readUInt16LE(eocd + 8);
    const totalEntries = tail.readUInt16LE(eocd + 10);
    const centralSize = tail.readUInt32LE(eocd + 12);
    const centralOffset = tail.readUInt32LE(eocd + 16);
    if (diskEntries !== totalEntries || centralOffset === ZIP64_MARKER) throw new PackageArchiveError('Không hỗ trợ zip nhiều phần hoặc zip64.');
    if (totalEntries === 0 || totalEntries > limits.entriesMax) {
      throw new PackageArchiveError(`Gói phải có từ 1 tới ${limits.entriesMax} mục.`);
    }
    if (centralOffset + centralSize > size) throw new PackageArchiveError('Mục lục zip vượt quá kích thước tệp.');

    const central = Buffer.alloc(centralSize);
    await handle.read(central, 0, centralSize, centralOffset);
    const entries = parseCentralDirectory(central, totalEntries, size);
    assertEntries(entries, allowedNames, limits);
    return entries;
  } finally {
    await handle.close();
  }
}

function findEocd(tail: Buffer): number {
  for (let index = tail.length - EOCD_MIN_BYTES; index >= 0; index -= 1) {
    if (tail.readUInt32LE(index) === EOCD_SIGNATURE) return index;
  }
  return -1;
}

function parseCentralDirectory(central: Buffer, count: number, fileSize: number): ArchiveEntry[] {
  const entries: ArchiveEntry[] = [];
  let offset = 0;
  for (let index = 0; index < count; index += 1) {
    if (offset + 46 > central.length || central.readUInt32LE(offset) !== CENTRAL_SIGNATURE) {
      throw new PackageArchiveError('Mục lục zip hỏng.');
    }
    const flags = central.readUInt16LE(offset + 8);
    const method = central.readUInt16LE(offset + 10);
    const crc = central.readUInt32LE(offset + 16);
    const compressedSize = central.readUInt32LE(offset + 20);
    const uncompressedSize = central.readUInt32LE(offset + 24);
    const nameLength = central.readUInt16LE(offset + 28);
    const extraLength = central.readUInt16LE(offset + 30);
    const commentLength = central.readUInt16LE(offset + 32);
    const externalAttributes = central.readUInt32LE(offset + 38);
    const localHeaderOffset = central.readUInt32LE(offset + 42);
    const name = central.toString('utf8', offset + 46, offset + 46 + nameLength);

    if (flags & FLAG_ENCRYPTED) throw new PackageArchiveError(`Mục "${safeName(name)}" bị mã hóa.`);
    if (method !== METHOD_STORE && method !== METHOD_DEFLATE) throw new PackageArchiveError(`Mục "${safeName(name)}" dùng kiểu nén không hỗ trợ.`);
    if ([compressedSize, uncompressedSize, localHeaderOffset].includes(ZIP64_MARKER)) throw new PackageArchiveError('Không hỗ trợ zip64.');
    if (isSymlink(externalAttributes)) throw new PackageArchiveError(`Mục "${safeName(name)}" là symlink.`);
    if (localHeaderOffset + 30 + compressedSize > fileSize) throw new PackageArchiveError(`Mục "${safeName(name)}" vượt quá kích thước tệp.`);

    entries.push({ name, method, crc32: crc, compressedSize, uncompressedSize, localHeaderOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** Bit kiểu tệp Unix nằm ở 16 bit cao của external attributes; 0o120000 là symlink. */
function isSymlink(externalAttributes: number): boolean {
  return ((externalAttributes >>> 16) & 0o170000) === 0o120000;
}

function assertEntries(entries: ArchiveEntry[], allowedNames: ReadonlySet<string>, limits: ArchiveLimits): void {
  const seen = new Set<string>();
  let total = 0;
  for (const entry of entries) {
    if (!allowedNames.has(entry.name)) {
      throw new PackageArchiveError(`Mục "${safeName(entry.name)}" không được phép. Chỉ nhận: ${[...allowedNames].join(', ')}.`);
    }
    if (seen.has(entry.name)) throw new PackageArchiveError(`Mục "${entry.name}" bị trùng.`);
    seen.add(entry.name);
    if (entry.method === METHOD_STORE && entry.compressedSize !== entry.uncompressedSize) {
      throw new PackageArchiveError(`Mục "${entry.name}" khai kích thước sai.`);
    }
    const ratio = entry.uncompressedSize / Math.max(entry.compressedSize, 1);
    if (ratio > limits.compressionRatioMax) throw new PackageArchiveError(`Mục "${entry.name}" có tỷ lệ nén vượt 1:${limits.compressionRatioMax}.`);
    total += entry.uncompressedSize;
  }
  if (total > limits.uncompressedMaxBytes) throw new PackageArchiveError('Tổng dung lượng sau giải nén vượt giới hạn.');
}

/**
 * Giải nén một mục ra `targetPath`. Dừng ngay khi số byte vượt kích thước đã khai (zip bomb khai gian)
 * và kiểm CRC khi xong.
 */
export async function extractArchiveEntry(filePath: string, entry: ArchiveEntry, targetPath: string): Promise<void> {
  const dataOffset = await localDataOffset(filePath, entry);
  const guard = new SizeAndCrcGuard(entry);
  const source = createReadStream(filePath, {
    start: dataOffset,
    end: dataOffset + Math.max(entry.compressedSize, 1) - 1,
  });
  const target = createWriteStream(targetPath, { flags: 'wx', mode: 0o600 });
  if (entry.compressedSize === 0) {
    source.destroy();
    target.end();
    guard.finish();
    return;
  }
  if (entry.method === METHOD_DEFLATE) {
    await pipeline(source, createInflateRaw(), guard, target);
  } else {
    await pipeline(source, guard, target);
  }
}

async function localDataOffset(filePath: string, entry: ArchiveEntry): Promise<number> {
  const handle = await open(filePath, 'r');
  try {
    const header = Buffer.alloc(30);
    await handle.read(header, 0, 30, entry.localHeaderOffset);
    if (header.readUInt32LE(0) !== LOCAL_SIGNATURE) throw new PackageArchiveError(`Header của mục "${entry.name}" hỏng.`);
    const nameLength = header.readUInt16LE(26);
    const extraLength = header.readUInt16LE(28);
    return entry.localHeaderOffset + 30 + nameLength + extraLength;
  } finally {
    await handle.close();
  }
}

class SizeAndCrcGuard extends Transform {
  private bytes = 0;
  private crc = 0;

  constructor(private readonly entry: ArchiveEntry) {
    super();
  }

  override _transform(chunk: Buffer, _encoding: BufferEncoding, callback: TransformCallback): void {
    this.bytes += chunk.length;
    if (this.bytes > this.entry.uncompressedSize) {
      callback(new PackageArchiveError(`Mục "${this.entry.name}" giải nén ra nhiều hơn kích thước đã khai.`));
      return;
    }
    this.crc = crc32(chunk, this.crc);
    callback(null, chunk);
  }

  override _flush(callback: TransformCallback): void {
    try {
      this.finish();
      callback();
    } catch (error) {
      callback(error instanceof Error ? error : new PackageArchiveError('Lỗi kiểm mục zip.'));
    }
  }

  finish(): void {
    if (this.bytes !== this.entry.uncompressedSize) throw new PackageArchiveError(`Mục "${this.entry.name}" thiếu dữ liệu.`);
    if (this.crc >>> 0 !== this.entry.crc32 >>> 0) throw new PackageArchiveError(`Mục "${this.entry.name}" sai CRC.`);
  }
}

function safeName(name: string): string {
  return name.replace(/[^\x20-\x7e]/g, '?').slice(0, 80);
}
