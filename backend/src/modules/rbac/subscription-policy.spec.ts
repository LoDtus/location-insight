import { describe, expect, it } from 'vitest';
import { decidePlanChange } from './subscription-policy.js';

describe('decidePlanChange', () => {
  it('mở gói khi đang miễn phí', () => {
    expect(decidePlanChange(null, 'unlimited')).toBe('open');
  });

  it('nối hạn khi mua cùng hạng', () => {
    expect(decidePlanChange('valued', 'valued')).toBe('extend');
  });

  it('lên hạng từ không giới hạn sang có định giá', () => {
    expect(decidePlanChange('unlimited', 'valued')).toBe('upgrade');
  });

  it('từ chối xuống hạng khi gói cao còn hạn', () => {
    expect(decidePlanChange('valued', 'unlimited')).toBe('reject');
  });
});
