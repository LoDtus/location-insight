import contractsJson from './package-contracts.json' with { type: 'json' };

/**
 * Khuôn gói dữ liệu chuẩn (018-location-data, package-contracts.md). Giá trị nằm trong package-contracts.json để
 * tools/data/package_tool.py đọc cùng một nguồn; file này chỉ gán kiểu và kiểm manifest.
 */

export type GeometryKind = 'point' | 'line' | 'area' | 'grid';
export type ContractId = 'point@1' | 'line@1' | 'area@1' | 'grid@1';
export type LayerUsage = 'public' | 'internal' | 'blocked';

export const GEOMETRY_KINDS: readonly GeometryKind[] = ['point', 'line', 'area', 'grid'];
export const CONTRACT_IDS: readonly ContractId[] = ['point@1', 'line@1', 'area@1', 'grid@1'];
export const LAYER_USAGES: readonly LayerUsage[] = ['public', 'internal', 'blocked'];

export interface ContractSpec {
  geometryKind: GeometryKind;
  dataFile: 'data.csv' | 'data.geojsonl.gz';
  crs: readonly string[];
  columns?: readonly string[];
  requiredColumns?: readonly string[];
  geometryTypes?: readonly string[];
  properties?: readonly string[];
  requiredProperties?: readonly string[];
}

export const PACKAGE_LIMITS = contractsJson.limits;
export const PACKAGE_BBOX = contractsJson.bbox;
export const ROAD_CLASSES: readonly string[] = contractsJson.roadClasses;
export const ROW_COUNT_DELTA = contractsJson.checks;

export const PACKAGE_PATTERNS = {
  layerCode: new RegExp(contractsJson.patterns.layerCode),
  sourceCode: new RegExp(contractsJson.patterns.sourceCode),
  label: new RegExp(contractsJson.patterns.label),
  category: new RegExp(contractsJson.patterns.category),
  featureKey: new RegExp(contractsJson.patterns.featureKey),
  sha256: new RegExp(contractsJson.patterns.sha256),
  gitCommit: new RegExp(contractsJson.patterns.gitCommit),
  date: new RegExp(contractsJson.patterns.date),
} as const;

/** Chuỗi regex gốc, dùng cho decorator `@Matches` của DTO. */
export const LAYER_CODE_PATTERN = contractsJson.patterns.layerCode;
export const SOURCE_CODE_PATTERN = contractsJson.patterns.sourceCode;

export const CONTRACTS: Readonly<Record<ContractId, ContractSpec>> = {
  'point@1': contractsJson.contracts['point@1'] as ContractSpec,
  'line@1': contractsJson.contracts['line@1'] as ContractSpec,
  'area@1': contractsJson.contracts['area@1'] as ContractSpec,
  'grid@1': contractsJson.contracts['grid@1'] as ContractSpec,
};

/** Các tên file được phép trong zip, ngoài file dữ liệu của khuôn. */
export const MANIFEST_FILE = 'manifest.json';
export const COVERAGE_FILE = 'coverage.geojson';

export function isContractId(value: unknown): value is ContractId {
  return typeof value === 'string' && (CONTRACT_IDS as readonly string[]).includes(value);
}

export interface ManifestSource {
  catalog: string;
  url: string;
  sha256: string;
  license: string;
}

export interface ManifestPipeline {
  tool: string;
  commit: string;
  dirty: boolean;
}

export type ManifestParamValue = string | number | boolean;

export interface PackageManifest {
  contract: ContractId;
  layer: string;
  label: string;
  sourceDate: string | null;
  crs: string;
  sources: ManifestSource[];
  pipeline: ManifestPipeline;
  manualSteps: string[];
  rowCount: number;
  categories: Record<string, number>;
  dataSha256: string;
  gridCode: string | null;
  params: Record<string, ManifestParamValue>;
  notes: string;
}

export type ManifestResult = { ok: true; manifest: PackageManifest } | { ok: false; errors: string[] };

const TEXT_MAX = 500;
const SOURCES_MAX = 20;
const MANUAL_STEPS_MAX = 50;
const CATEGORIES_MAX = 200;
const PARAMS_MAX = 20;

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean.length <= max ? clean : null;
}

