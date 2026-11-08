import type { JSX } from "react";

/** Chỉ nhúng hai nguồn máy chủ đã kiểm tra; kiểm tra lại ở đây để một giá trị lạ không bao giờ thành iframe. */
const ALLOWED = /^https:\/\/(www\.youtube-nocookie\.com\/embed\/[A-Za-z0-9_-]{11}|player\.vimeo\.com\/video\/\d{6,12})$/;

export function isSafeVideoEmbed(src: string | null | undefined): src is string {
    return typeof src === "string" && ALLOWED.test(src);
}

/** Video đầu bài (YouTube không cookie / Vimeo), khung 16:9, chặn quyền thừa. */
export default function ArticleVideo({ src, title }: { src: string; title: string }): JSX.Element | null {
    if (!isSafeVideoEmbed(src)) return null;
    return (
        <figure className="m-0 mt-5">
            <div className="relative aspect-video w-full overflow-hidden bg-charcoal">
                <iframe
                    src={src}
                    title={title}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
                    className="absolute inset-0 size-full border-0"
                />
            </div>
        </figure>
    );
}
