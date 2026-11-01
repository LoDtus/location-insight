import type { ValueTransformer } from 'typeorm';

/** PostgreSQL trả bigint dạng chuỗi; seq luôn nhỏ hơn 2^53 nên đổi sang number. */
export const bigintTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | number | null) =>
    value === null || value === undefined ? value : Number(value),
};
