import { PaginationMetaDto } from './pagination-meta.dto.js';

export class ApiMetadataDto {
  pagination?: PaginationMetaDto;
  sort?: string;
  search?: string;
  filter?: Record<string, unknown>;

  constructor(data: Partial<ApiMetadataDto> = {}) {
    this.pagination = data.pagination;
    this.sort = data.sort;
    this.search = data.search;
    this.filter = data.filter;
  }
}
