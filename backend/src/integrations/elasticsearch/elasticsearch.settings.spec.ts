import { describe, expect, it } from 'vitest';
import { resolveElasticsearchSettings } from './elasticsearch.settings.js';

const read = (env: Record<string, string>) => (name: string) => env[name];

describe('resolveElasticsearchSettings', () => {
  it('mặc định: bật, không profile nào, timeout 2 giây', () => {
    const settings = resolveElasticsearchSettings(read({}));
    expect(settings.enabled).toBe(true);
    expect(settings.profiles.size).toBe(0);
    expect(settings.indexPrefix).toBe('');
    expect(settings.searchTimeoutMs).toBe(2000);
    expect(settings.syncIntervalMs).toBe(2000);
    expect(settings.syncBatch).toBe(200);
  });

  it('ELASTICSEARCH_ENABLED=false tắt hẳn', () => {
    expect(
      resolveElasticsearchSettings(read({ ELASTICSEARCH_ENABLED: 'false' }))
        .enabled,
    ).toBe(false);
  });

  it('đọc danh sách profile, bỏ khoảng trắng và mục rỗng', () => {
    const settings = resolveElasticsearchSettings(
      read({ ELASTICSEARCH_PROFILES: ' discussion-topics, ,Places ' }),
    );
    expect([...settings.profiles].sort()).toEqual([
      'discussion-topics',
      'places',
    ]);
  });

  it('tiền tố sai dạng bị bỏ để tên index luôn hợp lệ', () => {
    expect(
      resolveElasticsearchSettings(
        read({ ELASTICSEARCH_INDEX_PREFIX: 'li-dev-' }),
      ).indexPrefix,
    ).toBe('li-dev-');
    expect(
      resolveElasticsearchSettings(
        read({ ELASTICSEARCH_INDEX_PREFIX: 'Li_Dev*' }),
      ).indexPrefix,
    ).toBe('');
  });

  it('giá trị số không hợp lệ rơi về mặc định; lô tối đa 1000', () => {
    const settings = resolveElasticsearchSettings(
      read({
        ELASTICSEARCH_SEARCH_TIMEOUT_MS: 'x',
        ELASTICSEARCH_SYNC_BATCH: '99999',
      }),
    );
    expect(settings.searchTimeoutMs).toBe(2000);
    expect(settings.syncBatch).toBe(1000);
  });
});
