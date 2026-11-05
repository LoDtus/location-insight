import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapCriterionOverrideEntity } from './entities/map-criterion-override.entity.js';
import { MapSavedPlaceEntity } from './entities/map-saved-place.entity.js';
import { MapLimitsService } from './map-limits.service.js';
import { MapPlacesController } from './map-places.controller.js';
import { MapPlacesService } from './map-places.service.js';
import { MapAdminController, MapController } from './map.controller.js';
import { MapConfig } from './map.config.js';
import { MapService } from './map.service.js';
import { VietmapClient } from './vietmap.client.js';

@Module({
  imports: [TypeOrmModule.forFeature([MapSavedPlaceEntity, MapCriterionOverrideEntity])],
  controllers: [MapController, MapPlacesController, MapAdminController],
  providers: [MapConfig, VietmapClient, MapLimitsService, MapService, MapPlacesService],
  exports: [MapService],
})
export class MapModule {}
