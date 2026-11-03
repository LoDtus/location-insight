import { Injectable } from '@nestjs/common';
import type { SearchProfile } from './search.types.js';

export type AnySearchProfile = SearchProfile<unknown, unknown>;

/**
 * Nơi các module nghiệp vụ đăng ký profile của mình (BR-02: đăng ký không có nghĩa là bật;
 * bật là thêm tên vào ELASTICSEARCH_PROFILES).
 */
@Injectable()
export class SearchRegistry {
  private readonly profiles = new Map<string, AnySearchProfile>();
  private readonly listeners: Array<(profile: AnySearchProfile) => void> = [];

  register<TRow, TFilters>(profile: SearchProfile<TRow, TFilters>): void {
    if (this.profiles.has(profile.name)) {
      throw new Error(`Search profile "${profile.name}" đã được đăng ký`);
    }
    // Profile cụ thể → profile không kiểu: an toàn vì registry chỉ gọi lại với đúng kiểu hàng/bộ lọc của nó.
    const stored = profile as unknown as AnySearchProfile;
    this.profiles.set(profile.name, stored);
    for (const listener of this.listeners) listener(stored);
  }

  get(name: string): AnySearchProfile | undefined {
    return this.profiles.get(name);
  }

  all(): AnySearchProfile[] {
    return [...this.profiles.values()];
  }

  onRegister(listener: (profile: AnySearchProfile) => void): void {
    this.listeners.push(listener);
  }
}
