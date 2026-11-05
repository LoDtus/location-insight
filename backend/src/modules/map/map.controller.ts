import { Controller, Get, Header, Query, Req } from '@nestjs/common';
import { Public, RequirePermission } from '../../common/decorators/access.decorator.js';
import type { RequestWithPrincipal } from '../auth/auth.guard.js';
import {
  LayerTileQueryDto,
  ResolveQueryDto,
  ReverseQueryDto,
  RouteQueryDto,
  SearchQueryDto,
} from './dto/map.dto.js';
import { MapLayersService } from './map-layers.service.js';
import { MapService } from './map.service.js';

function userId(request: RequestWithPrincipal): string {
  return request.principal?.userId as string;
}

@Controller('map')
export class MapController {
  constructor(
    private readonly map: MapService,
    private readonly layers: MapLayersService,
  ) {}

  /** Điểm tiện ích của một ô (zoom 13) cho các lớp bản đồ; client tự lọc theo lớp đang bật. */
  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, max-age=3600')
  @Get('layers/places')
  layerTile(@Query() query: LayerTileQueryDto, @Req() request: RequestWithPrincipal) {
    return this.layers.tile(userId(request), query.x, query.y);
  }

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, max-age=300')
  @Get('config')
  config(@Req() request: RequestWithPrincipal) {
    return this.map.clientConfig(userId(request));
  }

  /**
   * Nền bản đồ cho trang công khai (landing, chi tiết tin). Chỉ trả style tile, không có tìm kiếm hay
   * chỉ đường nên không tốn hạn mức API; khóa Tilemap vốn đã nằm trong style URL gửi xuống trình duyệt.
   */
  @Public()
  @Header('Cache-Control', 'public, max-age=3600')
  @Get('public-config')
  publicConfig() {
    return this.map.publicConfig();
  }

  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Get('search')
  search(@Query() query: SearchQueryDto, @Req() request: RequestWithPrincipal) {
    const { text, lat, lng, limit, ...filters } = query;
    return this.map.search(userId(request), text, lat, lng, limit, filters);
  }

  /** Ghim mọi kết quả liên quan trong phạm vi (tìm theo loại hình, vd. "ngân hàng"). */
  @RequirePermission('map:use')
  @Header('Cache-Control', 'private, no-store')
  @Get('search/pins')
  searchPins(@Query() query: SearchQueryDto, @Req() request: RequestWithPrincipal) {
    const { text, lat, lng, limit: _limit, ...filters } = query;
    return this.map.searchPins(userId(request), text, lat, lng, filters);
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
    return this.map.route(userId(request), query.from, query.to, query.vehicle, query.alternatives, query.avoid, query.time);
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
