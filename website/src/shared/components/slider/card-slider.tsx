"use client";

import "swiper/css";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState, type JSX, type ReactNode } from "react";
import type { Swiper as SwiperInstance } from "swiper";
import { A11y, Keyboard } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";
import type { SwiperOptions } from "swiper/types";

export type SliderTone = "light" | "dark";

/** Số thẻ hiện cùng lúc theo bề ngang: điện thoại thấy mép thẻ kế bên để biết là vuốt được. */
export const CARD_BREAKPOINTS: Record<number, SwiperOptions> = {
    0: { slidesPerView: 1.25, spaceBetween: 12 },
    640: { slidesPerView: 2.2, spaceBetween: 12 },
    1024: { slidesPerView: 3, spaceBetween: 16 },
    1280: { slidesPerView: 4, spaceBetween: 16 },
};

const ARROW_TONE: Record<SliderTone, string> = {
    light: "border-charcoal/20 bg-white text-charcoal shadow-[0_2px_8px_rgba(16,17,17,0.15)] hover:bg-charcoal/5",
    dark: "border-cream/30 bg-charcoal/85 text-cream shadow-[0_2px_10px_rgba(0,0,0,0.35)] hover:bg-charcoal",
};

/**
 * Dải thẻ trượt ngang bằng Swiper. Màn rộng có hai nút < > ở hai mép; điện thoại ẩn nút, chỉ vuốt.
 * Nút tự mờ khi đã tới đầu hoặc cuối dải.
 */
export default function CardSlider({
    slides,
    label,
    previousLabel,
    nextLabel,
    tone = "light",
    breakpoints = CARD_BREAKPOINTS,
}: {
    slides: { key: string; node: ReactNode }[];
    label: string;
    previousLabel: string;
    nextLabel: string;
    tone?: SliderTone;
    breakpoints?: Record<number, SwiperOptions>;
}): JSX.Element {
    const [swiper, setSwiper] = useState<SwiperInstance | null>(null);
    const [edge, setEdge] = useState({ start: true, end: false });

    function syncEdge(instance: SwiperInstance): void {
        setEdge({ start: instance.isBeginning, end: instance.isEnd });
    }

    const arrow = `absolute top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full border transition-opacity disabled:pointer-events-none disabled:opacity-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green md:inline-flex motion-reduce:transition-none ${ARROW_TONE[tone]}`;

    return (
        <div className="relative" role="region" aria-roledescription="carousel" aria-label={label}>
            <Swiper
                modules={[A11y, Keyboard]}
                breakpoints={breakpoints}
                keyboard={{ enabled: true, onlyInViewport: true }}
                a11y={{ prevSlideMessage: previousLabel, nextSlideMessage: nextLabel }}
                watchOverflow
                onSwiper={(instance) => {
                    setSwiper(instance);
                    syncEdge(instance);
                }}
                onSlideChange={syncEdge}
                onResize={syncEdge}
                onReachEnd={syncEdge}
                onReachBeginning={syncEdge}
                className="w-full"
            >
                {slides.map((slide) => (
                    <SwiperSlide key={slide.key} className="h-auto!">
                        {slide.node}
                    </SwiperSlide>
                ))}
            </Swiper>
            <button
                type="button"
                aria-label={previousLabel}
                disabled={edge.start}
                onClick={() => swiper?.slidePrev()}
                className={`${arrow} left-0 -translate-x-1/2`}
            >
                <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button
                type="button"
                aria-label={nextLabel}
                disabled={edge.end}
                onClick={() => swiper?.slideNext()}
                className={`${arrow} right-0 translate-x-1/2`}
            >
                <ChevronRight size={18} aria-hidden="true" />
            </button>
        </div>
    );
}
