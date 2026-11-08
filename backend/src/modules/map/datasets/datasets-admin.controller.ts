import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  type PipeTransform,
} from '@nestjs/common';
import { BusinessException } from '../../../common/exceptions/business.exception.js';
import { RequirePermission } from '../../../common/decorators/access.decorator.js';
import { ErrorCode } from '../../../shared/constants/error-code.constant.js';
import { clientIp } from '../../auth/auth.constants.js';
import type { RequestWithPrincipal } from '../../auth/auth.guard.js';
import { MapDatasetService } from '../map-dataset.service.js';
import { DatasetAuditService, type DatasetActor } from './dataset-audit.service.js';
import { DatasetImportService } from './dataset-import.service.js';
import {
  CreateDraftDto,
  CreateLayerDto,
  CreateUploadTicketDto,
  ImportListQueryDto,
  PublishReleaseDto,
  SaveImportDto,
  SetReleaseLayerDto,
  SubmitUploadDto,
  UpdateLayerDto,
  WithdrawReleaseDto,
} from './datasets.dto.js';
import { GeoLayersService } from './geo-layers.service.js';
import { PACKAGE_PATTERNS } from './package-contracts.js';

/** Mã lớp trong đường dẫn: kiểm regex trước khi tới service (threat model T10). */
class LayerCodePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !PACKAGE_PATTERNS.layerCode.test(value)) {
      throw new BusinessException(ErrorCode.VALIDATION_ERROR, 'Mã lớp không hợp lệ.');
    }
    return value;
  }
}

function actor(request: RequestWithPrincipal): DatasetActor {
  return {
    userId: request.principal?.userId as string,
    sessionId: request.principal?.sessionId ?? null,
    ip: clientIp(request.ip),
  };
}

