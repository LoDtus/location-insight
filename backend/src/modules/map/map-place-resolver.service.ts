import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, type EntityManager, type Repository } from 'typeorm';
import { MapPlaceEntity } from './entities/map-place.entity.js';
import { MapService } from './map.service.js';
import {
  CANDIDATE_BOX_M,
  boxAround,
  gridCellOf,
  pickPlace,
  preciseAddressKey,
} from './place-identity.js';

export interface ResolvedPlace {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address: string;
}

function toResolved(row: MapPlaceEntity): ResolvedPlace {
  return { id: row.id, lat: row.lat, lng: row.lng, name: row.name, address: row.address };
}

/**
 * Đổi một cú bấm (lat, lng) thành địa điểm chuẩn hóa (map_places). Tên/địa chỉ lấy từ Reverse phía server,
 * không nhận từ client. `find` chỉ tra (không tạo), `resolve` tạo nếu chưa có.
 */
@Injectable()
export class MapPlaceResolver {
  constructor(
    @InjectRepository(MapPlaceEntity) private readonly places: Repository<MapPlaceEntity>,
    private readonly map: MapService,
  ) {}

  /** Tra địa điểm có sẵn cho điểm bấm; null nếu chưa có (không tạo mới, dùng cho thao tác chỉ đọc). */
  async find(lat: number, lng: number): Promise<ResolvedPlace | null> {
    const reverse = await this.map.reverseForPlace(lat, lng);
    const match = pickPlace({ lat, lng }, preciseAddressKey(reverse?.display, reverse?.distanceM), await this.candidates(this.places, lat, lng));
    if (!match) return null;
    const row = await this.places.findOne({ where: { id: match.id } });
    return row ? toResolved(row) : null;
  }

  /** Tra hoặc tạo địa điểm. Khóa advisory theo ô lưới ~100 m để hai yêu cầu đồng thời không tạo trùng. */
  async resolve(lat: number, lng: number): Promise<ResolvedPlace> {
    const reverse = await this.map.reverseForPlace(lat, lng);
    const addressKey = preciseAddressKey(reverse?.display, reverse?.distanceM);
    return this.places.manager.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`map-place:${gridCellOf({ lat, lng })}`]);
      const repo = manager.getRepository(MapPlaceEntity);
      const match = pickPlace({ lat, lng }, addressKey, await this.candidates(repo, lat, lng));
      if (match) {
        const row = await repo.findOne({ where: { id: match.id } });
        if (row) return toResolved(await this.fillMissing(manager, row, addressKey, reverse?.name, reverse?.display));
      }
      const created = await repo.save(
        repo.create({
          lat: Number(lat.toFixed(6)),
          lng: Number(lng.toFixed(6)),
          addressKey,
          name: (reverse?.name ?? '').slice(0, 200),
          address: (reverse?.display ?? '').slice(0, 300),
        }),
      );
      return toResolved(created);
    });
  }

  /** Địa điểm tạo từ một điểm chưa có địa chỉ: lần sau có địa chỉ chính xác thì bổ sung. */
  private async fillMissing(
    manager: EntityManager,
    row: MapPlaceEntity,
    addressKey: string | null,
    name: string | undefined,
    display: string | undefined,
  ): Promise<MapPlaceEntity> {
    if (row.addressKey || !addressKey) return row;
    row.addressKey = addressKey;
    if (!row.name && name) row.name = name.slice(0, 200);
    if (!row.address && display) row.address = display.slice(0, 300);
    return manager.getRepository(MapPlaceEntity).save(row);
  }

  private async candidates(repo: Repository<MapPlaceEntity>, lat: number, lng: number) {
    const [minLat, maxLat, minLng, maxLng] = boxAround({ lat, lng }, CANDIDATE_BOX_M);
    const rows = await repo.find({
      where: { lat: Between(minLat, maxLat), lng: Between(minLng, maxLng) },
      select: { id: true, lat: true, lng: true, addressKey: true },
      take: 200,
    });
    return rows.map((row) => ({ id: row.id, lat: row.lat, lng: row.lng, addressKey: row.addressKey }));
  }
}
