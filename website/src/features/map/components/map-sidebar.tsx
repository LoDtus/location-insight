import { Bookmark, Megaphone, Settings } from "lucide-react";

const SIDEBAR_ACTIONS = [
    { id: "saved", label: "Đã lưu", icon: Bookmark },
    { id: "listings", label: "Rao bán", icon: Megaphone },
] as const;

export default function MapSidebar() {
    return (
        <aside
            aria-label="Thao tác bản đồ"
            className="pointer-events-auto flex h-full w-[4.25rem] shrink-0 flex-col items-center border-r border-neutral-200 bg-neutral-50 py-3"
        >
            <div className="flex flex-col items-center gap-5">
                {SIDEBAR_ACTIONS.map((action) => {
                    const Icon = action.icon;

                    return (
                        <button
                            key={action.id}
                            type="button"
                            className="flex w-full flex-col items-center gap-1 px-1 text-center"
                        >
                            <Icon size={22} strokeWidth={1.75} />
                            <span className="text-[11px] leading-tight text-neutral-800">
                                {action.label}
                            </span>
                        </button>
                    );
                })}
            </div>
            <div className="mt-auto flex w-full flex-col items-center border-t border-neutral-200 pt-3">
                <button
                    type="button"
                    className="flex w-full flex-col items-center gap-1 px-1 text-center"
                >
                    <Settings size={22} strokeWidth={1.75} />
                    <span className="text-[11px] leading-tight text-neutral-800">
                        Cài đặt
                    </span>
                </button>
            </div>
        </aside>
    );
}
