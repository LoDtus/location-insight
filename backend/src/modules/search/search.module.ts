import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SearchOutboxEntity } from './entities/search-outbox.entity.js';
import { SearchIndexService } from './search-index.service.js';
import { SearchRegistry } from './search-registry.service.js';
import { SearchWorkerService } from './search-worker.service.js';
import { SearchService } from './search.service.js';

/**
 * Lớp tìm kiếm dùng chung trên Elasticsearch (017-search-elasticsearch). Module nghiệp vụ chỉ cần
 * đăng ký một `SearchProfile` vào `SearchRegistry` và gọi `SearchService`. Không profile nào được bật
 * cho tới khi tên của nó nằm trong ELASTICSEARCH_PROFILES.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([SearchOutboxEntity])],
  providers: [
    SearchRegistry,
    SearchService,
    SearchIndexService,
    SearchWorkerService,
  ],
  exports: [SearchRegistry, SearchService, SearchIndexService],
})
export class SearchModule {}
