"use client";

import type { JSX } from "react";

import ImageLightbox from "@/shared/components/lightbox/image-lightbox";

/** Chỉ cần địa chỉ ảnh: dùng được cho ảnh tin nhắn, danh sách đã gửi và phản hồi. */
export interface LightboxFile {
    id: string;
    url: string;
}

/** Bọc trình xem ảnh dùng chung cho dữ liệu tin nhắn ({ id, url }). */
export function Lightbox({
    files,
    start,
    onClose,
}: {
    files: LightboxFile[];
    start: number;
    onClose: () => void;
}): JSX.Element | null {
    return <ImageLightbox images={files.map((file) => ({ id: file.id, src: file.url }))} start={start} onClose={onClose} />;
}
