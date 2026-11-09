import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CRITERIA, layerTheme, lowerConfidence, type CriterionDefinition, type CriterionMethod, type Scoring } from '../criteria.js';
import { GeoSchemaService } from '../datasets/geo-schema.service.js';
import { MapDatasetService } from '../map-dataset.service.js';
import { haversineM } from '../map.mapper.js';
import { MapService } from '../map.service.js';
import {
  formatDistance,
  formatNumber,
  mockPendingMeasurement,
  NEUTRAL_SCORE,
  type CriterionMeasurement,
  type MeasurementEvidence,
} from '../place-evaluation.js';
import { median, round1, scoreOf } from '../scoring.js';
import {
  cellsWithin,
  queryGrids,
  queryLines,
  queryPoints,
  queryReleaseLayers,
  type GridRow,
  type LineRow,
  type PointRequest,
  type PointRow,
  type ReleaseLayer,
} from './geo-measure.queries.js';
import { OpenAqClient } from './openaq.client.js';

/** Số đo thời gian đi (Vietmap) dùng được bao lâu (research.md Bản ghi 7). */
const TRAVEL_TTL_DAYS = 30;
/** Không khí đổi theo giờ. */
const AIR_TTL_HOURS = 6;

type Point = { lat: number; lng: number };

interface GeoResults {
  available: boolean;
  layers: ReleaseLayer[];
  points: Map<string, PointRow[]>;
  lines: Map<string, LineRow>;
  grids: Map<string, GridRow[]>;
}

/** Kết quả gọi Vietmap Matrix một lần cho cả lượt: phút theo mã tiêu chí. */
interface TravelResults {
  minutes: Map<string, Array<number | null>>;
  failed: boolean;
}

function byId<T extends { id: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) map.set(row.id, [...(map.get(row.id) ?? []), row]);
  return map;
}

function verdictFor(definition: CriterionDefinition, score: number): string {
  if (definition.id === 'on-giao-thong') return score >= 7 ? 'Yên tĩnh' : score >= 4 ? 'Hơi ồn' : 'Ồn';
  if (definition.measure.method === 'count') return score >= 7 ? 'Nhiều' : score >= 4 ? 'Vừa' : 'Ít';
  return score >= 7 ? 'Gần' : score >= 4 ? 'Vừa' : 'Xa';
}

/**
 * Đo mọi tiêu chí tại một tọa độ theo bản phát hành đã ghim (018-location-data FR-10, research.md Bản ghi 10, 14,
 * 15). Thứ tự ưu tiên nguồn (BR-11): PostGIS trước, Vietmap/OpenAQ sau, AI chưa làm (số minh họa).
 *
 * Không bao giờ ném lỗi vì một nguồn: nguồn hỏng thì tiêu chí đó `unavailable`/`fallback`, các tiêu chí khác vẫn đo.
 */
@Injectable()
export class PlaceMeasureService {
  private readonly logger = new Logger(PlaceMeasureService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly geoSchema: GeoSchemaService,
    private readonly dataset: MapDatasetService,
    private readonly maps: MapService,
    private readonly air: OpenAqClient,
  ) {}

  async measure(lat: number, lng: number, datasetVersion: number): Promise<CriterionMeasurement[]> {
    const origin = { lat, lng };
    const started = Date.now();
    const geo = await this.measureGeo(origin, datasetVersion);
    const [travel, airResult] = await Promise.all([this.measureTravel(origin, geo), this.measureAir(origin)]);
    const measurements = CRITERIA.map((definition) => {
      if (definition.status === 'not_implemented') return mockPendingMeasurement(definition, lat, lng);
      try {
        return this.assemble(definition, origin, geo, travel, airResult);
      } catch (error) {
        this.logger.error(`Tiêu chí ${definition.id} lỗi khi tính: ${error instanceof Error ? error.message : String(error)}`);
        return unmeasured(definition, 'unavailable', 'Lỗi khi tính tiêu chí này.');
      }
    });
    this.logger.log(`Đo ${lat.toFixed(5)},${lng.toFixed(5)} theo bản ${datasetVersion}: ${Date.now() - started} ms`);
    return measurements;
  }

  /* ---------------- PostGIS ---------------- */

