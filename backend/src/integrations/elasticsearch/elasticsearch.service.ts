import { errors, estypes } from '@elastic/elasticsearch';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ElasticsearchConfig } from '../../shared/config/elasticsearch.config.js';
import {
  ElasticsearchSettings,
  resolveElasticsearchSettings,
} from './elasticsearch.settings.js';

export interface BulkOperation {
  id: string;
  /** null = xóa tài liệu. */
  document: Record<string, unknown> | null;
}

export interface SynonymRule {
  id: string;
  synonyms: string;
}

const FAST_RETRIES = 10;
const FAST_RETRY_MS = 3000;
const SLOW_RETRY_MS = 15000;

@Injectable()
export class ElasticsearchIntegrationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ElasticsearchIntegrationService.name);
  readonly settings: ElasticsearchSettings;
  private ready = false;
  private stopped = false;
  private readonly readyListeners: Array<() => void> = [];

  constructor(
    private readonly client: ElasticsearchService,
    config: ConfigService,
  ) {
    this.settings = resolveElasticsearchSettings((name) =>
      config.get<string>(name),
    );
  }

  /**
   * Không chặn khởi động: ES là phụ thuộc tùy chọn (FR-11). Kết nối thử lại ở nền;
   * khi sẵn sàng thì gọi các hàm đăng ký qua `onReady`.
   */
  onModuleInit(): void {
    if (!this.settings.enabled) {
      this.logger.log('Elasticsearch đã tắt (ELASTICSEARCH_ENABLED=false)');
      return;
    }
    void this.connectInBackground();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    await this.client.close();
  }

  isEnabled(): boolean {
    return this.settings.enabled;
  }

  isReady(): boolean {
    return this.settings.enabled && this.ready;
  }

  /** Gọi lại mỗi lần ES chuyển sang sẵn sàng; gọi ngay nếu đã sẵn sàng. */
  onReady(listener: () => void): void {
    this.readyListeners.push(listener);
    if (this.isReady()) listener();
  }

  async ping(): Promise<boolean> {
    if (!this.settings.enabled) return false;
    try {
      await this.client.ping(undefined, {
        requestTimeout: 2000,
        maxRetries: 0,
      });
      this.markReady(true);
      return true;
    } catch {
      this.ready = false;
      return false;
    }
  }

  async indexExists(index: string): Promise<boolean> {
    return this.client.indices.exists({ index });
  }

  async createIndex(
    index: string,
    mappings: estypes.MappingTypeMapping = {},
    settings: estypes.IndicesIndexSettings = {},
  ): Promise<boolean> {
    if (await this.indexExists(index)) {
      this.logger.warn(`Index "${index}" already exists`);
      return false;
    }

    await this.client.indices.create({
      index,
      settings: {
        ...ElasticsearchConfig.defaultSettings,
        ...settings,
      },
      mappings: {
        ...mappings,
        properties: {
          ...ElasticsearchConfig.commonMappings.properties,
          ...mappings.properties,
        },
      },
    });
    this.logger.log(`Created index: ${index}`);
    return true;
  }

  async deleteIndex(index: string): Promise<boolean> {
    if (!(await this.indexExists(index))) return false;
    await this.client.indices.delete({ index });
    return true;
  }

  async indexDocument(
    index: string,
    document: Record<string, unknown>,
    id?: string,
  ) {
    return this.client.index({
      index,
      id,
      document,
      refresh: false,
    });
  }

  /** Tìm kiếm có giới hạn thời gian cho từng lần gọi (FR-13); không thử lại để ngắt mạch kịp thời. */
  async searchWithTimeout(
    params: estypes.SearchRequest,
    timeoutMs: number,
  ): Promise<estypes.SearchResponse> {
    return this.client.search(
      { ...params, timeout: `${timeoutMs}ms` },
      { requestTimeout: timeoutMs + 500, maxRetries: 0 },
    );
  }

  /** Ghi/xóa theo lô. Trả về các `id` thất bại; thiếu index cũng là thất bại để worker thử lại. */
  async bulk(index: string, operations: BulkOperation[]): Promise<string[]> {
    if (operations.length === 0) return [];
    const body = operations.flatMap(
      (operation): Array<Record<string, unknown>> =>
        operation.document === null
          ? [{ delete: { _index: index, _id: operation.id } }]
          : [
              { index: { _index: index, _id: operation.id } },
              operation.document,
            ],
    );
    const response = await this.client.bulk({
      operations: body,
      refresh: false,
    });
    if (!response.errors) return [];

    const failed: string[] = [];
    for (const item of response.items) {
      const action = item.index ?? item.delete;
      // Xóa tài liệu không tồn tại trả `not_found` không kèm `error`: tính là thành công.
      if (!action?.error) continue;
      if (action._id) failed.push(action._id);
      this.logger.warn(
        `Bulk lỗi (${action.status}): ${action.error.type ?? 'không rõ'}`,
      );
    }
    return failed;
  }

  async refresh(index: string): Promise<void> {
    await this.client.indices.refresh({ index });
  }

  async countDocuments(index: string): Promise<number> {
    const response = await this.client.count({ index });
    return response.count;
  }

  /** Tên các index đang gắn với alias; rỗng nếu alias chưa có. */
  async resolveAlias(alias: string): Promise<string[]> {
    try {
      const response = await this.client.indices.getAlias({ name: alias });
      return Object.keys(response);
    } catch (error) {
      if (error instanceof errors.ResponseError && error.statusCode === 404) {
        return [];
      }
      throw error;
    }
  }

  /** Đổi alias nguyên tử: gỡ khỏi các index cũ và gắn vào index mới trong một yêu cầu. */
  async swapAlias(
    alias: string,
    addIndex: string,
    removeIndices: string[],
  ): Promise<void> {
    await this.client.indices.updateAliases({
      actions: [
        ...removeIndices.map((index) => ({ remove: { index, alias } })),
        { add: { index: addIndex, alias } },
      ],
    });
  }

  /** Tạo hoặc cập nhật bộ từ đồng nghĩa; ES tự nạp lại các analyzer `updateable`. */
  async putSynonymSet(id: string, rules: SynonymRule[]): Promise<void> {
    await this.client.synonyms.putSynonym({ id, synonyms_set: rules });
  }

  private markReady(value: boolean): void {
    const changed = value && !this.ready;
    this.ready = value;
    if (!changed) return;
    for (const listener of this.readyListeners) {
      try {
        listener();
      } catch (error) {
        this.logger.error(
          `Trình nghe onReady lỗi: ${error instanceof Error ? error.message : 'không rõ'}`,
        );
      }
    }
  }

  private async connectInBackground(): Promise<void> {
    for (let attempt = 1; !this.stopped; attempt += 1) {
      try {
        const info = await this.client.info();
        this.logger.log(
          `Elasticsearch ${info.version.number} (${info.cluster_name})`,
        );
        this.markReady(true);
        return;
      } catch {
        if (attempt <= FAST_RETRIES) {
          this.logger.warn(
            `Elasticsearch chưa sẵn sàng (${attempt}/${FAST_RETRIES}); tìm kiếm dùng PostgreSQL`,
          );
        }
        await delay(attempt <= FAST_RETRIES ? FAST_RETRY_MS : SLOW_RETRY_MS);
      }
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
