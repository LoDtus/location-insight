/**
 * Định nghĩa tiêu chí đánh giá địa điểm (018-location-data, research.md Bản ghi 9, 10, 14 và 15).
 *
 * Mỗi tiêu chí khai:
 * - `method@version`: cách đo. Đổi kết quả của một method thì tăng `version` (BR-10).
 * - `input`: lớp dữ liệu theo **chủ đề** (phần sau dấu chấm của mã lớp: `osm.places` → `places`), nên mọi nguồn cùng
 *   chủ đề trong bản phát hành đều được đọc (chợ đọc `osm.places` và `qhtd.places`), không ghim mã nguồn trong code.
 * - `scoring`: cách quy số đo ra điểm 0–10 (scoring.ts).
 * - `confidence`: độ tin gốc; hạ một bậc khi đo dự phòng hoặc thiếu đối tượng (Bản ghi 14).
 * - `status`: `live` là đo thật; `not_implemented` là tiêu chí cần AI, chưa làm: trả số minh họa và không tính điểm.
 *
 * Định nghĩa được chụp vào `criteria_snapshot` khi phát hành (criteria-snapshot.ts), nên sửa ở đây là một bản phát
 * hành `kind = criteria`.
 */

export const CRITERION_GROUPS = {
  walk: 'Tiện ích đi bộ 500 m',
  move: 'Đi lại và đường',
  health: 'Y tế',
  env: 'Dân cư, môi trường, địa hình',
  ai: 'Tổng hợp từ tin tức và văn bản (AI)',
} as const;
export type CriterionGroup = keyof typeof CRITERION_GROUPS;

/** Mốc nội đô theo tiêu chí: Hồ Gươm. */
export const INNER_CITY_ANCHOR = { lat: 21.0285, lng: 105.852 } as const;

export type Confidence = 'high' | 'medium' | 'low';

/** Quy số đo ra điểm. Xem scoring.ts. */
export type Scoring =
  /** Giảm mượt từ 10 (tại `good`) về 0 (tại `bad`); `good` > `bad` nghĩa là càng lớn càng tốt. */
  | { curve: 'decay'; good: number; bad: number }
  /** Tăng dần và bão hòa: `half` đối tượng (đã trừ hao theo khoảng cách) cho 5 điểm. */
  | { curve: 'saturate'; half: number }
  /** Tốt nhất ở `optimum`, còn 5 điểm khi lệch `tolerance`. */
  | { curve: 'peak'; optimum: number; tolerance: number };

/** Điều kiện chặn: số đo vượt `atLeast` thì điểm tổng không quá `cap` (Bản ghi 14). */
export interface BlockingRule {
  atLeast: number;
  cap: number;
  message: string;
}

/**
 * Dẫn chứng hiện trên bản đồ của tiêu chí điểm (không ảnh hưởng điểm số): lấy `take` chỗ gần nhất, hoặc theo
 * nhóm (trường: mầm non / phổ thông). `minutes`: lấy thêm số phút đi xe máy (một lượt Vietmap Matrix chung).
 */
export interface EvidenceSpec {
  take: number;
  groups?: ReadonlyArray<{ label: string; kinds: readonly string[]; take: number }>;
  minutes?: boolean;
}

