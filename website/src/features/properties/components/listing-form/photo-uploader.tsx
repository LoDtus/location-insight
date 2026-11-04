"use client";

import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState, type DragEvent, type JSX } from "react";

import { MAX_PHOTOS, preparePhoto, type PhotoRejection } from "@/features/properties/listing-photos";

const ICON_BUTTON =
    "inline-flex size-8 items-center justify-center rounded-md border-0 bg-white/90 text-charcoal shadow-sm hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green disabled:cursor-not-allowed disabled:opacity-40";

function rejectionText(reason: PhotoRejection, vi: boolean): string {
    if (reason === "size") return vi ? "Ảnh vượt quá 8 MB." : "The photo is over 8 MB.";
    if (reason === "type") return vi ? "Chỉ nhận ảnh JPG, PNG hoặc WebP." : "Only JPG, PNG or WebP photos are accepted.";
    return vi ? "Không đọc được ảnh này." : "This photo could not be read.";
}

/** Khu tải ảnh kiểu sàn thương mại điện tử: kéo thả, ảnh đầu tiên là ảnh bìa, đổi thứ tự, xóa. */
export default function PhotoUploader({
    photos,
    onChange,
    vi,
    invalid,
}: {
    photos: string[];
    onChange: (next: string[]) => void;
    vi: boolean;
    invalid: boolean;
}): JSX.Element {
    const input = useRef<HTMLInputElement>(null);
    const [busy, setBusy] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [notes, setNotes] = useState<string[]>([]);
    const full = photos.length >= MAX_PHOTOS;

    async function addFiles(files: File[]): Promise<void> {
        const room = MAX_PHOTOS - photos.length;
        if (room <= 0 || files.length === 0) return;
        setBusy(true);
        const accepted: string[] = [];
        const rejected: string[] = [];
        for (const file of files.slice(0, room)) {
            const result = await preparePhoto(file);
            if (result.ok) accepted.push(result.dataUrl);
            else rejected.push(`${file.name}: ${rejectionText(result.reason, vi)}`);
        }
        if (files.length > room) {
            rejected.push(vi ? `Chỉ nhận tối đa ${MAX_PHOTOS} ảnh.` : `At most ${MAX_PHOTOS} photos are accepted.`);
        }
        setNotes(rejected);
        setBusy(false);
        if (accepted.length > 0) onChange([...photos, ...accepted]);
    }

    function onDrop(event: DragEvent<HTMLDivElement>): void {
        event.preventDefault();
        setDragging(false);
        void addFiles(Array.from(event.dataTransfer.files));
    }

    function move(index: number, to: number): void {
        if (to < 0 || to >= photos.length) return;
        const next = [...photos];
        const [item] = next.splice(index, 1);
        next.splice(to, 0, item);
        onChange(next);
    }

    return (
        <div className="grid gap-3">
            <div
                onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center ${dragging ? "border-green bg-green/5" : invalid ? "border-red-600" : "border-charcoal/25"}`}
            >
                <ImagePlus size={28} aria-hidden="true" className="text-charcoal/60" />
                <p className="m-0 text-sm">{vi ? "Kéo ảnh vào đây hoặc" : "Drag photos here or"}</p>
                <button
                    type="button"
                    disabled={full || busy}
                    onClick={() => input.current?.click()}
                    className="min-h-11 rounded-xl border border-green bg-white px-5 text-sm font-semibold text-green hover:bg-green/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {busy ? (vi ? "Đang xử lý…" : "Processing…") : vi ? "Chọn ảnh từ máy" : "Choose photos"}
                </button>
                <p className="m-0 text-xs text-charcoal/60">
                    {vi
                        ? `${photos.length}/${MAX_PHOTOS} ảnh · JPG, PNG, WebP · tối đa 8 MB mỗi ảnh`
                        : `${photos.length}/${MAX_PHOTOS} photos · JPG, PNG, WebP · up to 8 MB each`}
                </p>
                <input
                    ref={input}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    className="sr-only"
                    tabIndex={-1}
                    aria-label={vi ? "Chọn ảnh" : "Choose photos"}
                    onChange={(event) => {
                        void addFiles(Array.from(event.target.files ?? []));
                        event.target.value = "";
                    }}
                />
            </div>
            {notes.length > 0 ? (
                <ul role="alert" className="m-0 list-none p-0 text-xs text-red-700">
                    {notes.map((note) => (
                        <li key={note}>{note}</li>
                    ))}
                </ul>
            ) : null}
            {photos.length > 0 ? (
                <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:grid-cols-3 md:grid-cols-4">
                    {photos.map((src, index) => (
                        <li key={src.slice(-48) + index} className="relative aspect-4/3 overflow-hidden rounded-xl border border-charcoal/15 bg-charcoal/5">
                            <Image src={src} alt={vi ? `Ảnh ${index + 1}` : `Photo ${index + 1}`} fill unoptimized sizes="200px" className="object-cover" />
                            {index === 0 ? (
                                <span className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-md bg-green px-2 py-0.5 text-xs font-semibold text-cream">
                                    <Star size={12} aria-hidden="true" />
                                    {vi ? "Ảnh bìa" : "Cover"}
                                </span>
                            ) : null}
                            <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-1">
                                <div className="flex gap-1">
                                    <button type="button" className={ICON_BUTTON} aria-label={vi ? "Dời lên trước" : "Move earlier"} disabled={index === 0} onClick={() => move(index, index - 1)}>
                                        <ArrowLeft size={16} aria-hidden="true" />
                                    </button>
                                    <button type="button" className={ICON_BUTTON} aria-label={vi ? "Dời ra sau" : "Move later"} disabled={index === photos.length - 1} onClick={() => move(index, index + 1)}>
                                        <ArrowRight size={16} aria-hidden="true" />
                                    </button>
                                </div>
                                <div className="flex gap-1">
                                    {index > 0 ? (
                                        <button type="button" className={ICON_BUTTON} aria-label={vi ? "Đặt làm ảnh bìa" : "Make cover"} onClick={() => move(index, 0)}>
                                            <Star size={16} aria-hidden="true" />
                                        </button>
                                    ) : null}
                                    <button type="button" className={ICON_BUTTON} aria-label={vi ? "Xóa ảnh" : "Remove photo"} onClick={() => onChange(photos.filter((_, position) => position !== index))}>
                                        <Trash2 size={16} aria-hidden="true" />
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}
