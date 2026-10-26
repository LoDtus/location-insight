import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/access.decorator.js';
import {
  HealthCheck,
  HealthCheckService,
  HealthIndicatorService,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { ElasticsearchIntegrationService } from '../../integrations/elasticsearch/elasticsearch.service.js';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { StorageService } from '../../integrations/storage/storage.service.js';

@SkipThrottle()
@Public()
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly database: TypeOrmHealthIndicator,
    private readonly indicators: HealthIndicatorService,
    private readonly redis: RedisService,
    private readonly search: ElasticsearchIntegrationService,
    private readonly storage: StorageService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.ready();
  }

  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.database.pingCheck('postgres'),
      () =>
        this.indicators.check('redis').attempt(async () => {
          const pong = await this.redis.ping();
          if (pong !== 'PONG') {
            throw new Error(`Redis trả về ${pong}`);
          }
        }),
      () =>
        this.indicators.check('elasticsearch').attempt(async () => {
          const ok = await this.search.ping();
          if (!ok) throw new Error('Elasticsearch không phản hồi');
        }),
      () =>
        this.indicators.check('minio').attempt(async () => {
          await this.storage.ping();
        }),
    ]);
  }
}
