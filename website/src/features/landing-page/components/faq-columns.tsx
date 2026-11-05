"use client";

import { useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type ReactNode } from "react";

/**
 * Hai cột của mục câu hỏi: khung "Hỏi thêm" cao bằng cột câu hỏi lúc mọi câu còn đóng.
 * Mở câu hỏi bên trái chỉ làm cột trái dài ra, khung bên phải giữ nguyên chiều cao đã đo.
 */
export default function FaqColumns({ questions, aside }: { questions: ReactNode; aside: ReactNode }): JSX.Element {
    const left = useRef<HTMLDivElement>(null);
    const [height, setHeight] = useState<number | null>(null);

    useLayoutEffect(() => {
        const node = left.current;
        if (!node) return;
        const measure = (): void => {
            // Chỉ đo khi không câu nào mở, để chiều cao là chiều cao lúc thu gọn.
            if (node.querySelector("details[open]")) return;
            setHeight(node.offsetHeight);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const style = height === null ? undefined : ({ "--faq-h": `${height}px` } as CSSProperties);

    return (
        <div className="grid items-start gap-8 lg:grid-cols-[1.2fr_1fr] lg:gap-12" style={style}>
            <div ref={left}>{questions}</div>
            <div className="flex flex-col rounded-lg bg-green p-6 text-cream shadow-[0_8px_24px_rgba(16,17,17,0.12)] sm:p-8 lg:sticky lg:top-6 lg:min-h-(--faq-h)">
                {aside}
            </div>
        </div>
    );
}
