import { deflateSync } from 'node:zlib';

/** Dữ liệu tệp mẫu cho môi trường dev: sinh bằng mã, không cần tệp nhị phân trong repo. */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes)
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export type Rgb = readonly [number, number, number];

export const SEED_IMAGE_SIZE = { width: 320, height: 240 } as const;

/** Ảnh PNG chuyển màu chéo giữa hai màu, kèm vài đường kẻ để nhìn ra là "ảnh". */
export function seedPng(from: Rgb, to: Rgb): Buffer {
  const { width, height } = SEED_IMAGE_SIZE;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y += 1) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x += 1) {
      const t = (x / width + y / height) / 2;
      const line = (x + y) % 48 < 3 ? 0.12 : 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const value =
          (from[channel] as number) +
          ((to[channel] as number) - (from[channel] as number)) * t;
        row[1 + x * 3 + channel] = Math.max(
          0,
          Math.min(255, Math.round(value * (1 - line))),
        );
      }
    }
    rows.push(row);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // độ sâu bit
  header[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

export const SEED_PALETTE: ReadonlyArray<readonly [Rgb, Rgb]> = [
  [
    [70, 130, 110],
    [230, 210, 150],
  ],
  [
    [60, 90, 140],
    [200, 220, 240],
  ],
  [
    [150, 90, 70],
    [245, 215, 180],
  ],
  [
    [90, 110, 70],
    [210, 230, 180],
  ],
  [
    [120, 80, 130],
    [235, 205, 225],
  ],
  [
    [50, 60, 70],
    [170, 190, 200],
  ],
];

/** PDF một trang hợp lệ, mở được bằng trình đọc PDF. */
export function seedPdf(title: string): Buffer {
  const safe = title.replace(/[()\\]/g, ' ');
  const content = `BT /F1 20 Tf 72 760 Td (${safe}) Tj 0 -32 Td /F1 12 Tf (Tep mau cho moi truong dev.) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let out = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((body, index) => {
    offsets.push(out.length);
    out += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets)
    out += `${String(offset).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}

export const SEED_TEXT_FILES = {
  note: Buffer.from(
    'Ghi chú xem nhà\n- Ngõ rộng khoảng 3 m, ô tô nhỏ vào được\n- Tầng 3 có ban công, ánh sáng tốt\n- Hỏi lại chủ nhà về phí quản lý\n',
    'utf8',
  ),
  prices: Buffer.from(
    'Khu vực,Diện tích (m2),Giá chào (tỷ),Ghi chú\nHàng Bông,45,6.2,Ngõ ô tô\nHàng Bông,52,7.1,Mặt ngõ\nHồ Tây,60,8.4,Gần kè hồ\n',
    'utf8',
  ),
} as const;