/** Bản phát hành dữ liệu đánh giá (018-location-data, interfaces/rest-api.yml). Chỉ admin. */
@Controller('admin/map/dataset-versions')
export class MapDatasetAdminController {
  constructor(
    private readonly releases: MapDatasetService,
    private readonly audit: DatasetAuditService,
  ) {}

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Get()
  list() {
    return this.releases.list();
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Post()
  async createDraft(@Body() body: CreateDraftDto, @Req() request: RequestWithPrincipal) {
    const who = actor(request);
    const created = await this.releases.createDraft(who.userId, body.kind, body.note);
    await this.audit.record(who, 'dataset_draft_create', String(created.version), { kind: body.kind });
    return created;
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Get(':version')
  detail(@Param('version', ParseIntPipe) version: number) {
    return this.releases.detail(version);
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Delete(':version')
  async abandon(@Param('version', ParseIntPipe) version: number, @Req() request: RequestWithPrincipal) {
    const who = actor(request);
    const result = await this.releases.abandon(version, who.userId);
    await this.audit.record(who, 'dataset_draft_abandon', String(version), null);
    return result;
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Put(':version/layers/:layerCode')
  async setLayer(
    @Param('version', ParseIntPipe) version: number,
    @Param('layerCode', LayerCodePipe) layerCode: string,
    @Body() body: SetReleaseLayerDto,
    @Req() request: RequestWithPrincipal,
  ) {
    const result = await this.releases.setLayer(version, layerCode, body.layerVersionId);
    await this.audit.record(actor(request), 'dataset_draft_set_layer', String(version), { layerCode, layerVersionId: body.layerVersionId });
    return result;
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Delete(':version/layers/:layerCode')
  async removeLayer(
    @Param('version', ParseIntPipe) version: number,
    @Param('layerCode', LayerCodePipe) layerCode: string,
    @Req() request: RequestWithPrincipal,
  ) {
    const result = await this.releases.removeLayer(version, layerCode);
    await this.audit.record(actor(request), 'dataset_draft_remove_layer', String(version), { layerCode });
    return result;
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(HttpStatus.OK)
  @Post(':version/publish')
  async publish(@Param('version', ParseIntPipe) version: number, @Body() body: PublishReleaseDto, @Req() request: RequestWithPrincipal) {
    const who = actor(request);
    const result = await this.releases.publish(version, who.userId, body.acceptWarnings);
    await this.audit.record(who, 'dataset_publish', String(version), { criteriaHash: result.criteriaHash }, body.acceptWarnings ?? null);
    return result;
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(HttpStatus.OK)
  @Post(':version/withdraw')
  async withdraw(@Param('version', ParseIntPipe) version: number, @Body() body: WithdrawReleaseDto, @Req() request: RequestWithPrincipal) {
    const who = actor(request);
    const result = await this.releases.withdraw(version, who.userId, body.reason, body.baseVersion);
    await this.audit.record(who, 'dataset_withdraw', String(version), { rollbackVersion: result.version, baseVersion: body.baseVersion }, body.reason);
    return result;
  }
}

/** Lớp dữ liệu nền. Phiên bản lớp chỉ sinh ra từ đường nhập gói. */
@Controller('admin/map/layers')
export class MapLayersAdminController {
  constructor(
    private readonly layers: GeoLayersService,
    private readonly audit: DatasetAuditService,
  ) {}

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Get()
  list() {
    return this.layers.list();
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Post()
  async create(@Body() body: CreateLayerDto, @Req() request: RequestWithPrincipal) {
    const who = actor(request);
    const created = await this.layers.create(who.userId, {
      code: body.code,
      contract: body.contract,
      sourceCode: body.sourceCode,
      usage: body.usage,
      attribution: body.attribution,
      description: body.description ?? '',
    });
    await this.audit.record(who, 'dataset_layer_create', body.code, { contract: body.contract, usage: body.usage });
    return created;
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Patch(':layerCode')
  async update(@Param('layerCode', LayerCodePipe) layerCode: string, @Body() body: UpdateLayerDto, @Req() request: RequestWithPrincipal) {
    const result = await this.layers.update(layerCode, body);
    await this.audit.record(actor(request), 'dataset_layer_update', layerCode, { usage: body.usage ?? null }, body.reason ?? null);
    return result;
  }
}

/** Nhập gói chuẩn: phiếu tải lên → nộp → kiểm tra nền → Lưu hoặc Bỏ. */
@Controller('admin/map/imports')
export class MapImportsAdminController {
  constructor(
    private readonly imports: DatasetImportService,
    private readonly audit: DatasetAuditService,
  ) {}

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Post('upload-tickets')
  createTicket(@Body() body: CreateUploadTicketDto, @Req() request: RequestWithPrincipal) {
    return this.imports.createUploadTicket(actor(request).userId, body.sizeBytes);
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(HttpStatus.ACCEPTED)
  @Post()
  async submit(@Body() body: SubmitUploadDto, @Req() request: RequestWithPrincipal) {
    const who = actor(request);
    const job = await this.imports.submitUpload(who.userId, body.uploadId);
    await this.audit.record(who, 'dataset_import_upload', job.id, { layerCode: job.layerCode, label: job.label, sha256: job.packageSha256 });
    return job;
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Get()
  list(@Query() query: ImportListQueryDto) {
    return this.imports.list(query.status, query.layerCode);
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @Get(':jobId')
  detail(@Param('jobId', ParseUUIDPipe) jobId: string) {
    return this.imports.get(jobId);
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(HttpStatus.OK)
  @Post(':jobId/save')
  async save(@Param('jobId', ParseUUIDPipe) jobId: string, @Body() body: SaveImportDto, @Req() request: RequestWithPrincipal) {
    const who = actor(request);
    const job = await this.imports.save(jobId, who.userId, body.acceptWarnings);
    await this.audit.record(who, 'dataset_import_save', jobId, { layerVersionId: job.layerVersionId }, body.acceptWarnings ?? null);
    return job;
  }

  @RequirePermission('admin:access')
  @Header('Cache-Control', 'private, no-store')
  @HttpCode(HttpStatus.OK)
  @Post(':jobId/discard')
  async discard(@Param('jobId', ParseUUIDPipe) jobId: string, @Req() request: RequestWithPrincipal) {
    const who = actor(request);
    const job = await this.imports.discard(jobId, who.userId);
    await this.audit.record(who, 'dataset_import_discard', jobId, null);
    return job;
  }
}