export type CriterionMethod =
  /** Đối tượng điểm gần nhất (đường chim bay) và số đối tượng trong `supportM` để tính độ tin. */
  | {
      method: 'nearest';
      version: 1;
      theme: string;
      categories: readonly string[];
      kinds?: readonly string[];
      searchM: number;
      supportM: number;
      minSupport: number;
      evidence?: EvidenceSpec;
    }
  /** Như `nearest` nhưng chấm theo thời gian đi thật (Vietmap Matrix) tới `candidates` điểm gần nhất. */
  | {
      method: 'travel_time';
      version: 1;
      theme: string;
      categories: readonly string[];
      kinds?: readonly string[];
      searchM: number;
      supportM: number;
      minSupport: number;
      candidates: number;
      vehicle: 'motorcycle' | 'car';
      /** Chấm khi Vietmap không dùng được: theo khoảng cách. */
      fallback: Scoring;
    }
  /** Đếm đối tượng trong bán kính, trừ hao tuyến tính theo khoảng cách (như decay 'linear' của pandana). */
  | { method: 'count'; version: 1; theme: string; categories: readonly string[]; radiusM: number }
  /**
   * Đường gần nhất thuộc các cấp đường. Dẫn chứng: hình dạng đường trong `clipM` quanh địa điểm (chỉ đường gần
   * nhất, hoặc mọi đường khi `allWithin`), và vùng đệm `zonesM` quanh các đường đó (vùng ồn).
   */
  | {
      method: 'line_nearest';
      version: 1;
      theme: string;
      roadClasses: readonly string[];
      searchM: number;
      clipM: number;
      allWithin?: boolean;
      zonesM?: readonly number[];
    }
  /** Mốc cố định: thời gian đi (Vietmap) nếu có, không thì khoảng cách. */
  | { method: 'anchor'; version: 1; anchor: { lat: number; lng: number }; vehicle: 'motorcycle'; fallback: Scoring }
  /** Lưới: tổng, trung bình các ô trong bán kính, giá trị ô chứa điểm, hoặc chênh ô chứa điểm so với trung vị. */
  | { method: 'grid_sum' | 'grid_mean' | 'grid_relative'; version: 1; theme: string; radiusM: number }
  /** Giá trị ô chứa điểm; dẫn chứng thêm các ô trong `evidenceRadiusM` để thấy vệt quanh địa điểm. */
  | { method: 'grid_cell'; version: 1; theme: string; evidenceRadiusM: number }
  /** Trạm quan trắc gần nhất (OpenAQ), bỏ nếu xa hơn `maxStationM`. */
  | { method: 'air_station'; version: 1; parameter: 'pm25'; maxStationM: number; maxAgeHours: number; stations: number }
  /** Cần AI (GĐ3): chưa thực hiện. */
  | { method: 'ai_pending'; version: 0 };

export interface CriterionDefinition {
  id: string;
  label: string;
  group: CriterionGroup;
  status: 'live' | 'not_implemented';
  /** Nguồn hiển thị cho người dùng. */
  source: string;
  /** Danh từ dùng trong câu mô tả: "Cách {noun} gần nhất…". */
  noun: string;
  measure: CriterionMethod;
  scoring: Scoring;
  confidence: Confidence;
  blocking?: BlockingRule;
  /** Giới hạn đã biết, hiện kèm kết quả. */
  caveat?: string;
}

const OSM = 'OpenStreetMap';
const PLACES = 'places';

function near(
  id: string,
  label: string,
  noun: string,
  categories: string[],
  good: number,
  bad: number,
  confidence: Confidence,
  extra: { searchM?: number; kinds?: string[]; caveat?: string; group?: CriterionGroup; evidence?: EvidenceSpec } = {},
): CriterionDefinition {
  const searchM = extra.searchM ?? Math.max(bad * 1.5, 1000);
  return {
    id,
    label,
    group: extra.group ?? 'walk',
    status: 'live',
    source: OSM,
    noun,
    measure: { method: 'nearest', version: 1, theme: PLACES, categories, kinds: extra.kinds, searchM, supportM: bad, minSupport: 1, evidence: extra.evidence },
    scoring: { curve: 'decay', good, bad },
    confidence,
    caveat: extra.caveat,
  };
}

function aiPending(id: string, label: string, noun: string, caveat: string): CriterionDefinition {
  return {
    id,
    label,
    group: 'ai',
    status: 'not_implemented',
    source: 'Chưa thực hiện (cần AI đọc tin tức, văn bản)',
    noun,
    measure: { method: 'ai_pending', version: 0 },
    scoring: { curve: 'decay', good: 0, bad: 10 },
    confidence: 'low',
    caveat,
  };
}