  private async measureGeo(origin: Point, datasetVersion: number): Promise<GeoResults> {
    const empty: GeoResults = { available: false, layers: [], points: new Map(), lines: new Map(), grids: new Map() };
    if (!(await this.geoSchema.ensure())) return empty;
    try {
      const manifest = await this.dataset.manifestOf(datasetVersion);
      const layers = await queryReleaseLayers(this.dataSource, Object.values(manifest));
      const versionsOf = (theme: string, kind: ReleaseLayer['geometryKind']): string[] =>
        layers.filter((layer) => layer.geometryKind === kind && layerTheme(layer.layerCode) === theme).map((layer) => layer.versionId);

      const pointRequests: PointRequest[] = [];
      const lineRequests: Array<{ id: string; versions: string[]; roadClasses: string[]; searchM: number }> = [];
      const gridRequests: Array<{ id: string; versions: string[]; radiusM: number }> = [];
      for (const definition of CRITERIA) {
        const m = definition.measure;
        if (m.method === 'nearest' || m.method === 'travel_time') {
          const versions = versionsOf(m.theme, 'point');
          if (versions.length === 0) continue;
          const take = m.method === 'travel_time' ? m.candidates : 1;
          pointRequests.push({ id: definition.id, versions, categories: [...m.categories], kinds: m.kinds ? [...m.kinds] : null, searchM: m.searchM, take, countM: m.supportM });
        } else if (m.method === 'count') {
          const versions = versionsOf(m.theme, 'point');
          if (versions.length > 0) pointRequests.push({ id: definition.id, versions, categories: [...m.categories], kinds: null, searchM: m.radiusM, take: 1, countM: m.radiusM });
        } else if (m.method === 'line_nearest') {
          const versions = versionsOf(m.theme, 'line');
          if (versions.length > 0) lineRequests.push({ id: definition.id, versions, roadClasses: [...m.roadClasses], searchM: m.searchM });
        } else if (m.method === 'grid_sum' || m.method === 'grid_mean' || m.method === 'grid_relative' || m.method === 'grid_cell') {
          const versions = versionsOf(m.theme, 'grid');
          if (versions.length > 0) gridRequests.push({ id: definition.id, versions: versions.slice(0, 1), radiusM: m.method === 'grid_cell' ? 0 : m.radiusM });
        }
      }
      const [points, lines, grids] = await Promise.all([
        queryPoints(this.dataSource, origin.lat, origin.lng, pointRequests),
        queryLines(this.dataSource, origin.lat, origin.lng, lineRequests),
        queryGrids(this.dataSource, origin.lat, origin.lng, gridRequests),
      ]);
      return {
        available: true,
        layers,
        points: byId(points),
        lines: new Map(lines.map((row) => [row.id, row])),
        grids: byId(grids),
      };
    } catch (error) {
      this.logger.error(`Đo PostGIS lỗi: ${error instanceof Error ? error.message : String(error)}`);
      return empty;
    }
  }

  /* ---------------- Vietmap Matrix ---------------- */

  /** Một lượt Matrix cho mọi tiêu chí thời gian đi (ứng viên bệnh viện + mốc Hồ Gươm). */
  private async measureTravel(origin: Point, geo: GeoResults): Promise<TravelResults> {
    const targets: Array<{ id: string; points: Point[] }> = [];
    for (const definition of CRITERIA) {
      const m = definition.measure;
      if (m.method === 'travel_time') {
        const candidates = (geo.points.get(definition.id) ?? []).filter((row) => row.lat !== null && row.lng !== null);
        if (candidates.length > 0) targets.push({ id: definition.id, points: candidates.map((row) => ({ lat: row.lat as number, lng: row.lng as number })) });
      } else if (m.method === 'anchor') {
        targets.push({ id: definition.id, points: [m.anchor] });
      }
    }
    const result: TravelResults = { minutes: new Map(), failed: false };
    if (targets.length === 0) return result;
    try {
      // Mọi tiêu chí thời gian đi hiện dùng xe máy: gộp một lượt gọi.
      const flat = targets.flatMap((target) => target.points);
      const minutes = await this.maps.travelMinutes(origin, flat, 'motorcycle');
      let offset = 0;
      for (const target of targets) {
        result.minutes.set(target.id, minutes.slice(offset, offset + target.points.length));
        offset += target.points.length;
      }
    } catch (error) {
      this.logger.warn(`Vietmap Matrix không dùng được, đo dự phòng theo khoảng cách: ${error instanceof Error ? error.message : String(error)}`);
      result.failed = true;
    }
    return result;
  }

