"use client";

import { ArrowLeft, ArrowRight, Download, LayoutGrid, Square, X, ZoomIn, ZoomOut } from "lucide-react";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type JSX,
    type PointerEvent as ReactPointerEvent,
    type WheelEvent as ReactWheelEvent,
} from "react";
import { createPortal } from "react-dom";

export type LightboxImage = {
    /** Khóa ổn định; bỏ trống thì dùng địa chỉ ảnh. */
    id?: string;
    src: string;
    alt?: string;
};

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 1.5;
const SWIPE_PX = 50;

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function fileNameOf(src: string, index: number): string {
    try {
        const name = new URL(src, window.location.href).pathname.split("/").pop();
        if (name && /\.[a-z0-9]{2,5}$/i.test(name)) return decodeURIComponent(name);
    } catch {
        // Địa chỉ lạ thì dùng tên mặc định.
    }
    return `anh-${index + 1}.jpg`;
}

/** Tải ảnh về máy: lấy blob để thuộc tính download chạy được cả với ảnh khác nguồn; lỗi thì mở ảnh ở tab mới. */
async function downloadImage(src: string, index: number): Promise<void> {
    try {
        const response = await fetch(src, { mode: "cors" });
        if (!response.ok) throw new Error("download failed");
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = fileNameOf(src, index);
        document.body.append(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    } catch {
        window.open(src, "_blank", "noopener,noreferrer");
    }
}

/**
 * Trình xem ảnh toàn màn hình dùng chung cho cả dự án (tin rao, tin nhắn, phản hồi, diễn đàn).
 * Số thứ tự góc trái; góc phải có kích thước thật, thu nhỏ, phóng to, tải xuống, đóng; mũi tên hai bên;
 * dải ảnh nhỏ bên dưới bật/tắt được. Bàn phím: ← → chuyển ảnh, + − phóng to/thu nhỏ, Esc đóng.
 * Chuột: lăn để phóng to, kéo để di chuyển ảnh đã phóng, bấm đúp để phóng/thu. Điện thoại: vuốt ngang để chuyển ảnh.
 */
export default function ImageLightbox({
    images,
    start = 0,
    onClose,
    onIndexChange,
    label = "Xem ảnh",
}: {
    images: readonly LightboxImage[];
    start?: number;
    onClose: () => void;
    onIndexChange?: (index: number) => void;
    label?: string;
}): JSX.Element | null {
    const count = images.length;
    const [index, setIndex] = useState(() => clamp(start, 0, Math.max(0, count - 1)));
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [dragging, setDragging] = useState(false);
    const [thumbs, setThumbs] = useState(true);
    const [atActual, setAtActual] = useState(false);
    const root = useRef<HTMLDivElement>(null);
    const stage = useRef<HTMLDivElement>(null);
    const picture = useRef<HTMLImageElement>(null);
    const closeButton = useRef<HTMLButtonElement>(null);
    const strip = useRef<HTMLDivElement>(null);
    const gesture = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);
    const onCloseRef = useRef(onClose);
    const onIndexRef = useRef(onIndexChange);
    const current = images[index];

    useEffect(() => {
        onCloseRef.current = onClose;
        onIndexRef.current = onIndexChange;
    });

    const resetZoom = useCallback((): void => {
        setScale(1);
        setOffset({ x: 0, y: 0 });
        setAtActual(false);
    }, []);

    const go = useCallback(
        (next: number): void => {
            if (count === 0) return;
            const target = (next + count) % count;
            setIndex(target);
            resetZoom();
            onIndexRef.current?.(target);
        },
        [count, resetZoom],
    );

    /** Giữ ảnh đã phóng không bị kéo trôi hẳn ra ngoài khung. */
    const boundOffset = useCallback((x: number, y: number, nextScale: number): { x: number; y: number } => {
        const img = picture.current;
        const box = stage.current;
        if (!img || !box) return { x, y };
        const maxX = Math.max(0, (img.clientWidth * nextScale - box.clientWidth) / 2);
        const maxY = Math.max(0, (img.clientHeight * nextScale - box.clientHeight) / 2);
        return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
    }, []);

    const zoomTo = useCallback(
        (next: number): void => {
            const value = clamp(next, MIN_SCALE, MAX_SCALE);
            setScale(value);
            setAtActual(false);
            setOffset((old) => (value === 1 ? { x: 0, y: 0 } : boundOffset(old.x, old.y, value)));
        },
        [boundOffset],
    );

    /** Tỷ lệ để ảnh hiện đúng số điểm ảnh thật (1:1). Ảnh nhỏ hơn khung thì là 1. */
    const actualScale = (): number => {
        const img = picture.current;
        if (!img || !img.clientWidth) return 1;
        return clamp(img.naturalWidth / img.clientWidth, MIN_SCALE, MAX_SCALE);
    };

    // Khóa cuộn trang, đưa tiêu điểm vào nút đóng, trả tiêu điểm khi đóng.
    useEffect(() => {
        const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButton.current?.focus();
        return () => {
            document.body.style.overflow = overflow;
            previous?.focus();
        };
    }, []);

    useEffect(() => {
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                event.preventDefault();
                onCloseRef.current();
            } else if (event.key === "ArrowLeft") {
                go(index - 1);
            } else if (event.key === "ArrowRight") {
                go(index + 1);
            } else if (event.key === "+" || event.key === "=") {
                zoomTo(scale * ZOOM_STEP);
            } else if (event.key === "-") {
                zoomTo(scale / ZOOM_STEP);
            } else if (event.key === "Tab") {
                // Giữ tiêu điểm trong trình xem.
                const nodes = root.current?.querySelectorAll<HTMLElement>("button:not([disabled])");
                if (!nodes || nodes.length === 0) return;
                const list = [...nodes];
                const at = list.indexOf(document.activeElement as HTMLElement);
                const next = event.shiftKey ? (at <= 0 ? list.length - 1 : at - 1) : at === list.length - 1 ? 0 : at + 1;
                event.preventDefault();
                list[next]?.focus();
            }
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [go, index, scale, zoomTo]);

    useEffect(() => {
        const node = strip.current?.querySelector<HTMLElement>(`[data-thumb="${index}"]`);
        node?.scrollIntoView({ block: "nearest", inline: "center" });
    }, [index, thumbs]);

    function onPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
        if (event.button !== 0) return;
        gesture.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
        setDragging(true);
    }

    function onPointerMove(event: ReactPointerEvent<HTMLDivElement>): void {
        const start = gesture.current;
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) start.moved = true;
        if (scale > 1) setOffset(boundOffset(start.ox + dx, start.oy + dy, scale));
    }

    function onPointerUp(event: ReactPointerEvent<HTMLDivElement>): void {
        const start = gesture.current;
        gesture.current = null;
        setDragging(false);
        if (!start) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (scale === 1 && Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) {
            go(dx < 0 ? index + 1 : index - 1);
            return;
        }
        // Bấm vào vùng đen quanh ảnh (không kéo) thì đóng; bấm lên ảnh thì không.
        const rect = picture.current?.getBoundingClientRect();
        const onImage =
            rect !== undefined &&
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom;
        if (!start.moved && !onImage) onCloseRef.current();
    }

    function onWheel(event: ReactWheelEvent<HTMLDivElement>): void {
        zoomTo(event.deltaY < 0 ? scale * 1.2 : scale / 1.2);
    }

    // Chỉ dựng sau thao tác của người dùng nên luôn chạy ở trình duyệt; vẫn chặn phòng khi bị gọi lúc render trên máy chủ.
    if (typeof document === "undefined" || !current) return null;

    const tool =
        "inline-flex size-11 items-center justify-center rounded-md bg-transparent text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-white disabled:opacity-35 disabled:hover:bg-transparent";
    const arrow =
        "absolute top-1/2 z-10 hidden size-12 -translate-y-1/2 items-center justify-center rounded-md bg-black/30 text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white sm:inline-flex";

    return createPortal(
        <div
            ref={root}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className="fixed inset-0 z-[100] flex flex-col bg-black text-white select-none"
        >
            <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 py-2 sm:px-5">
                <p className="m-0 text-sm text-white/85 tabular-nums" aria-live="polite">
                    {index + 1} / {count}
                </p>
                <div className="flex items-center gap-0.5">
                    <button
                        type="button"
                        aria-label={atActual ? "Vừa khung" : "Kích thước thật"}
                        aria-pressed={atActual}
                        title={atActual ? "Vừa khung" : "Kích thước thật"}
                        onClick={() => {
                            if (atActual) {
                                resetZoom();
                                return;
                            }
                            zoomTo(actualScale());
                            setAtActual(true);
                        }}
                        className={tool}
                    >
                        <Square size={18} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Thu nhỏ" title="Thu nhỏ" disabled={scale <= MIN_SCALE} onClick={() => zoomTo(scale / ZOOM_STEP)} className={tool}>
                        <ZoomOut size={20} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Phóng to" title="Phóng to" disabled={scale >= MAX_SCALE} onClick={() => zoomTo(scale * ZOOM_STEP)} className={tool}>
                        <ZoomIn size={20} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Tải xuống" title="Tải xuống" onClick={() => void downloadImage(current.src, index)} className={tool}>
                        <Download size={20} aria-hidden="true" />
                    </button>
                    <button ref={closeButton} type="button" aria-label="Đóng" title="Đóng (Esc)" onClick={() => onCloseRef.current()} className={tool}>
                        <X size={22} aria-hidden="true" />
                    </button>
                </div>
            </div>

            <div
                ref={stage}
                className={`relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden ${scale > 1 ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""}`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                    gesture.current = null;
                    setDragging(false);
                }}
                onWheel={onWheel}
                onDoubleClick={() => (scale > 1 ? resetZoom() : zoomTo(2))}
            >
                {/* eslint-disable-next-line @next/next/no-img-element -- ảnh có thể là URL ký tạm, không tối ưu được lúc build */}
                <img
                    ref={picture}
                    key={current.id ?? current.src}
                    src={current.src}
                    alt={current.alt || `Ảnh ${index + 1} trên ${count}`}
                    draggable={false}
                    style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})` }}
                    className={`pointer-events-none max-h-full max-w-full object-contain ${dragging ? "" : "transition-transform duration-200 ease-out motion-reduce:transition-none"}`}
                />
            </div>

            {count > 1 ? (
                <>
                    <button type="button" aria-label="Ảnh trước" onClick={() => go(index - 1)} className={`${arrow} left-3 sm:left-5`}>
                        <ArrowLeft size={24} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label="Ảnh sau" onClick={() => go(index + 1)} className={`${arrow} right-3 sm:right-5`}>
                        <ArrowRight size={24} aria-hidden="true" />
                    </button>
                </>
            ) : null}

            {count > 1 ? (
                <div className="relative shrink-0">
                    <button
                        type="button"
                        aria-label={thumbs ? "Ẩn ảnh nhỏ" : "Hiện ảnh nhỏ"}
                        aria-expanded={thumbs}
                        title={thumbs ? "Ẩn ảnh nhỏ" : "Hiện ảnh nhỏ"}
                        onClick={() => setThumbs((value) => !value)}
                        className="absolute right-3 bottom-full z-10 mb-2 inline-flex size-11 items-center justify-center rounded-md bg-black/60 text-white/85 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white sm:right-5"
                    >
                        <LayoutGrid size={20} aria-hidden="true" />
                    </button>
                    {thumbs ? (
                        <div ref={strip} className="flex gap-1.5 overflow-x-auto bg-black px-2 py-2 [scrollbar-color:rgba(255,255,255,0.3)_transparent] [scrollbar-width:thin]">
                            {images.map((image, thumb) => (
                                <button
                                    key={image.id ?? image.src}
                                    type="button"
                                    data-thumb={thumb}
                                    aria-label={`Ảnh ${thumb + 1}`}
                                    aria-current={thumb === index ? "true" : undefined}
                                    onClick={() => go(thumb)}
                                    className={`h-16 w-24 shrink-0 overflow-hidden rounded-sm border-2 bg-white/5 p-0 focus-visible:outline-2 focus-visible:outline-white sm:h-20 sm:w-28 ${thumb === index ? "border-gold opacity-100" : "border-transparent opacity-60 hover:opacity-100"}`}
                                >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={image.src} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                                </button>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>,
        document.body,
    );
}
