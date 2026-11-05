"use client";

import "swiper/css";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, type JSX } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import { A11y, Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

/**
 * Ảnh chính của tin dạng slide (Swiper). Màn rộng có nút < > hai bên; điện thoại ẩn nút, vuốt trái/phải.
 * `index` do trang giữ để ảnh nhỏ bên dưới và hộp xem ảnh lớn đi cùng một vị trí.
 */
export default function ListingPhotoSlider({
    images,
    title,
    index,
    onIndexChange,
    onOpen,
    openLabel,
    previousLabel,
    nextLabel,
}: {
    images: readonly string[];
    title: string;
    index: number;
    onIndexChange: (index: number) => void;
    onOpen: (index: number) => void;
    openLabel: (index: number) => string;
    previousLabel: string;
    nextLabel: string;
}): JSX.Element {
    const [swiper, setSwiper] = useState<SwiperInstance | null>(null);

    useEffect(() => {
        if (swiper && !swiper.destroyed && swiper.realIndex !== index) swiper.slideToLoop(index);
    }, [swiper, index]);

    const arrow =
        "absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border border-charcoal/15 bg-white/90 text-charcoal shadow-[0_2px_8px_rgba(16,17,17,0.2)] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green md:inline-flex";

    return (
        <div className="relative overflow-hidden rounded-md bg-charcoal" role="region" aria-roledescription="carousel" aria-label={title}>
            <Swiper
                modules={[A11y, Keyboard]}
                loop={images.length > 1}
                keyboard={{ enabled: true, onlyInViewport: true }}
                a11y={{ prevSlideMessage: previousLabel, nextSlideMessage: nextLabel }}
                onSwiper={setSwiper}
                onSlideChange={(instance) => onIndexChange(instance.realIndex)}
                className="aspect-[4/3] w-full"
            >
                {images.map((src, slide) => (
                    <SwiperSlide key={src}>
                        <button
                            type="button"
                            onClick={() => onOpen(slide)}
                            aria-label={openLabel(slide)}
                            className="block h-full w-full cursor-zoom-in border-0 bg-charcoal p-0"
                        >
                            <img
                                src={src}
                                alt={slide === index ? title : ""}
                                loading={slide === 0 ? "eager" : "lazy"}
                                draggable={false}
                                className="h-full w-full object-cover select-none"
                            />
                        </button>
                    </SwiperSlide>
                ))}
            </Swiper>
            {images.length > 1 ? (
                <>
                    <button type="button" aria-label={previousLabel} onClick={() => swiper?.slidePrev()} className={`${arrow} left-3`}>
                        <ChevronLeft size={20} aria-hidden="true" />
                    </button>
                    <button type="button" aria-label={nextLabel} onClick={() => swiper?.slideNext()} className={`${arrow} right-3`}>
                        <ChevronRight size={20} aria-hidden="true" />
                    </button>
                </>
            ) : null}
            <span className="pointer-events-none absolute right-2 bottom-2 z-10 rounded-md bg-charcoal/75 px-2 py-1 text-xs font-semibold text-white tabular-nums">
                {index + 1}/{images.length}
            </span>
        </div>
    );
}
