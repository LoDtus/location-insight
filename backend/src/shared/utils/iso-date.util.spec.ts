import { describe, expect, it } from 'vitest';
import { serializeDates, toUtcIsoString } from './iso-date.util.js';

describe('iso date', () => {
  it('formats a Date as ISO-8601 UTC with a Z suffix', () => {
    const value = new Date('2026-10-27T04:54:00.000Z');

    expect(toUtcIsoString(value)).toBe('2026-10-27T04:54:00.000Z');
  });

  it('converts nested dates and offsets before the payload leaves the server', () => {
    const payload = serializeDates({
      createdAt: new Date('2026-10-27T04:54:00.000Z'),
      items: [{ at: '2026-10-27T11:54:00+07:00' }],
      name: 'Matrix One',
    });

    expect(payload).toEqual({
      createdAt: '2026-10-27T04:54:00.000Z',
      items: [{ at: '2026-10-27T04:54:00.000Z' }],
      name: 'Matrix One',
    });
  });
});
