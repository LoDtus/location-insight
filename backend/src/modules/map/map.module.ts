import { Module } from '@nestjs/common';
import { MapLimitsService } from './map-limits.service.js';
import { MapAdminController, MapController } from './map.controller.js';
import { MapConfig } from './map.config.js';
import { MapService } from './map.service.js';
import { VietmapClient } from './vietmap.client.js';

@Module({
  controllers: [MapController, MapAdminController],
  providers: [MapConfig, VietmapClient, MapLimitsService, MapService],
  exports: [MapService],
})
export class MapModule {}
