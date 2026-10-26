export class PaginationMetaDto {
  page?: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;

  constructor(data: Partial<PaginationMetaDto> = {}) {
    this.page = data.page;
    this.pageSize = data.pageSize;
    this.totalItems = data.totalItems;
    this.totalPages = data.totalPages;
  }
}

export function buildPagination(
  page: number,
  pageSize: number,
  totalItems: number,
): PaginationMetaDto {
  return new PaginationMetaDto({
    page,
    pageSize,
    totalItems,
    totalPages: pageSize > 0 ? Math.ceil(totalItems / pageSize) : 0,
  });
}
