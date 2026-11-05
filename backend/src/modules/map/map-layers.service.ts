import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, type Repository } from 'typeorm';
import { RedisService } from '../../integrations/redis/redis.service.js';
import { MapPoiEntity } from './entities/map-poi.entity.js';
import { tileBounds, tileInVietnam } from './map-layer-tiles.js';
import { MapLimitsService } from './map-limits.service.js';
import { MAP_LAYER_TILE_MAX, MAP_LAYER_TILE_ZOOM, MAP_LAYER_TTL } from './map.constants.js';

export interface MapPoiView {
  /** Nhóm lớp (school, bank…). */
  c: string;
  /** Tên (có thể rỗng). */
  n: string;
  /** Thẻ gốc (kindergarten, atm…). */
  k: string;
  lat: number;
  lng: number;
}

export interface MapLayerTile {
  z: number;
  x: number;
  y: number;
  /** Phiên bản dữ liệu nguồn của các điểm. */
  version: string;
  points: MapPoiView[];
  /** true nếu ô bị cắt ở MAP_LAYER_TILE_MAX điểm. */
  truncated: boolean;
}

const VERSION_KEY = 'map:pois:version';
const VERSION_TTL_MS = 60_000;

/** Lớp điểm tiện ích theo ô bản đồ cố định (zoom 13), cache Redis theo phiên bản dữ liệu. */
@Injectable()
export class MapLayersService {
  private readonly logger = new Logger(MapLayersService.name);

  constructor(
    @InjectRepository(MapPoiEntity) private readonly pois: Repository<MapPoiEntity>,
    private readonly limits: MapLimitsService,
    private readonly redis: RedisService,
  ) {}

  async tile(userId: string, x: number, y: number): Promise<MapLayerTile> {
    await this.limits.consumeUser('layers', userId);
    const version = await this.version();
    const empty: MapLayerTile = { z: MAP_LAYER_TILE_ZOOM, x, y, version, points: [], truncated: false };
    if (!version || !tileInVietnam(x, y)) return empty;
    const key = `cache:map:layers:${version}:${MAP_LAYER_TILE_ZOOM}/${x}/${y}`;
    const hit = await this.read(key);
    if (hit) return hit;
    const [minLng, minLat, maxLng, maxLat] = tileBounds(x, y);
    const rows = await this.pois.find({
      select: { category: true, name: true, kind: true, lat: true, lng: true },
      where: { lat: Between(minLat, maxLat), lng: Between(minLng, maxLng) },
      order: { category: 'ASC', name: 'DESC' },
      take: MAP_LAYER_TILE_MAX + 1,
    });
    const tile: MapLayerTile = {
      ...empty,
      // Ô liền kề dùng chung cạnh: điểm nằm đúng cạnh trên/phải thuộc ô kia.
      points: rows
        .filter((row) => row.lat < maxLat && row.lng < maxLng)
        .slice(0, MAP_LAYER_TILE_MAX)
        .map((row) => ({ c: row.category, n: row.name, k: row.kind, lat: row.lat, lng: row.lng })),
      truncated: rows.length > MAP_LAYER_TILE_MAX,
    };
    await this.write(key, tile);
    return tile;
  }

  /** Phiên bản dữ liệu mới nhất đã nhập; rỗng nếu chưa nhập gì. */
  private async version(): Promise<string> {
    try {
      const cached = await this.redis.get<string>(VERSION_KEY);
      if (typeof cached === 'string') return cached;
    } catch {
      // Redis lỗi: đọc DB
    }
    const row = await this.pois
      .createQueryBuilder('poi')
      .select('MAX(poi.source_version)', 'version')
      .getRawOne<{ version: string | null }>();
    const version = row?.version ?? '';
    try {
      await this.redis.set(VERSION_KEY, version, VERSION_TTL_MS);
    } catch {
      // bỏ qua
    }
    return version;
  }

  private async read(key: string): Promise<MapLayerTile | null> {
    try {
      const hit = await this.redis.get<MapLayerTile>(key);
      return hit && Array.isArray(hit.points) ? hit : null;
    } catch (error) {
      this.logger.warn(`Đọc cache lớp bản đồ lỗi: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  private async write(key: string, value: MapLayerTile): Promise<void> {
    try {
      await this.redis.set(key, value, MAP_LAYER_TTL * 1000);
    } catch (error) {
      this.logger.warn(`Ghi cache lớp bản đồ lỗi: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