/**
 * Ngưỡng `good`/`bad` (mét) theo khoảng đi bộ: 5 phút ≈ 400 m đạt gần trọn điểm, quá 15–20 phút ≈ 1,2–1,6 km về 0,
 * giống cách Walk Score cho trọn điểm trong 5 phút đi bộ rồi giảm dần.
 */
export const CRITERIA: readonly CriterionDefinition[] = [
  // Dẫn chứng: chợ, siêu thị 3 lựa chọn (chợ cóc thiếu, thương hiệu quyết định); hiệu thuốc 3 nhưng không cần số
  // phút (gần, dày); UBND và vật tư 1 (mỗi nơi một UBND, vật tư quá thưa).
  near('cho', 'Chợ', 'chợ', ['market'], 300, 1200, 'medium', { caveat: 'Chợ cóc thường không có trên bản đồ.', evidence: { take: 3, minutes: true } }),
  near('hieu-thuoc', 'Hiệu thuốc', 'hiệu thuốc', ['pharmacy'], 200, 900, 'high', { evidence: { take: 3 } }),
  near('sieu-thi', 'Siêu thị', 'siêu thị', ['supermarket'], 300, 1500, 'medium', { evidence: { take: 3, minutes: true } }),
  near('ubnd', 'UBND', 'UBND', ['townhall'], 400, 2000, 'medium', { caveat: 'Bản đồ không đủ trụ sở UBND phường.', evidence: { take: 1, minutes: true } }),
  near('vat-tu', 'Cửa hàng vật tư', 'cửa hàng vật tư', ['hardware'], 400, 2000, 'low', {
    caveat: 'Rất thưa trên bản đồ mở: chỉ để tham khảo, không tính vào điểm tổng.',
    evidence: { take: 1 },
  }),
  {
    id: 'quan-an',
    label: 'Quán ăn, cà phê',
    group: 'walk',
    status: 'live',
    source: OSM,
    noun: 'quán',
    measure: { method: 'count', version: 1, theme: PLACES, categories: ['food'], radiusM: 500 },
    // 8 quán (đã trừ hao theo khoảng cách) cho 5 điểm, giống "độ sâu lựa chọn" quán ăn của Walk Score.
    scoring: { curve: 'saturate', half: 8 },
    confidence: 'medium',
    caveat: 'Không tách được quán ăn sáng, quán vỉa hè.',
  },
  near('cong-vien', 'Công viên', 'công viên', ['park'], 300, 1500, 'high', { evidence: { take: 2, minutes: true } }),
  // Chọn trường theo cấp học: dẫn chứng là mầm non gần nhất và 2 trường phổ thông gần nhất.
  near('truong-hoc', 'Trường học', 'trường', ['school'], 300, 1200, 'high', {
    evidence: {
      take: 3,
      minutes: true,
      groups: [
        { label: 'Mầm non', kinds: ['kindergarten'], take: 1 },
        { label: 'Phổ thông', kinds: ['school'], take: 2 },
      ],
    },
  }),
  {
    id: 'duong-lon',
    label: 'Đường lớn',
    group: 'move',
    status: 'live',
    source: OSM,
    noun: 'đường lớn',
    measure: { method: 'line_nearest', version: 1, theme: 'roads', roadClasses: ['motorway', 'trunk', 'primary', 'secondary'], searchM: 3000, clipM: 600 },
    scoring: { curve: 'decay', good: 150, bad: 900 },
    confidence: 'high',
  },
  {
    id: 'noi-do',
    label: 'Nội đô',
    group: 'move',
    status: 'live',
    source: 'Mốc Hồ Gươm, thời gian đi: Vietmap',
    noun: 'Hồ Gươm',
    measure: { method: 'anchor', version: 1, anchor: INNER_CITY_ANCHOR, vehicle: 'motorcycle', fallback: { curve: 'decay', good: 3000, bad: 20000 } },
    // Phút đi xe máy.
    scoring: { curve: 'decay', good: 12, bad: 45 },
    confidence: 'high',
  },
  near('metro', 'Ga metro', 'ga metro', ['metro'], 600, 2000, 'medium', {
    searchM: 6000,
    group: 'move',
    caveat: 'Mạng metro còn thưa.',
    evidence: { take: 2, minutes: true },
  }),
  near('xe-buyt', 'Điểm xe buýt', 'điểm dừng', ['bus'], 150, 500, 'high', { searchM: 1500, group: 'move', evidence: { take: 3 } }),
  {
    id: 'on-giao-thong',
    label: 'Ồn giao thông',
    group: 'move',
    status: 'live',
    source: OSM,
    noun: 'đường trục',
    measure: { method: 'line_nearest', version: 1, theme: 'roads', roadClasses: ['motorway', 'trunk'], searchM: 3000, clipM: 600, allWithin: true, zonesM: [80, 300] },
    // Càng xa đường trục càng yên tĩnh.
    scoring: { curve: 'decay', good: 600, bad: 80 },
    confidence: 'medium',
    caveat: 'Chỉ là khoảng cách tới đường trục, không phải bản đồ tiếng ồn.',
  },
  {
    id: 'benh-vien',
    label: 'Bệnh viện',
    group: 'health',
    status: 'live',
    source: 'OpenStreetMap, thời gian đi: Vietmap',
    noun: 'bệnh viện',
    measure: {
      method: 'travel_time',
      version: 1,
      theme: PLACES,
      categories: ['hospital'],
      kinds: ['hospital'],
      searchM: 8000,
      supportM: 4000,
      minSupport: 1,
      candidates: 3,
      vehicle: 'motorcycle',
      fallback: { curve: 'decay', good: 800, bad: 4000 },
    },
    // Phút đi xe máy.
    scoring: { curve: 'decay', good: 8, bad: 25 },
    confidence: 'high',
  },
  // Trạm y tế, phòng khám, nhà hộ sinh, nha khoa (OSM gắn lẫn với bệnh viện; tách theo tên ở tools/data/health_kinds.py).
  near('co-so-y-te', 'Cơ sở y tế', 'cơ sở y tế', ['hospital'], 300, 1500, 'medium', {
    kinds: ['clinic'],
    group: 'health',
    caveat: 'Trạm y tế, phòng khám, nhà hộ sinh; không gồm bệnh viện.',
    evidence: { take: 3, minutes: true },
  }),
  {
    id: 'mat-do-dan-cu',
    label: 'Mật độ dân cư',
    group: 'env',
    status: 'live',
    source: 'WorldPop 100 m',
    noun: 'người',
    measure: { method: 'grid_sum', version: 1, theme: 'pop_100m', radiusM: 500 },
    // Đông vừa phải là tốt nhất: quá thưa thì thiếu dịch vụ, quá đông thì chật.
    scoring: { curve: 'peak', optimum: 15000, tolerance: 9000 },
    confidence: 'medium',
    caveat: 'Ước tính theo ô 100 m, không phải mật độ từng ngõ.',
  },
  {
    id: 'khong-khi',
    label: 'Không khí',
    group: 'env',
    status: 'live',
    source: 'OpenAQ',
    noun: 'trạm quan trắc',
    measure: { method: 'air_station', version: 1, parameter: 'pm25', maxStationM: 3000, maxAgeHours: 48, stations: 2 },
    // PM2.5 µg/m³: 15 là hướng dẫn 24 giờ của WHO (2021); 75 gấp 1,5 lần ngưỡng 24 giờ QCVN 05:2023.
    scoring: { curve: 'decay', good: 15, bad: 75 },
    confidence: 'medium',
    caveat: 'Số đo của trạm gần nhất tại một thời điểm, không phải trung bình năm.',
  },
  {
    id: 'do-cao',
    label: 'Độ cao tương đối',
    group: 'env',
    status: 'live',
    source: 'FABDEM',
    noun: 'trung vị 500 m',
    measure: { method: 'grid_relative', version: 1, theme: 'elev_100m', radiusM: 500 },
    scoring: { curve: 'decay', good: 2, bad: -2 },
    confidence: 'medium',
    caveat: 'Cao độ mặt đất 2021, không tính công trình mới.',
  },
  {
    id: 'ngap-song',
    label: 'Ngập sông (mô hình)',
    group: 'env',
    status: 'live',
    source: 'JRC Global River Flood Hazard',
    noun: 'vệt ngập',
    measure: { method: 'grid_cell', version: 1, theme: 'flood_rp100', evidenceRadiusM: 300 },
    // Độ sâu (m) ở chu kỳ 100 năm.
    scoring: { curve: 'decay', good: 0, bad: 1.5 },
    confidence: 'high',
    blocking: { atLeast: 1, cap: 4, message: 'Nằm trong vệt ngập sông mô hình sâu từ 1 m ở chu kỳ 100 năm.' },
    caveat: 'Ngập sông lớn theo mô hình toàn cầu, không phải ngập đường sau mưa.',
  },
  {
    id: 'mang-xanh',
    label: 'Mảng xanh',
    group: 'env',
    status: 'live',
    source: 'ESA WorldCover',
    noun: 'diện tích có thực vật',
    measure: { method: 'grid_mean', version: 1, theme: 'green_100m', radiusM: 300 },
    // Phần trăm diện tích có cây, cỏ, đất ngập nước trong 300 m.
    scoring: { curve: 'decay', good: 35, bad: 5 },
    confidence: 'medium',
  },
  aiPending('ngap-ung', 'Ngập úng sau mưa', 'điểm ngập', 'Cần AI tổng hợp tin ngập, thông báo thoát nước theo tuyến đường.'),
  aiPending('quy-hoach', 'Quy hoạch, dự án lân cận', 'dự án', 'Cần AI đọc quyết định quy hoạch, dự án hạ tầng gần địa điểm.'),
  aiPending('an-ninh', 'An ninh trật tự', 'vụ việc', 'Cần AI tổng hợp tin vụ việc; chỉ để tham khảo, không dùng làm nhãn khu vực.'),
];

