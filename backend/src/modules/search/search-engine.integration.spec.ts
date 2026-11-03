import { ElasticsearchService } from '@nestjs/elasticsearch';
import type { ConfigService } from '@nestjs/config';
import type { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ElasticsearchIntegrationService } from '../../integrations/elasticsearch/elasticsearch.service.js';
import { SearchIndexService } from './search-index.service.js';
import { SearchRegistry } from './search-registry.service.js';
import { SearchWorkerService } from './search-worker.service.js';
import { SearchService } from './search.service.js';
import type {
  SearchProfile,
  SearchRequest,
  SearchViewer,
} from './search.types.js';

/**
 * Integration test trên Elasticsearch THẬT (cụm dev), dùng index tạm có tiền tố `test-` và xóa sau khi chạy.
 * Tự bỏ qua nếu không kết nối được ES (ví dụ CI không có ES). Bộ ca vàng lấy từ
 * workspace/features/017-search-elasticsearch (FR-03, FR-04, FR-05, FR-07, FR-09, FR-10).
 */
const NODE = process.env.ELASTICSEARCH_NODE_TEST ?? 'http://localhost:22373';
const PREFIX = 'test-';
const NAME = 'search-probes';

interface Place {
  id: string;
  title: string;
  cityId: string;
  hidden: boolean;
  updatedAt: Date;
}

const TITLES = [
  'Hồ Hoàn Kiếm',
  'Phố cổ Hoàn Kiếm Hà Nội',
  'Quận Hoàn Kiếm',
  'Nguyễn Văn Cừ',
  'Nhà thuốc Long Châu Nguyễn Văn Cừ',
  'Bệnh viện Bạch Mai',
  'Chợ Đồng Xuân',
  'Siêu thị Vinmart Cầu Giấy',
  'Công viên Thống Nhất',
  'Trường tiểu học Thăng Long',
  'Phở bò Hà Nội',
  'Hà Đông',
];

type Filters = { cityId?: string };

class FakeStore {
  rows = new Map<string, Place>();
  seed(): void {
    this.rows.clear();
    TITLES.forEach((title, index) => {
      const id = `p${String(index + 1).padStart(2, '0')}`;
      this.rows.set(id, {
        id,
        title,
        cityId: 'hn',
        hidden: false,
        updatedAt: new Date(),
      });
    });
  }
}

function makeProfile(store: FakeStore): SearchProfile<Place, Filters> {
  return {
    name: NAME,
    version: 1,
    fields: [{ name: 'title', boost: 1, short: true }],
    filters: [{ name: 'cityId', type: 'keyword' }],
    tieBreaker: [{ field: 'updatedAt', order: 'desc' }],
    idOf: (row) => row.id,
    toDocument: (row) =>
      row.hidden
        ? null
        : {
            title: row.title,
            cityId: row.cityId,
            updatedAt: row.updatedAt.toISOString(),
          },
    loadBatch: (afterId, limit, since) =>
      Promise.resolve(
        [...store.rows.values()]
          .filter(
            (row) =>
              (afterId === null || row.id > afterId) &&
              (!since || row.updatedAt >= since),
          )
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, limit),
      ),
    loadByIds: (ids) =>
      Promise.resolve(
        ids.flatMap((id) =>
          store.rows.has(id) ? [store.rows.get(id) as Place] : [],
        ),
      ),
    canView: (row, viewer) => !row.hidden || viewer.isAdmin,
    toFilters: (filters) =>
      filters.cityId ? [{ term: { cityId: filters.cityId } }] : [],
    fallback: (request) =>
      Promise.resolve(
        [...store.rows.values()].filter((row) =>
          row.title.toLowerCase().includes(request.q.toLowerCase()),
        ),
      ),
  };
}

function configOf(extra: Record<string, string> = {}): ConfigService {
  const env: Record<string, string> = {
    ELASTICSEARCH_PROFILES: NAME,
    ELASTICSEARCH_INDEX_PREFIX: PREFIX,
    ELASTICSEARCH_SEARCH_TIMEOUT_MS: '3000',
    ...extra,
  };
  return { get: (name: string) => env[name] } as unknown as ConfigService;
}

