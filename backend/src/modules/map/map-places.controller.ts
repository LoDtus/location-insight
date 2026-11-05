import { Body, Controller, Delete, Get, Header, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import {
  CriterionOverrideDto,
  CriterionResetQueryDto,
  EvaluationQueryDto,
  SavePlaceDto,
} from './dto/map.dto.js';
import { MapPlacesService } from './map-places.service.js';

function userId(request: RequestWithPrincipal): string {
  return request.principal?.userId as string;
}

/** Mã tiêu chí: chữ thường, số, gạch nối (xem place-evaluation.ts). */
const CRITERION_PARAM = 'criterionId';

@Controller('map')
export class MapPlacesController {
  constructor(private readonly places: MapPlacesService) {}

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

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Get('places/evaluation')
  evaluate(@Query() query: EvaluationQueryDto, @Req() request: RequestWithPrincipal) {
    return this.places.evaluate(userId(request), query.lat, query.lng);
  }

  @RequirePermission('map:use')
  @Put(`places/evaluation/criteria/:${CRITERION_PARAM}`)
  override(
    @Param(CRITERION_PARAM) criterionId: string,
    @Body() body: CriterionOverrideDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.places.override(userId(request), criterionId, body);
  }

  @RequirePermission('map:use')
  @Delete(`places/evaluation/criteria/:${CRITERION_PARAM}`)
  reset(
    @Param(CRITERION_PARAM) criterionId: string,
    @Query() query: CriterionResetQueryDto,
    @Req() request: RequestWithPrincipal,
  ) {
    return this.places.resetCriterion(userId(request), criterionId, query.lat, query.lng);
  }
}
