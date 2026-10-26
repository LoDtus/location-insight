import { estypes } from '@elastic/elasticsearch';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ElasticsearchService } from '@nestjs/elasticsearch';
import { ElasticsearchConfig } from '../../shared/config/elasticsearch.config.js';

@Injectable()
export class ElasticsearchIntegrationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ElasticsearchIntegrationService.name);

  constructor(private readonly client: ElasticsearchService) {}

  async onModuleInit(): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= 10; attempt += 1) {
      try {
        const info = await this.client.info();
        this.logger.log(
          `Elasticsearch ${info.version.number} (${info.cluster_name})`,
        );
        return;
      } catch (error) {
        lastError = error;
        this.logger.warn(`Elasticsearch chưa sẵn sàng (${attempt}/10)`);
        await delay(3000);
      }
    }

    throw lastError;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.close();
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch {
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

  async search(
    index: string | string[],
    query: estypes.QueryDslQueryContainer,
  ) {
    return this.client.search({ index, query });
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
