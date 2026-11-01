import type { JSX } from "react";

import { initials } from "../messaging.format";

export function PersonAvatar({
    name,
    url,
    size = 48,
}: {
    name: string;
    url: string | null;
    size?: number;
}): JSX.Element {
    const style = { width: size, height: size, fontSize: Math.round(size * 0.4) };
    if (url) {
        // Ảnh đại diện nằm ở nguồn ngoài và có thể là liên kết ký.
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={url} alt="" style={style} className="shrink-0 rounded-full object-cover" />;
    }
    return (
        <span
            style={style}
            aria-hidden="true"
            className="flex shrink-0 items-center justify-center rounded-full bg-green font-semibold text-cream"
        >
            {initials(name)}
        </span>
    );
}
