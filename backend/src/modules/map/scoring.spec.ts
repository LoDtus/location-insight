import { describe, expect, it } from 'vitest';
import { CRITERIA, layerTheme, lowerConfidence } from './criteria.js';
import { parseMatrixMinutes } from './map.service.js';
import { parseLatest, parseStation } from './measure/openaq.client.js';
import { cellsWithin } from './measure/geo-measure.queries.js';
import { decayScore, linearDistanceWeight, median, peakScore, saturateScore, scoreOf } from './scoring.js';

describe('scoring', () => {
  it('decay: trọn điểm trong ngưỡng tốt, 0 từ ngưỡng xấu, mượt và đơn điệu ở giữa', () => {
    expect(decayScore(100, 300, 1200)).toBe(10);
    expect(decayScore(300, 300, 1200)).toBe(10);
    expect(decayScore(750, 300, 1200)).toBe(5);
    expect(decayScore(1200, 300, 1200)).toBe(0);
    expect(decayScore(5000, 300, 1200)).toBe(0);
    // Mượt ở ngưỡng: lệch 20 m quanh ngưỡng tốt gần như không đổi điểm (khác nội suy tuyến tính).
    expect(decayScore(320, 300, 1200)).toBeGreaterThanOrEqual(9.9);
    let previous = 11;
    for (let d = 300; d <= 1200; d += 50) {
      const score = decayScore(d, 300, 1200);
      expect(score).toBeLessThanOrEqual(previous);
      previous = score;
    }
  });

  it('decay chiều ngược: càng xa đường trục càng tốt', () => {
    expect(decayScore(40, 600, 80)).toBe(0);
    expect(decayScore(800, 600, 80)).toBe(10);
  });

  it('saturate: lợi ích giảm dần, half cho 5 điểm', () => {
    expect(saturateScore(0, 8)).toBe(0);
    expect(saturateScore(8, 8)).toBe(5);
    expect(saturateScore(16, 8)).toBe(7.5);
    expect(saturateScore(16, 8) - saturateScore(8, 8)).toBeLessThan(saturateScore(8, 8) - saturateScore(0, 8));
  });

  it('peak: tốt nhất ở optimum, còn 5 khi lệch tolerance', () => {
    expect(peakScore(15000, 15000, 9000)).toBe(10);
    expect(peakScore(24000, 15000, 9000)).toBe(5);
    expect(peakScore(6000, 15000, 9000)).toBe(5);
  });

  it('trừ hao khoảng cách, trung vị, số ô trong bán kính', () => {
    expect(linearDistanceWeight(0, 500)).toBe(1);
    expect(linearDistanceWeight(250, 500)).toBe(0.5);
    expect(linearDistanceWeight(600, 500)).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(cellsWithin(0)).toBe(1);
    expect(cellsWithin(500)).toBe(81);
  });

  it('mọi tiêu chí đo thật có ngưỡng chấm hợp lệ', () => {
    for (const definition of CRITERIA.filter((item) => item.status === 'live')) {
      const s = definition.scoring;
      if (s.curve === 'decay') expect(s.good).not.toBe(s.bad);
      if (s.curve === 'saturate') expect(s.half).toBeGreaterThan(0);
      if (s.curve === 'peak') expect(s.tolerance).toBeGreaterThan(0);
      expect(scoreOf(0, s)).toBeGreaterThanOrEqual(0);
    }
  });

  it('chủ đề lớp và hạ độ tin', () => {
    expect(layerTheme('osm.places')).toBe('places');
    expect(layerTheme('worldpop.pop_100m')).toBe('pop_100m');
    expect(lowerConfidence('high')).toBe('medium');
    expect(lowerConfidence('low')).toBe('low');
  });
});

describe('phản hồi nguồn ngoài', () => {
  it('Vietmap Matrix v4: giây → phút, đích không tới được là null, phản hồi lỗi thì ném', () => {
    expect(parseMatrixMinutes({ code: 'OK', durations: [[600, null, 95]] }, 3)).toEqual([10, null, 1.6]);
    expect(() => parseMatrixMinutes({ code: 'OVER_DAILY_LIMIT', durations: null }, 1)).toThrow();
    expect(() => parseMatrixMinutes('x', 1)).toThrow();
  });

  it('OpenAQ v3: trạm có cảm biến pm25 và giá trị mới nhất của đúng cảm biến đó', () => {
    const station = parseStation({
      id: 7,
      name: 'Hà Nội - Trạm A',
      coordinates: { latitude: 21.03, longitude: 105.84 },
      sensors: [
        { id: 70, parameter: { id: 2, name: 'pm25' } },
        { id: 71, parameter: { id: 1, name: 'pm10' } },
      ],
      datetimeLast: { utc: '2026-11-09T01:00:00Z' },
    });
    expect(station?.sensorIds).toEqual(new Set([70]));
    expect(parseStation({ id: 8, coordinates: { latitude: 21, longitude: 105 }, sensors: [{ id: 80, parameter: { id: 1, name: 'pm10' } }] })).toBeNull();
    expect(parseStation({ id: 'x' })).toBeNull();
    const latest = parseLatest(
      {
        results: [
          { sensorsId: 71, value: 90, datetime: { utc: '2026-11-09T02:00:00Z' } },
          { sensorsId: 70, value: 41.5, datetime: { utc: '2026-11-09T01:00:00Z' } },
          { sensorsId: 70, value: -1, datetime: { utc: '2026-11-09T03:00:00Z' } },
        ],
      },
      new Set([70]),
    );
    expect(latest).toEqual({ value: 41.5, utc: '2026-11-09T01:00:00Z' });
  });
});
