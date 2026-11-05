import { Bookmark, Megaphone, Settings } from "lucide-react";
import Link from "next/link";

interface MapSidebarProps {
    /** Nơi có trang tin rao (`/app` hoặc `/admin`). */
    root: string;
    savedOpen: boolean;
    savedCount: number;
    onSaved: () => void;
    /** Chỉ admin có: mở thẻ mức dùng Vietmap. */
    onSettings?: () => void;
}

const ITEM =
    "relative flex w-full flex-col items-center gap-1 rounded-md bg-transparent px-1 py-1.5 text-center text-charcoal/80 no-underline hover:bg-charcoal/5 hover:text-charcoal focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-green";

export default function MapSidebar({ root, savedOpen, savedCount, onSaved, onSettings }: MapSidebarProps) {
    return (
        <aside
            aria-label="Thao tác bản đồ"
            className="pointer-events-auto flex h-full w-[4.25rem] shrink-0 flex-col items-center border-r border-charcoal/10 bg-white px-1.5 py-3"
        >
            <div className="flex w-full flex-col items-center gap-2">
                <button type="button" aria-pressed={savedOpen} onClick={onSaved} className={`${ITEM} ${savedOpen ? "bg-green/10 text-green" : ""}`}>
                    <Bookmark size={22} strokeWidth={1.75} aria-hidden className={savedOpen ? "fill-green/20" : ""} />
                    <span className="text-[11px] leading-tight">Đã lưu</span>
                    {savedCount > 0 ? (
                        <span className="absolute top-0.5 right-1.5 min-w-4 rounded-full bg-green px-1 text-[10px] leading-4 font-semibold text-cream tabular-nums">
                            {savedCount > 99 ? "99+" : savedCount}
                        </span>
                    ) : null}
                </button>
                <Link href={`${root}/properties`} className={ITEM}>
                    <Megaphone size={22} strokeWidth={1.75} aria-hidden />
                    <span className="text-[11px] leading-tight">Rao bán</span>
                </Link>
            </div>
            {onSettings ? (
                <div className="mt-auto flex w-full flex-col items-center border-t border-charcoal/10 pt-3">
                    <button type="button" className={ITEM} onClick={onSettings}>
                        <Settings size={22} strokeWidth={1.75} aria-hidden />
                        <span className="text-[11px] leading-tight">Cài đặt</span>
                    </button>
                </div>
            ) : null}
        </aside>
    );
}
