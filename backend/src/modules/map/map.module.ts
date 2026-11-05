import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MapCriterionOverrideEntity } from './entities/map-criterion-override.entity.js';
import { MapCriterionWeightEntity } from './entities/map-criterion-weight.entity.js';
import { MapDatasetVersionEntity } from './entities/map-dataset-version.entity.js';
import { MapPlaceAnalysisEntity } from './entities/map-place-analysis.entity.js';
import { MapPlaceEvaluationRunEntity } from './entities/map-place-evaluation-run.entity.js';
import { MapPlaceEntity } from './entities/map-place.entity.js';
import { MapPoiEntity } from './entities/map-poi.entity.js';
import { MapSavedPlaceEntity } from './entities/map-saved-place.entity.js';
import { MapPlaceResolver } from './map-place-resolver.service.js';
import { MapDatasetService } from './map-dataset.service.js';
import { MapEvaluationService } from './map-evaluation.service.js';
import { MapLayersService } from './map-layers.service.js';
import { MapLimitsService } from './map-limits.service.js';
import { MapDatasetAdminController, MapPlacesController } from './map-places.controller.js';
import { MapPlacesService } from './map-places.service.js';
import { MapWeightsService } from './map-weights.service.js';
import { MapAdminController, MapController } from './map.controller.js';
import { MapConfig } from './map.config.js';
import { MapService } from './map.service.js';
import { VietmapClient } from './vietmap.client.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MapPlaceEntity,
      MapSavedPlaceEntity,
      MapCriterionOverrideEntity,
      MapDatasetVersionEntity,
      MapPlaceAnalysisEntity,
      MapPlaceEvaluationRunEntity,
      MapPoiEntity,
      MapCriterionWeightEntity,
    ]),
  ],
  controllers: [MapController, MapPlacesController, MapAdminController, MapDatasetAdminController],
  providers: [MapConfig, VietmapClient, MapLimitsService, MapService, MapPlaceResolver, MapDatasetService, MapEvaluationService, MapPlacesService, MapLayersService, MapWeightsService],
  exports: [MapService],
})
export class MapModule {}
