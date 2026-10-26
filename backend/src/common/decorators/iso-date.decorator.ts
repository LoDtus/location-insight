import { Transform } from 'class-transformer';
import { toUtcIsoString } from '../../shared/utils/iso-date.util.js';

/** Gắn lên field Date của DTO hoặc entity để JSON trả về dạng ISO-8601 UTC. */
export const IsoDate = () =>
  Transform(
    ({ value }: { value: unknown }) => {
      if (value instanceof Date && !Number.isNaN(value.getTime())) {
        return toUtcIsoString(value);
      }

      return value;
    },
    { toPlainOnly: true },
  );
