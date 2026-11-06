"use client";

import { useState, type JSX, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";

import ImageLightbox, { type LightboxImage } from "@/shared/components/lightbox/image-lightbox";

/**
 * Bọc phần thân bài: bấm vào bất kỳ ảnh nào có `data-lightbox` (ảnh bìa, ảnh trong bài) thì mở trình xem ảnh dùng chung
 * với mọi ảnh của bài theo đúng thứ tự xuất hiện. Dùng ủy quyền sự kiện nên phần dựng nội dung vẫn là server component.
 */
export default function ArticleImageViewer({ children, label }: { children: ReactNode; label: string }): JSX.Element {
    const [open, setOpen] = useState<{ images: LightboxImage[]; start: number } | null>(null);

    function openFrom(event: MouseEvent<HTMLDivElement> | KeyboardEvent<HTMLDivElement>): void {
        const target = event.target instanceof Element ? event.target.closest<HTMLImageElement>("img[data-lightbox]") : null;
        if (!target) return;
        event.preventDefault();
        const nodes = [...event.currentTarget.querySelectorAll<HTMLImageElement>("img[data-lightbox]")];
        const images = nodes.map((node, index) => ({
            id: `${index}:${node.currentSrc || node.src}`,
            // Ảnh bìa qua next/image: mở bản gốc thay vì bản đã thu nhỏ.
            src: node.dataset.lightbox || node.currentSrc || node.src,
            alt: node.alt,
        }));
        setOpen({ images, start: Math.max(0, nodes.indexOf(target)) });
    }

    return (
        // Ủy quyền sự kiện: ảnh có tabIndex nên Enter/Space trên ảnh đang focus cũng mở trình xem.
        <div
            onClick={openFrom}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") openFrom(event);
            }}
        >
            {children}
            {open ? <ImageLightbox images={open.images} start={open.start} label={label} onClose={() => setOpen(null)} /> : null}
        </div>
    );
}
