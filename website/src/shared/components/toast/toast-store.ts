/**
 * Hàng đợi thông báo nổi (toast) dùng chung toàn site. Gọi `showToast` ở bất kỳ đâu (kể cả ngoài React);
 * `<ToastViewport />` ở layout gốc hiển thị chúng ở góc trên bên phải.
 */
export type ToastTone = "success" | "info" | "error";

export interface ToastItem {
    id: number;
    title: string;
    description?: string;
    tone: ToastTone;
    /** Mili giây trước khi tự ẩn. */
    duration: number;
}

const MAX_VISIBLE = 4;
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(): void {
    for (const listener of listeners) listener();
}

export function subscribeToasts(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

export function getToasts(): ToastItem[] {
    return items;
}

const EMPTY: ToastItem[] = [];
export function getServerToasts(): ToastItem[] {
    return EMPTY;
}

export function showToast(input: { title: string; description?: string; tone?: ToastTone; duration?: number }): number {
    const id = nextId++;
    items = [...items, { id, title: input.title, description: input.description, tone: input.tone ?? "success", duration: input.duration ?? 4500 }].slice(-MAX_VISIBLE);
    emit();
    return id;
}

export function dismissToast(id: number): void {
    const next = items.filter((item) => item.id !== id);
    if (next.length === items.length) return;
    items = next;
    emit();
}