/** DataSource giả: khóa tư vấn luôn lấy được; ghi lại mọi câu lệnh; trả lô outbox đã định sẵn. */
class FakeDataSource {
  statements: Array<{ sql: string; params: unknown[] }> = [];
  claimed: Array<{
    id: string;
    profile: string;
    doc_id: string;
    revision: string;
  }> = [];
  query = (sql: string, params: unknown[] = []): Promise<unknown> => {
    this.statements.push({ sql, params });
    if (sql.includes('pg_try_advisory_lock'))
      return Promise.resolve([{ locked: true }]);
    if (sql.includes("SET status = 'processing'"))
      return Promise.resolve([this.claimed, this.claimed.length]);
    return Promise.resolve([]);
  };
  manager = { query: this.query };
  createQueryRunner = () => ({
    connect: () => Promise.resolve(),
    query: this.query,
    release: () => Promise.resolve(),
  });
  deletedEnqueues(): string[] {
    return this.statements
      .filter(
        (s) =>
          s.sql.includes('INSERT INTO search_outbox') &&
          s.params[2] === 'delete',
      )
      .map((s) => String(s.params[1]));
  }
}

async function elasticsearchAvailable(): Promise<boolean> {
  try {
    await new ElasticsearchService({ node: NODE }).ping(undefined, {
      requestTimeout: 1500,
      maxRetries: 0,
    });
    return true;
  } catch {
    return false;
  }
}

const available = await elasticsearchAvailable();
const viewer: SearchViewer = { userId: 'u1', isAdmin: false };
const page = { size: 10, from: 0 };

