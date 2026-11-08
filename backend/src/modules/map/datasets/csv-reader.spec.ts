import { Readable } from 'node:stream';
import { CsvFormatError, readCsvRecords } from './csv-reader.js';

async function readAll(text: string | string[], max = 1000): Promise<string[][]> {
  const chunks = Array.isArray(text) ? text : [text];
  const rows: string[][] = [];
  for await (const row of readCsvRecords(Readable.from(chunks.map((chunk) => Buffer.from(chunk))), max)) rows.push(row);
  return rows;
}

describe('readCsvRecords (RFC 4180)', () => {
  it('đọc ô có ngoặc, dấu phẩy, xuống dòng và ngoặc kép lặp', async () => {
    const rows = await readAll('a,b,c\n"1,5","dòng 1\ndòng 2","nói ""chào"""\n');
    expect(rows).toEqual([
      ['a', 'b', 'c'],
      ['1,5', 'dòng 1\ndòng 2', 'nói "chào"'],
    ]);
  });

  it('bỏ BOM, hiểu CRLF và dòng cuối không có xuống dòng', async () => {
    expect(await readAll('﻿a,b\r\n1,2\r\n3,4')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4'],
    ]);
  });

  it('ghép đúng khi ký tự đặc biệt nằm ở ranh giữa hai chunk', async () => {
    expect(await readAll(['a,"x', '""y"\r', '\nb,c'])).toEqual([
      ['a', 'x"y'],
      ['b', 'c'],
    ]);
  });

  it('bỏ dòng trống', async () => {
    expect(await readAll('a\n\n\nb\n')).toEqual([['a'], ['b']]);
  });

  it('báo lỗi khi bản ghi dài quá giới hạn (chống tệp độc hại giữ bộ nhớ)', async () => {
    await expect(readAll(`"${'x'.repeat(50)}`, 20)).rejects.toBeInstanceOf(CsvFormatError);
  });

  it('báo lỗi khi thiếu ngoặc đóng hoặc ngoặc giữa ô', async () => {
    await expect(readAll('a,"b\n')).rejects.toThrow(/thiếu ngoặc kép đóng/);
    await expect(readAll('a,b"c\n')).rejects.toThrow(/ngoặc kép giữa ô/);
  });
});
