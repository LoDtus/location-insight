import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import {
  ResolveQueryDto,
  ReverseQueryDto,
  RouteQueryDto,
  SearchQueryDto,
} from './dto/map.dto.js';
import { MapService } from './map.service.js';

function userId(request: RequestWithPrincipal): string {
  return request.principal?.userId as string;
}

@Controller('map')
export class MapController {
  constructor(private readonly map: MapService) {}

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, max-age=300')
  @Get('config')
  config(@Req() request: RequestWithPrincipal) {
    return this.map.clientConfig(userId(request));
  }

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Get('search')
  search(@Query() query: SearchQueryDto, @Req() request: RequestWithPrincipal) {
    return this.map.search(userId(request), query.text, query.lat, query.lng, query.limit);
  }

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Get('places/resolve')
  resolve(@Query() query: ResolveQueryDto, @Req() request: RequestWithPrincipal) {
    return this.map.resolve(userId(request), query.refId);
  }

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Get('reverse')
  reverse(@Query() query: ReverseQueryDto, @Req() request: RequestWithPrincipal) {
    return this.map.reverse(userId(request), query.lat, query.lng);
  }

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Get('route')
  route(@Query() query: RouteQueryDto, @Req() request: RequestWithPrincipal) {
    return this.map.route(userId(request), query.from, query.to, query.vehicle, query.alternatives);
  }
}

@Controller('admin/map')
export class MapAdminController {
  constructor(private readonly map: MapService) {}

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Get('usage')
  usage() {
    return this.map.usage();
  }
}
