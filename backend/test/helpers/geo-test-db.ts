import { DataSource } from 'typeorm';

/**
 * Mỗi file test tích hợp PostGIS dùng một database riêng trên cùng máy chủ GEO_TEST_DATABASE_URL, vì test xóa và
 * dựng lại schema `geo`; vitest chạy các file song song nên dùng chung một database sẽ giẫm lên nhau.
 * Tên database cố định theo file, tạo nếu chưa có. Chỉ dùng cho máy chủ test TẠM.
 */
export async function isolatedDatabaseUrl(baseUrl: string, name: string): Promise<string> {
  if (!/^[a-z][a-z0-9_]{2,40}$/.test(name)) throw new Error(`Tên database test không hợp lệ: ${name}`);
  const admin = new DataSource({ type: 'postgres', url: baseUrl });
  await admin.initialize();
  try {
    const exists = (await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [name])) as unknown[];
    if (exists.length === 0) await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.destroy();
  }
  const url = new URL(baseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}
