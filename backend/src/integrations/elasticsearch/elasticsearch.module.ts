import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ElasticsearchModule } from '@nestjs/elasticsearch';
import { ElasticsearchIntegrationService } from './elasticsearch.service.js';

@Global()
@Module({
  imports: [
    ElasticsearchModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const username = config.get<string>('ELASTICSEARCH_USERNAME');
        const password = config.get<string>('ELASTICSEARCH_PASSWORD');

        return {
          node: config.getOrThrow<string>('ELASTICSEARCH_NODE'),
          maxRetries: 3,
          requestTimeout: 30000,
          sniffOnStart: false,
          compression: true,
          ...(username && password ? { auth: { username, password } } : {}),
        };
      },
    }),
  ],
  providers: [ElasticsearchIntegrationService],
  exports: [ElasticsearchIntegrationService, ElasticsearchModule],
})
export class ElasticsearchIntegrationModule {}