  private async measureAir(origin: Point): Promise<Awaited<ReturnType<OpenAqClient['nearestPm25']>> | null> {
    const definition = CRITERIA.find((item) => item.measure.method === 'air_station');
    if (!definition || definition.measure.method !== 'air_station') return null;
    return this.air.nearestPm25(origin.lat, origin.lng, definition.measure.maxStationM, definition.measure.maxAgeHours);
  }

  /* ---------------- Gộp kết quả ---------------- */

  private assemble(
    definition: CriterionDefinition,
    origin: Point,
    geo: GeoResults,
    travel: TravelResults,
    air: Awaited<ReturnType<OpenAqClient['nearestPm25']>> | null,
  ): CriterionMeasurement {
    const m = definition.measure;
    switch (m.method) {
      case 'nearest':
      case 'travel_time':
      case 'count':
        return this.fromPoints(definition, m, geo, travel);
      case 'line_nearest':
        return this.fromLine(definition, geo);
      case 'grid_sum':
      case 'grid_mean':
      case 'grid_relative':
      case 'grid_cell':
        return this.fromGrid(definition, m, geo);
      case 'anchor':
        return this.fromAnchor(definition, m, origin, travel);
      case 'air_station':
        return fromAir(definition, air);
      case 'ai_pending':
        return mockPendingMeasurement(definition, origin.lat, origin.lng);
    }
  }

  private geoMissing(definition: CriterionDefinition, geo: GeoResults, theme: string): CriterionMeasurement {
    // Thông điệp cho người dùng cuối: không lộ đường dẫn quản trị hay mã lớp (mã lớp vẫn có trong log/nguồn gốc).
    if (!geo.available) return unmeasured(definition, 'unavailable', 'Dữ liệu nền tạm thời chưa đọc được.');
    this.logger.debug(`Bản phát hành chưa có lớp chủ đề "${theme}" cho tiêu chí ${definition.id}`);
    return unmeasured(definition, 'no_data', `Chưa có dữ liệu ${definition.noun} trong bản dữ liệu hiện hành.`);
  }

  private fromPoints(
    definition: CriterionDefinition,
    m: Extract<CriterionMethod, { method: 'nearest' | 'travel_time' | 'count' }>,
    geo: GeoResults,
    travel: TravelResults,
  ): CriterionMeasurement {
    const rows = geo.points.get(definition.id);
    if (!rows) return this.geoMissing(definition, geo, m.theme);
    const versions = versionsUsed(geo, m.theme, 'point');
    const support = rows[0]?.total ?? 0;
    const method = `${m.method}@${m.version}`;

    if (m.method === 'count') {
      const weighted = rows[0]?.weighted ?? 0;
      const score = scoreOf(weighted, definition.scoring);
      return {
        id: definition.id,
        autoScore: score,
        verdict: verdictFor(definition, score),
        detail: `${support} ${definition.noun} trong ${formatDistance(m.radiusM)}`,
        status: 'ok',
        confidence: definition.confidence,
        value: support,
        unit: definition.noun,
        method,
        layerVersions: versions,
      };
    }

    const found = rows.filter((row) => row.distance_m !== null && row.lat !== null && row.lng !== null);
    if (found.length === 0) {
      return {
        ...unmeasured(definition, 'no_data', `Không thấy ${definition.noun} nào trong ${formatDistance(m.searchM)}. Dữ liệu có thể thiếu.`),
        layerVersions: versions,
      };
    }
    const evidence: MeasurementEvidence[] = found.map((row) => ({
      name: row.name || definition.noun,
      lat: row.lat as number,
      lng: row.lng as number,
      distanceM: Math.round(row.distance_m as number),
    }));
    let confidence = support < m.minSupport ? lowerConfidence(definition.confidence) : definition.confidence;

    if (m.method === 'travel_time') {
      const minutes = travel.minutes.get(definition.id);
      const reachable = minutes
        ?.map((value, index) => ({ value, index }))
        .filter((item): item is { value: number; index: number } => item.value !== null)
        .sort((a, b) => a.value - b.value)[0];
      if (reachable) {
        const best = evidence[reachable.index];
        best.minutes = reachable.value;
        const score = scoreOf(reachable.value, definition.scoring);
        return {
          id: definition.id,
          autoScore: score,
          verdict: verdictFor(definition, score),
          detail: `${formatNumber(reachable.value, 0)} phút đi xe máy tới ${definition.noun} gần nhất (${formatDistance(best.distanceM)})`,
          status: 'ok',
          confidence,
          value: reachable.value,
          unit: 'phút',
          method,
          layerVersions: versions,
          evidence: [best, ...evidence.filter((item) => item !== best)],
          observedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + TRAVEL_TTL_DAYS * 86400000).toISOString(),
        };
      }
      // Vietmap lỗi, hết ngân sách hoặc không tìm được đường: chấm theo khoảng cách, hạ độ tin.
      confidence = lowerConfidence(confidence);
      const distance = evidence[0].distanceM;
      const score = scoreOf(distance, m.fallback);
      return {
        id: definition.id,
        autoScore: score,
        verdict: verdictFor(definition, score),
        detail: `Cách ${definition.noun} gần nhất ${formatDistance(distance)} (đường chim bay)`,
        status: 'fallback',
        confidence,
        value: distance,
        unit: 'm',
        method: `nearest@1`,
        layerVersions: versions,
        evidence,
        note: travel.failed ? 'Chưa lấy được thời gian đi từ Vietmap, tạm tính theo khoảng cách.' : 'Không tìm được đường đi, tạm tính theo khoảng cách.',
      };
    }