describe.skipIf(!available)(
  'Elasticsearch thật: tìm kiếm gần đúng tiếng Việt',
  () => {
    const store = new FakeStore();
    const profile = makeProfile(store);
    const data = new FakeDataSource();
    let es: ElasticsearchIntegrationService;
    let index: SearchIndexService;
    let service: SearchService;
    let client: ElasticsearchService;

    const request = (
      q: string,
      filters: Filters = {},
      who: SearchViewer = viewer,
    ): SearchRequest<Filters> => ({
      q,
      filters,
      viewer: who,
      page,
    });
    const titles = async (
      q: string,
      filters: Filters = {},
      who: SearchViewer = viewer,
    ): Promise<string[]> => {
      const result = await service.search(profile, request(q, filters, who));
      return (result?.items ?? []).map((item) => item.row.title);
    };
    const topScore = async (q: string): Promise<number> => {
      const result = await service.search(profile, request(q));
      return result?.items[0]?.score ?? 0;
    };

    async function cleanup(): Promise<void> {
      // ES từ chối xóa bằng ký tự đại diện (action.destructive_requires_name): xóa đúng hai tên luân phiên.
      await client.indices.delete({
        index: [`${PREFIX}${NAME}-v1`, `${PREFIX}${NAME}-v1-b`],
        ignore_unavailable: true,
      });
    }

    beforeAll(async () => {
      client = new ElasticsearchService({ node: NODE });
      await cleanup();
      store.seed();
      es = new ElasticsearchIntegrationService(client, configOf());
      es.onModuleInit();
      for (let i = 0; i < 50 && !es.isReady(); i += 1)
        await new Promise((r) => setTimeout(r, 200));
      expect(es.isReady()).toBe(true);

      const registry = new SearchRegistry();
      index = new SearchIndexService(
        es,
        registry,
        data as unknown as DataSource,
      );
      service = new SearchService(es, data as unknown as DataSource);
      await index.applySynonyms();
      expect(
        await index.reindex(
          profile as unknown as Parameters<SearchIndexService['reindex']>[0],
        ),
      ).toBe('done');
      await es.refresh(`${PREFIX}${NAME}`);
    }, 30_000);

    afterAll(async () => {
      await cleanup();
      await es.onModuleDestroy();
    });

    // FR-03: mỗi kiểu lỗi gõ phải ra đúng đối tượng ở hạng 1.
    it.each([
      ['Hoàn Kiếm', 'có dấu, đúng'],
      ['hoan kiem', 'không dấu'],
      ['kiem hoan', 'đảo thứ tự từ'],
      ['hoankiem', 'dính chữ'],
      ['hoan kiêm', 'sai dấu'],
      ['hoan keim', 'đảo hai chữ cái liền nhau'],
      ['hoan kiam', 'sai 1 chữ cái'],
      ['hoan kiemm', 'thừa 1 chữ cái'],
      ['hon kiem', 'thiếu 1 chữ cái'],
    ])('%s (%s) → một địa danh Hoàn Kiếm đứng đầu', async (q) => {
      const [first] = await titles(q);
      expect(first).toContain('Hoàn Kiếm');
    });

    it.each([
      ['ho hoan kiem ha noi', 'Hồ Hoàn Kiếm', 'thừa từ'],
      ['nguyen cu', 'Nguyễn Văn Cừ', 'thiếu từ'],
      ['bach ma', 'Bệnh viện Bạch Mai', 'đang gõ dở'],
      ['dong xuan cho', 'Chợ Đồng Xuân', 'đảo thứ tự'],
      ['ha dong', 'Hà Đông', 'đ → d'],
      ['thang lonh', 'Trường tiểu học Thăng Long', 'sai chữ + thiếu từ'],
      ['pho bo', 'Phở bò Hà Nội', 'không dấu hai từ'],
    ])('%s → %s (%s)', async (q, expected) => {
      expect((await titles(q))[0]).toBe(expected);
    });

    // FR-04: điểm giảm dần theo mức khớp.
    it('điểm theo tầng: đúng có dấu > không dấu > đảo từ > sai chính tả', async () => {
      const [exact, folded, reordered, typo] = await Promise.all([
        topScore('Hoàn Kiếm'),
        topScore('hoan kiem'),
        topScore('kiem hoan'),
        topScore('hoan keim'),
      ]);
      expect(exact).toBeGreaterThan(folded);
      expect(folded).toBeGreaterThan(reordered);
      expect(reordered).toBeGreaterThan(typo);
    });

    // FR-05: nhiễu bị cắt.
    it('cắt nhiễu: "ha dong" không kéo theo kết quả không liên quan', async () => {
      expect(await titles('ha dong')).toEqual(['Hà Đông']);
    });

    it('không có kết quả cho chữ vô nghĩa', async () => {
      expect(await titles('zzzzqq')).toEqual([]);
    });

    it('q chứa ký tự cú pháp không gây lỗi và không đổi nghĩa truy vấn', async () => {
      for (const q of [
        '"hoan kiem"',
        'title:* OR (a',
        '\\ hoan * kiem ?',
        '{"match_all":{}}',
      ]) {
        const result = await service.search(profile, request(q));
        expect(result?.source).toBe('elasticsearch');
      }
      expect(await titles('*:*')).toEqual([]);
    });

    it('từ đồng nghĩa: bv ≈ bệnh viện', async () => {
      expect((await titles('bv bach mai'))[0]).toBe('Bệnh viện Bạch Mai');
    });

    it('bộ lọc đi vào mệnh đề filter', async () => {
      expect(await titles('hoan kiem', { cityId: 'khong-ton-tai' })).toEqual(
        [],
      );
      expect(
        (await titles('hoan kiem', { cityId: 'hn' })).length,
      ).toBeGreaterThan(0);
    });

    it('không dùng ES khi q rỗng hoặc ngắn: trả null để người gọi chạy PostgreSQL', async () => {
      expect(await service.search(profile, request(''))).toBeNull();
      expect(await service.search(profile, request(' a '))).toBeNull();
    });

    it('profile chưa bật thì không dùng ES', async () => {
      const off = new SearchService(
        new ElasticsearchIntegrationService(
          client,
          configOf({ ELASTICSEARCH_PROFILES: 'khac' }),
        ),
        data as unknown as DataSource,
      );
      expect(await off.search(profile, request('hoan kiem'))).toBeNull();
    });

    // FR-07: hydrate loại bản ghi đã mất và dọn ES; không dọn nhầm bản ghi chỉ là không được xem.
    it('hydrate: bản ghi đã xóa ở PostgreSQL không xuất hiện và được xếp lệnh xóa', async () => {
      const gone = store.rows.get('p07') as Place;
      store.rows.delete('p07');
      data.statements = [];
      expect(await titles('dong xuan')).toEqual([]);
      expect(data.deletedEnqueues()).toContain('p07');
      store.rows.set('p07', gone);
    });

    it('hydrate: bản ghi không được xem bị ẩn nhưng KHÔNG bị dọn khỏi ES', async () => {
      const secret = store.rows.get('p06') as Place;
      secret.hidden = true;
      data.statements = [];
      expect(await titles('bach mai')).toEqual([]);
      expect(
        await titles('bach mai', {}, { userId: 'a', isAdmin: true }),
      ).toEqual(['Bệnh viện Bạch Mai']);
      expect(data.deletedEnqueues()).toEqual([]);
      secret.hidden = false;
    });

    // FR-10: ES không dùng được thì rơi về PostgreSQL.
    it('ES chưa sẵn sàng: trả kết quả dự phòng, degraded = true', async () => {
      const offline = new ElasticsearchIntegrationService(client, configOf());
      expect(offline.isReady()).toBe(false);
      const fallback = new SearchService(
        offline,
        data as unknown as DataSource,
      );
      const result = await fallback.search(profile, request('Hoàn Kiếm'));
      expect(result?.source).toBe('database');
      expect(result?.degraded).toBe(true);
      expect(result?.items.map((item) => item.row.title)).toContain(
        'Hồ Hoàn Kiếm',
      );
    });

    it('ES lỗi (index không tồn tại): rơi về PostgreSQL, không ném lỗi, rồi ngắt mạch', async () => {
      const ownClient = new ElasticsearchService({ node: NODE });
      const ownEs = new ElasticsearchIntegrationService(
        ownClient,
        configOf({ ELASTICSEARCH_PROFILES: 'khong-co-index' }),
      );
      ownEs.onModuleInit();
      for (let i = 0; i < 50 && !ownEs.isReady(); i += 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
      expect(ownEs.isReady()).toBe(true);

      const svc = new SearchService(ownEs, data as unknown as DataSource);
      const brokenProfile = { ...makeProfile(store), name: 'khong-co-index' };
      for (let i = 0; i < 5; i += 1) {
        const result = await svc.search(brokenProfile, request('Hoàn Kiếm'));
        expect(result?.degraded).toBe(true);
        expect(result?.source).toBe('database');
      }
      await ownEs.onModuleDestroy();
    });

    // FR-08: worker đọc trạng thái hiện tại và ghi/xóa theo lô.
    it('worker: cập nhật và xóa tài liệu theo trạng thái hiện tại trong PostgreSQL', async () => {
      const worker = new SearchWorkerService(
        es,
        new SearchRegistry(),
        data as unknown as DataSource,
      );
      const registry = (worker as unknown as { registry: SearchRegistry })
        .registry;
      registry.register(profile);

      store.rows.set('p12', {
        ...(store.rows.get('p12') as Place),
        title: 'Hà Đông Mới',
      });
      store.rows.get('p11')!.hidden = true; // toDocument → null → xóa khỏi ES
      data.statements = [];
      data.claimed = [
        { id: '1', profile: NAME, doc_id: 'p12', revision: '1' },
        { id: '2', profile: NAME, doc_id: 'p11', revision: '1' },
      ];
      expect(await worker.runOnce()).toBe(2);
      await es.refresh(`${PREFIX}${NAME}`);

      const completed = data.statements.find((s) =>
        s.sql.includes('DELETE FROM search_outbox'),
      );
      expect(completed?.params[0]).toEqual(['1', '2']);
      expect(await titles('ha dong moi')).toContain('Hà Đông Mới');
      expect(
        await titles('pho bo', {}, { userId: 'a', isAdmin: true }),
      ).not.toContain('Phở bò Hà Nội');
      store.rows.get('p11')!.hidden = false;
    });

    it('worker: profile chưa đăng ký chuyển dòng sang dead', async () => {
      const worker = new SearchWorkerService(
        es,
        new SearchRegistry(),
        data as unknown as DataSource,
      );
      data.statements = [];
      data.claimed = [{ id: '9', profile: NAME, doc_id: 'p01', revision: '3' }];
      await worker.runOnce();
      const failed = data.statements.find((s) => s.sql.includes("THEN 'dead'"));
      expect(failed?.params[2]).toBe(true);
      expect(failed?.params[4]).toBe('profile-unavailable');
    });

    // FR-09: dựng lại luân phiên, alias đổi nguyên tử, index trước được giữ lại.
    it('dựng lại: luân phiên -v1 / -v1-b, alias không gián đoạn, index trước còn để quay lui', async () => {
      const alias = `${PREFIX}${NAME}`;
      const first = (await es.resolveAlias(alias))[0];
      expect(first).toBe(`${alias}-v1`);

      expect(
        await index.reindex(
          profile as unknown as Parameters<SearchIndexService['reindex']>[0],
        ),
      ).toBe('done');
      const second = (await es.resolveAlias(alias))[0];
      expect(second).toBe(`${alias}-v1-b`);
      expect(await es.indexExists(`${alias}-v1`)).toBe(true);
      expect(await titles('hoan kiem')).not.toEqual([]);

      expect(
        await index.reindex(
          profile as unknown as Parameters<SearchIndexService['reindex']>[0],
        ),
      ).toBe('done');
      expect((await es.resolveAlias(alias))[0]).toBe(`${alias}-v1`);
    });

    it('dựng lại: số tài liệu khớp số bản ghi đủ điều kiện (bản ghi ẩn bị loại)', async () => {
      store.rows.get('p03')!.hidden = true;
      await index.reindex(
        profile as unknown as Parameters<SearchIndexService['reindex']>[0],
      );
      const alias = `${PREFIX}${NAME}`;
      await es.refresh(alias);
      expect(await es.countDocuments(alias)).toBe(TITLES.length - 1);
      store.rows.get('p03')!.hidden = false;
    });

    it('mapping strict: tài liệu thừa trường bị từ chối', async () => {
      const failed = await es.bulk(`${PREFIX}${NAME}`, [
        { id: 'x', document: { title: 'x', khongCoTrongMapping: 1 } },
      ]);
      expect(failed).toEqual(['x']);
    });
  },
);
