"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

const SLIDE_MS = 6000;

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
            className="relative h-full min-h-[24rem] overflow-hidden bg-charcoal"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            {slides.map((slide, slideIndex) => (
                <img
                    key={slide.src}
                    src={slide.src}
                    alt={slideIndex === index ? slide.alt : ""}
                    aria-hidden={slideIndex !== index}
                    className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-1000 motion-reduce:transition-none ${slideIndex === index ? "opacity-100" : "opacity-0"}`}
                />
            ))}
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-charcoal/70 px-5 py-4 text-cream">
                <p className="m-0 text-base italic" aria-hidden="true">
                    {current?.alt}
                </p>
                <div className="flex shrink-0 gap-1">
                    <button
                        type="button"
                        aria-label={previousLabel}
                        className="inline-flex h-11 w-11 items-center justify-center bg-cream text-charcoal transition-colors hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                        onClick={() => show(index - 1)}
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <button
                        type="button"
                        aria-label={nextLabel}
                        className="inline-flex h-11 w-11 items-center justify-center bg-cream text-charcoal transition-colors hover:bg-gold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold motion-reduce:transition-none"
                        onClick={() => show(index + 1)}
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
            <p className="sr-only" aria-live="polite">
                {current?.alt}
            </p>
        </div>
    );
}