    const distance = evidence[0].distanceM;
    const score = scoreOf(distance, definition.scoring);
    return {
      id: definition.id,
      autoScore: score,
      verdict: verdictFor(definition, score),
      detail: `Cách ${definition.noun} gần nhất ${formatDistance(distance)}${support > 1 ? `, ${support} chỗ trong ${formatDistance(m.supportM)}` : ''}`,
      status: 'ok',
      confidence,
      value: distance,
      unit: 'm',
      method,
      layerVersions: versions,
      evidence,
      note: definition.caveat,
    };
  }

  private fromLine(definition: CriterionDefinition, geo: GeoResults): CriterionMeasurement {
    const m = definition.measure;
    if (m.method !== 'line_nearest') throw new Error('sai method');
    const row = geo.lines.get(definition.id);
    if (!row) return this.geoMissing(definition, geo, m.theme);
    const versions = versionsUsed(geo, m.theme, 'line');
    if (row.distance_m === null || row.lat === null || row.lng === null) {
      // Đường trục xa hơn bán kính tìm: với tiêu chí ồn đó là điều tốt.
      const quiet = definition.scoring.curve === 'decay' && definition.scoring.good > definition.scoring.bad;
      if (quiet) {
        return {
          id: definition.id,
          autoScore: 10,
          verdict: verdictFor(definition, 10),
          detail: `Không có ${definition.noun} trong ${formatDistance(m.searchM)}`,
          status: 'ok',
          confidence: definition.confidence,
          value: m.searchM,
          unit: 'm',
          method: `${m.method}@${m.version}`,
          layerVersions: versions,
          note: definition.caveat,
        };
      }
      return { ...unmeasured(definition, 'no_data', `Không thấy ${definition.noun} trong ${formatDistance(m.searchM)}.`), layerVersions: versions };
    }
    const distance = Math.round(row.distance_m);
    const score = scoreOf(distance, definition.scoring);
    const name = row.name ? ` (${row.name})` : '';
    return {
      id: definition.id,
      autoScore: score,
      verdict: verdictFor(definition, score),
      detail: `Cách ${definition.noun} gần nhất ${formatDistance(distance)}${name}`,
      status: 'ok',
      confidence: definition.confidence,
      value: distance,
      unit: 'm',
      method: `${m.method}@${m.version}`,
      layerVersions: versions,
      evidence: [{ name: row.name || definition.noun, lat: row.lat, lng: row.lng, distanceM: distance }],
      note: definition.caveat,
    };
  }

  private fromGrid(
    definition: CriterionDefinition,
    m: Extract<CriterionMethod, { method: 'grid_sum' | 'grid_mean' | 'grid_relative' | 'grid_cell' }>,
    geo: GeoResults,
  ): CriterionMeasurement {
    const rows = geo.grids.get(definition.id);
    const versions = versionsUsed(geo, m.theme, 'grid').slice(0, 1);
    if (!rows) {
      if (geo.available && versions.length > 0) {
        return { ...unmeasured(definition, 'no_data', 'Địa điểm nằm ngoài vùng phủ của lớp lưới.'), layerVersions: versions };
      }
      return this.geoMissing(definition, geo, m.theme);
    }
    const values = rows.filter((row) => row.value !== null).map((row) => ({ value: row.value as number, distanceM: row.distance_m }));
    const center = values.find((item) => item.distanceM === 0)?.value ?? null;
    const radiusM = m.method === 'grid_cell' ? 0 : m.radiusM;
    const expected = cellsWithin(radiusM);
    // Thiếu nhiều ô (ngoài vùng phủ) thì hạ độ tin.
    const confidence = values.length < expected * 0.7 ? lowerConfidence(definition.confidence) : definition.confidence;
    const base = { id: definition.id, status: 'ok' as const, confidence, method: `${m.method}@${m.version}`, layerVersions: versions, note: definition.caveat };

    if (m.method === 'grid_sum') {
      if (values.length === 0) return { ...unmeasured(definition, 'no_data', 'Các ô quanh địa điểm chưa có số liệu.'), layerVersions: versions };
      const people = values.reduce((sum, item) => sum + item.value, 0);
      const score = scoreOf(people, definition.scoring);
      return {
        ...base,
        autoScore: score,
        verdict: people > 22000 ? 'Rất đông' : people > 9000 ? 'Đông vừa' : 'Thưa',
        detail: `Khoảng ${formatNumber(Math.round(people / 100) * 100)} người trong ${formatDistance(m.radiusM)}`,
        value: Math.round(people),
        unit: 'người',
      };
    }
    if (m.method === 'grid_mean') {
      if (values.length === 0) return { ...unmeasured(definition, 'no_data', 'Các ô quanh địa điểm chưa có số liệu.'), layerVersions: versions };
      const ratio = values.reduce((sum, item) => sum + item.value, 0) / values.length;
      const score = scoreOf(ratio, definition.scoring);
      return {
        ...base,
        autoScore: score,
        verdict: ratio >= 22 ? 'Nhiều cây' : ratio >= 12 ? 'Vừa' : 'Ít cây',
        detail: `${formatNumber(ratio, 0)}% ${definition.noun} trong ${formatDistance(m.radiusM)}`,
        value: round1(ratio),
        unit: '%',
      };
    }
    if (center === null) return { ...unmeasured(definition, 'no_data', 'Ô chứa địa điểm chưa có số liệu (ngoài vùng phủ).'), layerVersions: versions };
    if (m.method === 'grid_cell') {
      const depth = center;
      const score = scoreOf(depth, definition.scoring);
      const blockingHit = definition.blocking !== undefined && depth >= definition.blocking.atLeast;
      return {
        ...base,
        autoScore: score,
        verdict: depth > 0 ? 'Trong vệt ngập mô hình' : 'Ngoài vệt ngập mô hình',
        detail: depth > 0 ? `Độ sâu mô hình ${formatNumber(depth, 1)} m ở chu kỳ 100 năm` : 'Không nằm trong vệt ngập sông chu kỳ 100 năm',
        value: round1(depth),
        unit: 'm',
        blockingHit,
      };
    }
    // grid_relative: chênh ô chứa điểm so với trung vị các ô quanh.
    const around = median(values.map((item) => item.value)) ?? center;
    const delta = round1(center - around);
    const score = scoreOf(delta, definition.scoring);
    const abs = formatNumber(Math.abs(delta), 1);
    return {
      ...base,
      autoScore: score,
      verdict: delta >= 0.5 ? 'Cao hơn xung quanh' : delta <= -0.5 ? 'Thấp hơn xung quanh' : 'Ngang xung quanh',
      detail: delta >= 0 ? `Cao hơn ${definition.noun} khoảng ${abs} m` : `Thấp hơn ${definition.noun} khoảng ${abs} m`,
      value: delta,
      unit: 'm',
    };
  }

  private fromAnchor(
    definition: CriterionDefinition,
    m: Extract<CriterionMethod, { method: 'anchor' }>,
    origin: Point,
    travel: TravelResults,
  ): CriterionMeasurement {
    const distance = Math.round(haversineM(origin, m.anchor));
    const minutes = travel.minutes.get(definition.id)?.[0] ?? null;
    const evidence = [{ name: definition.noun, lat: m.anchor.lat, lng: m.anchor.lng, distanceM: distance, ...(minutes !== null ? { minutes } : {}) }];
    if (minutes !== null) {
      const score = scoreOf(minutes, definition.scoring);
      return {
        id: definition.id,
        autoScore: score,
        verdict: verdictFor(definition, score),
        detail: `${formatNumber(minutes, 0)} phút đi xe máy tới ${definition.noun} (${formatDistance(distance)})`,
        status: 'ok',
        confidence: definition.confidence,
        value: minutes,
        unit: 'phút',
        method: `${m.method}@${m.version}`,
        evidence,
        observedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + TRAVEL_TTL_DAYS * 86400000).toISOString(),
      };
    }
    // Khoảng cách tới mốc luôn tính được: dự phòng không hạ độ tin vì đây vốn là cách đo gốc của tiêu chí.
    const score = scoreOf(distance, m.fallback);
    return {
      id: definition.id,
      autoScore: score,
      verdict: verdictFor(definition, score),
      detail: `Cách ${definition.noun} ${formatDistance(distance)} (đường chim bay)`,
      status: 'fallback',
      confidence: definition.confidence,
      value: distance,
      unit: 'm',
      method: `${m.method}@${m.version}`,
      evidence,
      note: 'Chưa lấy được thời gian đi từ Vietmap, tạm tính theo khoảng cách.',
    };
  }
}

