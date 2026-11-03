/**
 * Ngắt mạch trong bộ nhớ tiến trình (FR-10): sau `failureThreshold` lỗi liên tiếp thì từ chối gọi ES
 * trong `openMs`, rồi cho thử lại một lần. Không cần Redis ở giai đoạn 1.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly failureThreshold = 3,
    private readonly openMs = 30_000,
    private readonly now: () => number = Date.now,
  ) {}

  canRequest(): boolean {
    if (this.openedAt === null) return true;
    if (this.now() - this.openedAt >= this.openMs) {
      // Nửa mở: cho thử lại; lỗi tiếp thì mở lại ngay.
      this.openedAt = null;
      this.failures = this.failureThreshold - 1;
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.failures = 0;
    this.openedAt = null;
  }

  recordFailure(): void {
    this.failures += 1;
    if (this.failures >= this.failureThreshold) this.openedAt = this.now();
  }
}
