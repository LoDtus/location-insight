import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import {
  CriterionOverrideDto,
  CriterionResetQueryDto,
  EvaluationQueryDto,
  EvaluationRunDto,
  ReleaseDatasetDto,
  SavePlaceDto,
} from './dto/map.dto.js';
import { MapDatasetService } from './map-dataset.service.js';
import { MapEvaluationService } from './map-evaluation.service.js';
import { MapPlacesService } from './map-places.service.js';

function userId(request: RequestWithPrincipal): string {
  return request.principal?.userId as string;
}

/** Mã tiêu chí: chữ thường, số, gạch nối (xem place-evaluation.ts). */
const CRITERION_PARAM = 'criterionId';

@Controller('map')
export class MapPlacesController {
  constructor(
    private readonly places: MapPlacesService,
    private readonly evaluations: MapEvaluationService,
  ) {}

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Get('saved')
  listSaved(@Req() request: RequestWithPrincipal) {
    return this.places.listSaved(userId(request));
  }

  @RequirePermission('map:use')
  @Post('saved')
  save(@Body() body: SavePlaceDto, @Req() request: RequestWithPrincipal) {
    return this.places.save(userId(request), body);
  }

  @RequirePermission('map:use')
  @Delete('saved/:id')
  remove(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: RequestWithPrincipal) {
    return this.places.remove(userId(request), id);
  }

  /** Lượt đánh giá gần nhất của chính người dùng (null nếu chưa bấm). Chỉ đọc: không tính toán, không tính phí. */
  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Get('places/evaluation')
  mine(@Query() query: EvaluationQueryDto, @Req() request: RequestWithPrincipal) {
    return this.evaluations.mine(userId(request), query.lat, query.lng);
  }

  /** Bấm "Đánh giá" / "Đánh giá lại" (lượt tính phí). Cùng phiên bản dữ liệu thì trả lại lượt cũ, charged=false. */
  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Post('places/evaluation')
  run(@Body() body: EvaluationRunDto, @Req() request: RequestWithPrincipal) {
    return this.evaluations.run(userId(request), body.lat, body.lng);
  }

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Put(`places/evaluation/criteria/:${CRITERION_PARAM}`)
  override(
    @Param(CRITERION_PARAM) criterionId: string,
    @Body() body: CriterionOverrideDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.evaluations.override(userId(request), criterionId, body);
  }

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Delete(`places/evaluation/criteria/:${CRITERION_PARAM}`)
  reset(
    @Param(CRITERION_PARAM) criterionId: string,
    @Query() query: CriterionResetQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.evaluations.resetCriterion(userId(request), criterionId, query.lat, query.lng);
  }
}

/** Phiên bản bộ dữ liệu đánh giá: chỉ admin xem và nâng phiên bản. */
@Controller('admin/map/dataset-versions')
export class MapDatasetAdminController {
  constructor(private readonly dataset: MapDatasetService) {}

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Get()
  list() {
    return this.dataset.list();
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Post()
  release(@Body() body: ReleaseDatasetDto, @Req() request: RequestWithPrincipal) {
    return this.dataset.release(userId(request), body.note);
  }
}
