import type { ContractId, GeometryKind, LayerUsage, PackageManifest } from './package-contracts.js';

export type LayerVersionStatus = 'building' | 'ready' | 'retired';
export type ImportJobStatus = 'uploaded' | 'validating' | 'validated' | 'rejected' | 'saving' | 'saved' | 'discarded' | 'failed';
export type ImportPurpose = 'new' | 'restore';

/** Kết quả một kiểm tra chất lượng (data-change-playbook.md, mục Kiểm tra mặc định). */
export interface QualityCheck {
  code: string;
  severity: 'blocking' | 'warning';
  status: 'pass' | 'fail';
  expected: string;
  observed: string;
}

export interface DiffSummary {
  baseLayerVersionId: string | null;
  baseRowCount: number | null;
  rowCount: number;
  added: number | null;
  removed: number | null;
  byCategory: Record<string, { before: number; after: number }>;
}

export interface LayerVersionView {
  id: string;
  label: string;
  status: LayerVersionStatus;
  rowCount: number | null;
  packageSha256: string;
  integrityOk: boolean | null;
  integrityCheckedAt: string | null;
  createdAt: string;
  readyAt: string | null;
  retiredAt: string | null;
  diffSummary: DiffSummary | null;
  checks: QualityCheck[];
  acceptedWarnings: string | null;
  sources: Array<{ catalog: string; license: string }>;
  inReleases: number[];
}

export interface LayerView {
  code: string;
  geometryKind: GeometryKind;
  contract: ContractId;
  sourceCode: string;
  usage: LayerUsage;
  attribution: string;
  description: string;
  usageReason: string | null;
  createdAt: string;
  versions: LayerVersionView[];
}

export interface ImportJobView {
  id: string;
  layerCode: string;
  label: string;
  contract: ContractId;
  purpose: ImportPurpose;
  status: ImportJobStatus;
  packageSha256: string;
  sizeBytes: number;
  manifest: PackageManifest;
  checks: QualityCheck[];
  diffSummary: DiffSummary | null;
  preview: Array<Record<string, unknown>> | null;
  rowCount: number | null;
  error: string | null;
  uploadedBy: string;
  decidedBy: string | null;
  acceptedWarnings: string | null;
  layerVersionId: string | null;
  createdAt: string;
  finishedAt: string | null;
}

export interface UploadTicket {
  uploadId: string;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
  maxBytes: number;
}
