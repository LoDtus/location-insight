import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SEED_STEPS } from './dev-reset.seed-order.js';

function seedFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return seedFiles(path);
    return /^seed-.*\.service\.ts$/.test(name) ? [name] : [];
  });
}

describe('SEED_STEPS', () => {
  it('bao phủ mọi tệp seed-*.service.ts trong modules', () => {
    const files = seedFiles(resolve(__dirname, '../modules'));
    const registered = SEED_STEPS.map((step) => step.provider.name);
    for (const file of files) {
      const className = file
        .replace(/\.service\.ts$/, '')
        .split('-')
        .map((part) => part[0]?.toUpperCase() + part.slice(1))
        .join('') + 'Service';
      expect(registered, `${file} chưa có trong SEED_STEPS`).toContain(className);
    }
  });

  it('tài khoản chạy đầu tiên, không trùng tên bước', () => {
    expect(SEED_STEPS[0]?.name).toBe('accounts');
    expect(new Set(SEED_STEPS.map((s) => s.name)).size).toBe(SEED_STEPS.length);
  });
});