function versionsUsed(geo: GeoResults, theme: string, kind: ReleaseLayer['geometryKind']): string[] {
  return geo.layers.filter((layer) => layer.geometryKind === kind && layerTheme(layer.layerCode) === theme).map((layer) => layer.versionId);
}

/** Tiêu chí không đo được: điểm trung tính, không tính vào điểm tổng. */
export function unmeasured(definition: CriterionDefinition, status: 'no_data' | 'unavailable', note: string): CriterionMeasurement {
  return {
    id: definition.id,
    autoScore: NEUTRAL_SCORE,
    verdict: status === 'no_data' ? 'Chưa có dữ liệu' : 'Chưa đo được',
    detail: note,
    // Ghi chú trùng mô tả thì giao diện chỉ hiện một lần.
    status,
    confidence: 'low',
    value: null,
    method: `${definition.measure.method}@${definition.measure.version}`,
    note,
  };
}

function fromAir(definition: CriterionDefinition, air: Awaited<ReturnType<OpenAqClient['nearestPm25']>> | null): CriterionMeasurement {
  if (!air || air.kind === 'unavailable') return unmeasured(definition, 'unavailable', air?.reason ?? 'Chưa cấu hình nguồn không khí.');
  if (air.kind === 'none') return unmeasured(definition, 'no_data', 'Không có trạm quan trắc PM2.5 còn hoạt động trong 3 km.');
  const reading = air.reading;
  const scoring: Scoring = definition.scoring;
  const score = scoreOf(reading.pm25, scoring);
  const hours = (Date.now() - new Date(reading.observedAt).getTime()) / 3600000;
  return {
    id: definition.id,
    autoScore: score,
    verdict: reading.pm25 <= 25 ? 'Tốt' : reading.pm25 <= 50 ? 'Trung bình' : 'Kém',
    detail: `PM2.5 ${formatNumber(reading.pm25, 0)} µg/m³, trạm cách ${formatDistance(reading.distanceM)}`,
    status: 'ok',
    // Trạm xa hơn 1,5 km hoặc số đo cũ hơn 12 giờ: hạ độ tin.
    confidence: reading.distanceM > 1500 || hours > 12 ? lowerConfidence(definition.confidence) : definition.confidence,
    value: reading.pm25,
    unit: 'µg/m³',
    method: `${definition.measure.method}@${definition.measure.version}`,
    evidence: [{ name: reading.stationName, lat: reading.lat, lng: reading.lng, distanceM: reading.distanceM }],
    observedAt: reading.observedAt,
    expiresAt: new Date(Date.now() + AIR_TTL_HOURS * 3600000).toISOString(),
    note: definition.caveat,
  };
}
