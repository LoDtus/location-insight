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
  type LineRequest,
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
/** Số đối tượng tối đa trả về làm dẫn chứng cho tiêu chí đếm (vẽ trên bản đồ). */
const COUNT_EVIDENCE_MAX = 40;

/** Ngưỡng đạt trọn điểm (mét) của tiêu chí chấm theo khoảng cách: vẽ thành vòng tròn trên bản đồ. */
function goodRing(scoring: Scoring): number | undefined {
  return scoring.curve === 'decay' && scoring.good > 0 ? scoring.good : undefined;
}

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
    return measurements.map((item) => withLayerSource(item, geo.layers));
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
      const lineRequests: LineRequest[] = [];
      const gridRequests: Array<{ id: string; versions: string[]; radiusM: number }> = [];
      for (const definition of CRITERIA) {
        const m = definition.measure;
        if (m.method === 'nearest' || m.method === 'travel_time') {
          const versions = versionsOf(m.theme, 'point');
          if (versions.length === 0) continue;
          const evidence = m.method === 'nearest' ? m.evidence : undefined;
          const take = m.method === 'travel_time' ? m.candidates : evidence && !evidence.groups ? Math.max(1, evidence.take) : 1;
          pointRequests.push({ id: definition.id, versions, categories: [...m.categories], kinds: m.kinds ? [...m.kinds] : null, searchM: m.searchM, take, countM: m.supportM });
          // Dẫn chứng theo nhóm (trường: mầm non / phổ thông): mỗi nhóm một yêu cầu riêng, cùng câu SQL.
          evidence?.groups?.forEach((group, index) => {
            pointRequests.push({ id: groupRequestId(definition.id, index), versions, categories: [...m.categories], kinds: [...group.kinds], searchM: m.searchM, take: group.take, countM: 1 });
          });
        } else if (m.method === 'count') {
          const versions = versionsOf(m.theme, 'point');
          if (versions.length > 0) pointRequests.push({ id: definition.id, versions, categories: [...m.categories], kinds: null, searchM: m.radiusM, take: COUNT_EVIDENCE_MAX, countM: m.radiusM });
        } else if (m.method === 'line_nearest') {
          const versions = versionsOf(m.theme, 'line');
          if (versions.length > 0) {
            lineRequests.push({
              id: definition.id,
              versions,
              roadClasses: [...m.roadClasses],
              searchM: m.searchM,
              clipM: m.clipM,
              allWithin: m.allWithin === true,
              zonesM: [...(m.zonesM ?? [])],
            });
          }
        } else if (m.method === 'grid_sum' || m.method === 'grid_mean' || m.method === 'grid_relative' || m.method === 'grid_cell') {
          const versions = versionsOf(m.theme, 'grid');
          if (versions.length > 0) gridRequests.push({ id: definition.id, versions: versions.slice(0, 1), radiusM: m.method === 'grid_cell' ? m.evidenceRadiusM : m.radiusM });
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

  /**
   * Thời gian đi xe máy (Vietmap Matrix), hai lượt chạy song song:
   * - lượt chấm điểm: ứng viên bệnh viện + mốc Hồ Gươm; lỗi thì các tiêu chí này đo dự phòng theo khoảng cách;
   * - lượt dẫn chứng: các lựa chọn của tiêu chí điểm có `evidence.minutes`; lỗi thì chỉ thiếu nhãn số phút.
   * Tách hai lượt để một lượt dẫn chứng nhiều điểm (có thể vượt giới hạn gói) không làm hỏng điểm số.
   */
  private async measureTravel(origin: Point, geo: GeoResults): Promise<TravelResults> {
    const scoring: Array<{ id: string; points: Point[] }> = [];
    const info: Array<{ id: string; points: Point[] }> = [];
    const located = (id: string): Point[] =>
      (geo.points.get(id) ?? []).filter((row) => row.lat !== null && row.lng !== null).map((row) => ({ lat: row.lat as number, lng: row.lng as number }));
    for (const definition of CRITERIA) {
      const m = definition.measure;
      if (m.method === 'travel_time') {
        const points = located(definition.id);
        if (points.length > 0) scoring.push({ id: definition.id, points });
      } else if (m.method === 'anchor') {
        scoring.push({ id: definition.id, points: [m.anchor] });
      } else if (m.method === 'nearest' && m.evidence?.minutes) {
        const ids = m.evidence.groups ? m.evidence.groups.map((_, index) => groupRequestId(definition.id, index)) : [definition.id];
        for (const id of ids) {
          const points = located(id);
          if (points.length > 0) info.push({ id, points });
        }
      }
    }
    const result: TravelResults = { minutes: new Map(), failed: false };
    const call = async (targets: Array<{ id: string; points: Point[] }>): Promise<void> => {
      if (targets.length === 0) return;
      const minutes = await this.maps.travelMinutes(origin, targets.flatMap((target) => target.points), 'motorcycle');
      let offset = 0;
      for (const target of targets) {
        result.minutes.set(target.id, minutes.slice(offset, offset + target.points.length));
        offset += target.points.length;
      }
    };
    const [scored, informed] = await Promise.allSettled([call(scoring), call(info)]);
    if (scored.status === 'rejected') {
      this.logger.warn(`Vietmap Matrix không dùng được, đo dự phòng theo khoảng cách: ${errorText(scored.reason)}`);
      result.failed = true;
    }
    if (informed.status === 'rejected') this.logger.warn(`Không lấy được số phút cho dẫn chứng: ${errorText(informed.reason)}`);
    return result;
  }

  private async measureAir(origin: Point): Promise<Awaited<ReturnType<OpenAqClient['nearestPm25']>> | null> {
    const definition = CRITERIA.find((item) => item.measure.method === 'air_station');
    if (!definition || definition.measure.method !== 'air_station') return null;
    return this.air.nearestPm25(origin.lat, origin.lng, definition.measure.maxStationM, definition.measure.maxAgeHours, definition.measure.stations);
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
      const points = rows.filter((row) => row.distance_m !== null && row.lat !== null && row.lng !== null);
      return {
        radiusM: m.radiusM,
        evidence: points.map((row) => ({ name: row.name || definition.noun, lat: row.lat as number, lng: row.lng as number, distanceM: Math.round(row.distance_m as number) })),
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
      evidence: nearestEvidence(definition, m, geo, travel, evidence),
      radiusM: goodRing(definition.scoring),
      status: 'ok',
      confidence,
      value: distance,
      unit: 'm',
      method,
      layerVersions: versions,
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
          radiusM: goodRing(definition.scoring),
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
      radiusM: goodRing(definition.scoring),
      paths: row.paths,
      zones: row.zones,
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
    // Ngập sông: điểm theo ô chứa địa điểm, dẫn chứng gồm các ô trong evidenceRadiusM.
    const radiusM = m.method === 'grid_cell' ? m.evidenceRadiusM : m.radiusM;
    const expected = cellsWithin(radiusM);
    // Thiếu nhiều ô (ngoài vùng phủ) thì hạ độ tin.
    const confidence = values.length < expected * 0.7 ? lowerConfidence(definition.confidence) : definition.confidence;
    const cells = values.length > 0 ? rows.filter((row) => row.value !== null).map((row) => ({ lat: round6(row.lat), lng: round6(row.lng), value: row.value as number })) : [];
    const base = {
      id: definition.id,
      status: 'ok' as const,
      confidence,
      method: `${m.method}@${m.version}`,
      layerVersions: versions,
      note: definition.caveat,
      cells,
      cellM: rows[0]?.cell_m ?? 100,
      radiusM,
    };

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
  const [reading, ...others] = air.readings;
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
    // Trạm thứ hai (nếu có) để thấy hai trạm có lệch nhau không; điểm chấm theo trạm gần nhất.
    evidence: [reading, ...others].map((item) => ({
      name: item.stationName,
      lat: item.lat,
      lng: item.lng,
      distanceM: item.distanceM,
      value: item.pm25,
      observedAt: item.observedAt,
    })),
    radiusM: definition.measure.method === 'air_station' ? definition.measure.maxStationM : undefined,
    observedAt: reading.observedAt,
    expiresAt: new Date(Date.now() + AIR_TTL_HOURS * 3600000).toISOString(),
    note: definition.caveat,
  };
}

function round6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/**
 * "Nguồn" của tiêu chí theo lớp thực sự đã đọc (ghi công của lớp), không theo tên cố định trong code: lớp demo hay
 * nguồn thay thế hiện đúng tên của nó. Thời gian đi lấy từ Vietmap thì ghi thêm.
 */
export function withLayerSource(item: CriterionMeasurement, layers: readonly ReleaseLayer[]): CriterionMeasurement {
  const used = layers.filter((layer) => item.layerVersions?.includes(layer.versionId));
  const names = [...new Set(used.map((layer) => layer.attribution.trim() || layer.layerCode))];
  if (names.length === 0) return item;
  const travel = item.unit === 'phút' ? ', thời gian đi: Vietmap' : '';
  return { ...item, source: `${names.join('; ')}${travel}` };
}

/** Mã yêu cầu SQL của nhóm dẫn chứng thứ `index` (trường: mầm non / phổ thông). */
function groupRequestId(criterionId: string, index: number): string {
  return `${criterionId}#${index}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Dẫn chứng của tiêu chí điểm: theo nhóm (mỗi nhóm `take` chỗ, gắn nhãn nhóm) hoặc `take` chỗ gần nhất; kèm số
 * phút xe máy nếu lượt Matrix dẫn chứng thành công. Sắp theo khoảng cách để đánh số ①②③ trên bản đồ.
 */
function nearestEvidence(
  definition: CriterionDefinition,
  m: Extract<CriterionMethod, { method: 'nearest' | 'travel_time' | 'count' }>,
  geo: GeoResults,
  travel: TravelResults,
  fallback: MeasurementEvidence[],
): MeasurementEvidence[] {
  if (m.method !== 'nearest') return fallback;
  const fromRows = (requestId: string, group?: string): MeasurementEvidence[] => {
    const minutes = travel.minutes.get(requestId) ?? [];
    return (geo.points.get(requestId) ?? [])
      .filter((row) => row.distance_m !== null && row.lat !== null && row.lng !== null)
      .map((row, index) => ({
        // Đối tượng không có tên trên bản đồ: ghi rõ để không lẫn với tên thật.
        name: row.name || `${definition.noun} chưa có tên`,
        lat: row.lat as number,
        lng: row.lng as number,
        distanceM: Math.round(row.distance_m as number),
        ...(minutes[index] !== null && minutes[index] !== undefined ? { minutes: minutes[index] as number } : {}),
        ...(group ? { group } : {}),
      }));
  };
  const spec = m.evidence;
  if (!spec) return fallback.slice(0, 1);
  const items = spec.groups
    ? spec.groups.flatMap((group, index) => fromRows(groupRequestId(definition.id, index), group.label))
    : fromRows(definition.id).slice(0, spec.take);
  return items.length > 0 ? items.sort((a, b) => a.distanceM - b.distanceM) : fallback.slice(0, 1);
}