export const CRITERION_IDS: ReadonlySet<string> = new Set(CRITERIA.map((item) => item.id));

/** Thang trọng số (mức quan trọng) của một tiêu chí: 0 = không tính vào điểm tổng, 5 = quan trọng nhất. */
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 5;

/**
 * Trọng số mặc định của ứng dụng. Cao cho thứ khó thay đổi và ảnh hưởng sức khỏe/an toàn hằng ngày (bệnh viện,
 * không khí, ngập, ồn, trường học); thấp cho thứ dễ thay thế hoặc dữ liệu còn mỏng (UBND, vật tư, quán ăn).
 */
export const DEFAULT_WEIGHTS: Readonly<Record<string, number>> = {
  cho: 2,
  'hieu-thuoc': 2,
  'sieu-thi': 2,
  ubnd: 1,
  'vat-tu': 1,
  'quan-an': 1,
  'cong-vien': 2,
  'truong-hoc': 3,
  'duong-lon': 2,
  'noi-do': 2,
  metro: 2,
  'xe-buyt': 2,
  'on-giao-thong': 3,
  'benh-vien': 3,
  'co-so-y-te': 2,
  'mat-do-dan-cu': 1,
  'khong-khi': 3,
  'do-cao': 2,
  'ngap-song': 3,
  'mang-xanh': 2,
  'ngap-ung': 3,
  'quy-hoach': 2,
  'an-ninh': 2,
};

/** Trọng số hợp lệ: số nguyên trong [0, 5]. */
export function isValidWeight(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= WEIGHT_MIN && value <= WEIGHT_MAX;
}

/** Chủ đề của mã lớp: `osm.places` → `places`. */
export function layerTheme(layerCode: string): string {
  const dot = layerCode.indexOf('.');
  return dot < 0 ? '' : layerCode.slice(dot + 1);
}

const CONFIDENCE_ORDER: readonly Confidence[] = ['low', 'medium', 'high'];

/** Hạ độ tin `steps` bậc, không thấp hơn `low`. */
export function lowerConfidence(value: Confidence, steps = 1): Confidence {
  return CONFIDENCE_ORDER[Math.max(0, CONFIDENCE_ORDER.indexOf(value) - steps)];
}