/** Kiểm manifest theo khuôn. Gom mọi lỗi để admin sửa một lần. Không tin bất cứ trường nào. */
export function parseManifest(raw: unknown): ManifestResult {
  const errors: string[] = [];
  if (!isObject(raw)) return { ok: false, errors: ['manifest.json phải là một object JSON.'] };

  const contract = raw.contract;
  if (!isContractId(contract)) errors.push(`contract phải là một trong ${CONTRACT_IDS.join(', ')}.`);
  const spec = isContractId(contract) ? CONTRACTS[contract] : null;

  const layer = readText(raw.layer, 60);
  if (!layer || !PACKAGE_PATTERNS.layerCode.test(layer)) errors.push('layer không đúng dạng nguồn.chủ_đề (ví dụ osm.places).');

  const label = readText(raw.label, 40);
  if (!label || !PACKAGE_PATTERNS.label.test(label)) errors.push('label không hợp lệ (chữ, số, . _ -, tối đa 40 ký tự).');

  let sourceDate: string | null = null;
  if (raw.sourceDate !== undefined && raw.sourceDate !== null) {
    sourceDate = readText(raw.sourceDate, 10);
    if (!sourceDate || !PACKAGE_PATTERNS.date.test(sourceDate)) errors.push('sourceDate phải có dạng YYYY-MM-DD.');
  }

  const crs = readText(raw.crs, 20);
  if (!crs || (spec && !spec.crs.includes(crs))) errors.push(`crs phải là ${spec ? spec.crs.join(' hoặc ') : 'hệ tọa độ được khuôn cho phép'}.`);

  const sources = parseSources(raw.sources, errors);
  const pipeline = parsePipeline(raw.pipeline, errors);
  const manualSteps = parseManualSteps(raw.manualSteps, errors);

  const rowCount = raw.rowCount;
  if (typeof rowCount !== 'number' || !Number.isInteger(rowCount) || rowCount < 0) errors.push('rowCount phải là số nguyên không âm.');

  const categories = parseCategories(raw.categories, errors);

  const dataSha256 = readText(raw.dataSha256, 64);
  if (!dataSha256 || !PACKAGE_PATTERNS.sha256.test(dataSha256)) errors.push('dataSha256 phải là sha256 dạng hex thường.');

  let gridCode: string | null = null;
  if (spec?.geometryKind === 'grid') {
    gridCode = readText(raw.gridCode, 30);
    if (!gridCode || !/^[a-z0-9-]{2,30}$/.test(gridCode)) errors.push('Khuôn grid cần gridCode (ví dụ vn2000-100m).');
  }

  const params = parseParams(raw.params, errors);
  const notes = raw.notes === undefined ? '' : readText(raw.notes, 2000);
  if (notes === null) errors.push('notes tối đa 2000 ký tự.');

  if (errors.length || !isContractId(contract) || !layer || !label || !crs || !dataSha256 || !pipeline || typeof rowCount !== 'number') {
    return { ok: false, errors };
  }
  return {
    ok: true,
    manifest: {
      contract,
      layer,
      label,
      sourceDate,
      crs,
      sources,
      pipeline,
      manualSteps,
      rowCount,
      categories,
      dataSha256,
      gridCode,
      params,
      notes: notes ?? '',
    },
  };
}

function parseSources(value: unknown, errors: string[]): ManifestSource[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > SOURCES_MAX) {
    errors.push(`sources cần từ 1 tới ${SOURCES_MAX} nguồn.`);
    return [];
  }
  const sources: ManifestSource[] = [];
  value.forEach((item, index) => {
    if (!isObject(item)) {
      errors.push(`sources[${index}] phải là object.`);
      return;
    }
    const catalog = readText(item.catalog, 300);
    const url = readText(item.url ?? '', 1000);
    const sha256 = readText(item.sha256, 64);
    const license = readText(item.license, 100);
    if (!catalog || !catalog.startsWith('data/catalog/snapshots/') || catalog.includes('..')) {
      errors.push(`sources[${index}].catalog phải trỏ tới biên bản trong data/catalog/snapshots/.`);
    }
    if (!sha256 || !PACKAGE_PATTERNS.sha256.test(sha256)) errors.push(`sources[${index}].sha256 không hợp lệ.`);
    if (!license) errors.push(`sources[${index}].license là bắt buộc.`);
    if (url === null) errors.push(`sources[${index}].url quá dài.`);
    if (catalog && sha256 && license && url !== null) sources.push({ catalog, url, sha256, license });
  });
  return sources;
}

function parsePipeline(value: unknown, errors: string[]): ManifestPipeline | null {
  if (!isObject(value)) {
    errors.push('pipeline là bắt buộc ({tool, commit, dirty}).');
    return null;
  }
  const tool = readText(value.tool, 200);
  const commit = readText(value.commit, 40);
  const dirty = value.dirty;
  if (!tool) errors.push('pipeline.tool là bắt buộc.');
  if (!commit || !PACKAGE_PATTERNS.gitCommit.test(commit)) errors.push('pipeline.commit phải là mã commit git.');
  if (typeof dirty !== 'boolean') errors.push('pipeline.dirty phải là true hoặc false.');
  return tool && commit && typeof dirty === 'boolean' ? { tool, commit, dirty } : null;
}

function parseManualSteps(value: unknown, errors: string[]): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MANUAL_STEPS_MAX) {
    errors.push(`manualSteps phải là danh sách tối đa ${MANUAL_STEPS_MAX} dòng.`);
    return [];
  }
  const steps: string[] = [];
  for (const item of value) {
    const text = readText(item, TEXT_MAX);
    if (!text) {
      errors.push(`Mỗi dòng manualSteps là chuỗi 1–${TEXT_MAX} ký tự.`);
      return [];
    }
    steps.push(text);
  }
  return steps;
}

function parseCategories(value: unknown, errors: string[]): Record<string, number> {
  if (value === undefined) return {};
  if (!isObject(value) || Object.keys(value).length > CATEGORIES_MAX) {
    errors.push('categories phải là object {loại: số lượng}.');
    return {};
  }
  const categories: Record<string, number> = {};
  for (const [key, count] of Object.entries(value)) {
    if (!PACKAGE_PATTERNS.category.test(key) || typeof count !== 'number' || !Number.isInteger(count) || count < 0) {
      errors.push(`categories["${key.slice(0, 30)}"] không hợp lệ.`);
      continue;
    }
    categories[key] = count;
  }
  return categories;
}

function parseParams(value: unknown, errors: string[]): Record<string, ManifestParamValue> {
  if (value === undefined) return {};
  if (!isObject(value) || Object.keys(value).length > PARAMS_MAX) {
    errors.push(`params phải là object tối đa ${PARAMS_MAX} khóa.`);
    return {};
  }
  const params: Record<string, ManifestParamValue> = {};
  for (const [key, item] of Object.entries(value)) {
    const isScalar = typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean';
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(key) || !isScalar || (typeof item === 'string' && item.length > 200)) {
      errors.push(`params["${key.slice(0, 40)}"] không hợp lệ.`);
      continue;
    }
    params[key] = item;
  }
  return params;
}
