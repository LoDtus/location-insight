"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

const SLIDE_MS = 5000;

export type HeroSlide = {
    src: string;
    alt: string;
};

export default function HeroSlides({
    slides,
    previousLabel,
    nextLabel,
}: {
    slides: HeroSlide[];
    previousLabel: string;
    nextLabel: string;
}) {
    const [index, setIndex] = useState(0);
    const [paused, setPaused] = useState(false);

    useEffect(() => {
        if (paused || slides.length < 2) {
            return;
        }

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            return;
        }

        const timer = window.setInterval(() => {
            setIndex((current) => (current + 1) % slides.length);
        }, SLIDE_MS);

        return () => window.clearInterval(timer);
    }, [paused, slides.length]);

    function show(next: number): void {
        const count = slides.length;
        setIndex((next + count) % count);
    }

    const current = slides[index];

    return (
        <div
            className="relative min-h-[28rem] overflow-hidden bg-charcoal"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {slides.map((slide, slideIndex) => (
                <img
                    key={slide.src}
                    src={slide.src}
                    alt={slideIndex === index ? slide.alt : ""}
                    aria-hidden={slideIndex !== index}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none ${slideIndex === index ? "opacity-100" : "opacity-0"}`}
                />
            ))}
            <div className="absolute right-4 bottom-4 flex gap-2">
                <button
                    type="button"
                    aria-label={previousLabel}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/15 bg-white text-charcoal"
                    onClick={() => show(index - 1)}
                >
                    <ChevronLeft size={18} />
                </button>
                <button
                    type="button"
                    aria-label={nextLabel}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-charcoal/15 bg-white text-charcoal"
                    onClick={() => show(index + 1)}
                >
                    <ChevronRight size={18} />
                </button>
            </div>
            <p className="sr-only" aria-live="polite">
                {current?.alt}
            </p>
        </div>
    );
}
