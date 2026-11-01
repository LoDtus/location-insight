const TAG = /<[^>]*>/g;

export function plainText(value: string): string {
  return value.replace(TAG, '').replace(/[<>]/g, '').trim();
}

export function sniffMedia(bytes: Buffer, declared: string): boolean {
  if (declared === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (declared === 'image/png') {
    return bytes.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  }
  if (declared === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
      bytes.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  if (declared === 'video/mp4') {
    return bytes.length >= 12 && bytes.subarray(4, 8).toString('ascii') === 'ftyp';
  }
  return false;
}
