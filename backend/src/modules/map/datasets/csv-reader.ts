import type { Readable } from 'node:stream';

/**
 * Đọc CSV theo RFC 4180 (dấu phẩy, ngoặc kép, xuống dòng trong ô) từ stream UTF-8, trả từng dòng.
 * Giới hạn độ dài một bản ghi để tệp độc hại không giữ hết bộ nhớ (threat model T14).
 */
export class CsvFormatError extends Error {
  constructor(
    message: string,
    readonly line: number,
  ) {
    super(`Dòng ${line}: ${message}`);
    this.name = 'CsvFormatError';
  }
}

export async function* readCsvRecords(input: Readable, maxRecordChars: number): AsyncGenerator<string[]> {
  let field = '';
  let record: string[] = [];
  let recordChars = 0;
  let inQuotes = false;
  let quoteClosed = false;
  let pendingCr = false;
  let line = 1;
  let isFirstChunk = true;

  const endRecord = (): string[] => {
    record.push(field);
    const done = record;
    field = '';
    record = [];
    recordChars = 0;
    quoteClosed = false;
    return done;
  };

  input.setEncoding('utf8');
  for await (const chunk of input) {
    let text = String(chunk);
    if (isFirstChunk) {
      if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
      isFirstChunk = false;
    }
    for (const char of text) {
      recordChars += 1;
      if (recordChars > maxRecordChars) throw new CsvFormatError(`bản ghi dài quá ${maxRecordChars} ký tự.`, line);

      if (pendingCr) {
        pendingCr = false;
        if (char === '\n') continue;
      }

      if (inQuotes) {
        if (char === '"') {
          inQuotes = false;
          quoteClosed = true;
        } else {
          if (char === '\n') line += 1;
          field += char;
        }
        continue;
      }

      if (char === '"') {
        if (quoteClosed) {
          // Hai ngoặc liền nhau trong ô có ngoặc = một ký tự ngoặc.
          field += '"';
          inQuotes = true;
          quoteClosed = false;
          continue;
        }
        if (field.length > 0) throw new CsvFormatError('ngoặc kép giữa ô không có ngoặc mở.', line);
        inQuotes = true;
        continue;
      }
      if (char === ',') {
        record.push(field);
        field = '';
        quoteClosed = false;
        continue;
      }
      if (char === '\r' || char === '\n') {
        pendingCr = char === '\r';
        const done = endRecord();
        line += 1;
        if (!(done.length === 1 && done[0] === '')) yield done;
        continue;
      }
      if (quoteClosed) throw new CsvFormatError('ký tự sau ngoặc đóng.', line);
      field += char;
    }
  }
  if (inQuotes) throw new CsvFormatError('thiếu ngoặc kép đóng.', line);
  if (field.length > 0 || record.length > 0) yield endRecord();
}
