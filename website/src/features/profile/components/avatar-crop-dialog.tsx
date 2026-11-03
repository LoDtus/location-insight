"use client";

import { useEffect, useRef, useState, type JSX, type PointerEvent } from "react";

const VIEW = 280;
const OUTPUT = 512;

export function AvatarCropDialog({
    src,
    pending,
    onCancel,
    onConfirm,
}: {
    src: string;
    pending: boolean;
    onCancel: () => void;
    onConfirm: (file: Blob) => void;
}): JSX.Element {
    const imageRef = useRef<HTMLImageElement>(null);
    const dragRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
    const [natural, setNatural] = useState({ w: 0, h: 0 });
    const [zoom, setZoom] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });

    useEffect(() => {
        function onKey(event: KeyboardEvent): void {
            if (event.key === "Escape" && !pending) onCancel();
        }
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onCancel, pending]);

    function scaleFor(nextZoom: number): number {
        if (natural.w === 0 || natural.h === 0) return 1;
        return Math.max(VIEW / natural.w, VIEW / natural.h) * nextZoom;
    }

    function clamp(x: number, y: number, nextZoom: number): { x: number; y: number } {
        const scale = scaleFor(nextZoom);
        const width = natural.w * scale;
        const height = natural.h * scale;
        return {
            x: Math.min(0, Math.max(VIEW - width, x)),
            y: Math.min(0, Math.max(VIEW - height, y)),
        };
    }

    function onLoad(): void {
        const image = imageRef.current;
        if (!image) return;
        const next = { w: image.naturalWidth, h: image.naturalHeight };
        setNatural(next);
        const scale = Math.max(VIEW / next.w, VIEW / next.h);
        setOffset({
            x: (VIEW - next.w * scale) / 2,
            y: (VIEW - next.h * scale) / 2,
        });
        setZoom(1);
    }

    function move(event: PointerEvent<HTMLDivElement>): void {
        const drag = dragRef.current;
        if (!drag) return;
        setOffset(clamp(drag.ox + event.clientX - drag.x, drag.oy + event.clientY - drag.y, zoom));
    }

    function confirm(): void {
        const image = imageRef.current;
        if (!image || natural.w === 0) return;
        const scale = scaleFor(zoom);
        const canvas = document.createElement("canvas");
        canvas.width = OUTPUT;
        canvas.height = OUTPUT;
        const context = canvas.getContext("2d");
        if (!context) return;
        context.drawImage(
            image,
            -offset.x / scale,
            -offset.y / scale,
            VIEW / scale,
            VIEW / scale,
            0,
            0,
            OUTPUT,
            OUTPUT,
        );
        canvas.toBlob(
            (blob) => {
                if (blob) onConfirm(blob);
            },
            "image/jpeg",
            0.9,
        );
    }

    const scale = scaleFor(zoom);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/70 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="canh-anh"
        >
            <div className="w-full max-w-md bg-white p-6">
                <h2 id="canh-anh" className="m-0 text-xl font-semibold">
                    Căn chỉnh ảnh đại diện
                </h2>
                <p className="mt-2 mb-5 text-sm text-charcoal/70">
                    Kéo ảnh trong vòng tròn để chọn phần sẽ hiển thị. Ảnh dài có thể kéo sang hai bên.
                </p>
                <div
                    className="relative mx-auto size-[280px] cursor-grab touch-none overflow-hidden rounded-full border-2 border-charcoal/20 active:cursor-grabbing"
                    onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId);
                        dragRef.current = { x: event.clientX, y: event.clientY, ox: offset.x, oy: offset.y };
                    }}
                    onPointerMove={move}
                    onPointerUp={() => {
                        dragRef.current = null;
                    }}
                    onPointerCancel={() => {
                        dragRef.current = null;
                    }}
                    onKeyDown={(event) => {
                        const step = event.shiftKey ? 24 : 8;
                        const next = { ...offset };
                        if (event.key === "ArrowLeft") next.x += step;
                        else if (event.key === "ArrowRight") next.x -= step;
                        else if (event.key === "ArrowUp") next.y += step;
                        else if (event.key === "ArrowDown") next.y -= step;
                        else return;
                        event.preventDefault();
                        setOffset(clamp(next.x, next.y, zoom));
                    }}
                    tabIndex={0}
                    role="application"
                    aria-label="Kéo để căn ảnh trong vòng tròn"
                >
                    {/* Ảnh local người dùng vừa chọn, chưa có URL ổn định. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        ref={imageRef}
                        src={src}
                        alt=""
                        draggable={false}
                        onLoad={onLoad}
                        className="pointer-events-none absolute max-w-none"
                        style={{
                            left: offset.x,
                            top: offset.y,
                            width: natural.w * scale,
                            height: natural.h * scale,
                        }}
                    />
                </div>
                <label className="mt-5 grid gap-2 text-sm font-semibold">
                    Phóng to
                    <input
                        type="range"
                        min={1}
                        max={3}
                        step={0.01}
                        value={zoom}
                        aria-valuetext={`${Math.round(zoom * 100)}%`}
                        onChange={(event) => {
                            const nextZoom = Number(event.target.value);
                            setOffset((current) => clamp(current.x, current.y, nextZoom));
                            setZoom(nextZoom);
                        }}
                    />
                </label>
                <div className="mt-5 flex flex-wrap gap-3">
                    <button
                        type="button"
                        className="inline-flex min-h-11 items-center bg-green px-4 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60"
                        disabled={pending || natural.w === 0}
                        onClick={confirm}
                    >
                        {pending ? "Đang lưu…" : "Dùng ảnh này"}
                    </button>
                    <button
                        type="button"
                        className="inline-flex min-h-11 items-center border border-current bg-transparent px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        disabled={pending}
                        onClick={onCancel}
                    >
                        Hủy
                    </button>
                </div>
            </div>
        </div>
    );
}
