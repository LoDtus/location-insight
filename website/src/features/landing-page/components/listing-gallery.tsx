"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function ListingGallery({
    images,
    label,
    previousLabel,
    nextLabel,
    eager = false,
}: {
    images: readonly string[];
    label: string;
    previousLabel: string;
    nextLabel: string;
    eager?: boolean;
}) {
    const [index, setIndex] = useState(0);
    const count = images.length;

    function show(next: number): void {
        setIndex((next + count) % count);
    }

    return (
        <div className="relative aspect-[4/3] overflow-hidden bg-charcoal">
            {images.map((src, imageIndex) => (
                <img
                    key={src}
                    src={src}
                    alt={imageIndex === index ? label : ""}
                    aria-hidden={imageIndex !== index}
                    loading={eager && imageIndex === 0 ? "eager" : "lazy"}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 motion-reduce:transition-none ${imageIndex === index ? "opacity-100" : "opacity-0"}`}
                />
            ))}
            <div className="pointer-events-auto absolute right-3 bottom-3 flex gap-2">
                <button
                    type="button"
                    aria-label={previousLabel}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={() => show(index - 1)}
                >
                    <ChevronLeft size={18} />
                </button>
                <button
                    type="button"
                    aria-label={nextLabel}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                    onClick={() => show(index + 1)}
                >
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    );
}
