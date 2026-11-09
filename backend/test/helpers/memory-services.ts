import { readFile, writeFile } from 'node:fs/promises';

/** Kho S3 và Redis giả trong bộ nhớ cho test tích hợp đường nhập gói và đánh giá (cần PostGIS thật). */
export class MemoryStorage {
  readonly objects = new Map<string, Buffer>();
  async getPresignedPutUrl(key: string): Promise<string> {
    return `memory://${key}`;
  }
  async objectSize(key: string): Promise<number | null> {
    return this.objects.get(key)?.length ?? null;
  }
  async downloadObjectToFile(key: string, path: string): Promise<void> {
    const data = this.objects.get(key);
    if (!data) throw new Error('NoSuchKey');
    await writeFile(path, data, { flag: 'wx' });
  }
  async putObjectFromFile(key: string, path: string): Promise<void> {
    this.objects.set(key, await readFile(path));
  }
  async deleteObject(key: string): Promise<void> {
    this.objects.delete(key);
  }
}

export class MemoryRedis {
  private readonly values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.values.get(key) as T | undefined;
  }
  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, value);
  }
  async del(key: string): Promise<void> {
    this.values.delete(key);
  }
}
