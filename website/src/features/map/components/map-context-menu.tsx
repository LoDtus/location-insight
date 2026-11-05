"use client";

import { Copy, Info, Link2, Radar, Route, type LucideIcon } from "lucide-react";
import { useEffect, useRef, type JSX } from "react";

export type ContextAction = "copy-coordinates" | "copy-link" | "directions" | "where" | "nearby";

interface MenuItem {
    id: ContextAction;
    label: string;
    icon: LucideIcon;
    /** Thao tác chính: nằm đầu menu, nền nhấn và ngăn với phần còn lại. */
    primary?: boolean;
}

const ITEMS: readonly MenuItem[] = [
    { id: "where", label: "Xem thông tin địa điểm này", icon: Info, primary: true },
    { id: "directions", label: "Tìm đường tới đây", icon: Route },
    { id: "nearby", label: "Tìm kiếm lân cận", icon: Radar },
    { id: "copy-coordinates", label: "Sao chép tọa độ", icon: Copy },
    { id: "copy-link", label: "Sao chép địa điểm", icon: Link2 },
];

const MENU_WIDTH = 252;
const MENU_HEIGHT = ITEMS.length * 40 + 22;
const EDGE = 8;

interface MapContextMenuProps {
    /** Vị trí con trỏ so với khung bản đồ. */
    at: { x: number; y: number };
    /** Kích thước khung bản đồ để giữ menu trong khung. */
    bounds: { width: number; height: number };
    onSelect: (action: ContextAction) => void;
    onClose: () => void;
}

/** Menu chuột phải của bản đồ; điều hướng bằng phím mũi tên, Esc để đóng. */
export default function MapContextMenu({ at, bounds, onSelect, onClose }: MapContextMenuProps): JSX.Element {
    const ref = useRef<HTMLUListElement>(null);
    const left = Math.max(EDGE, Math.min(at.x, bounds.width - MENU_WIDTH - EDGE));
    const top = Math.max(EDGE, Math.min(at.y, bounds.height - MENU_HEIGHT - EDGE));

    useEffect(() => {
        ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
        function onPointer(event: PointerEvent): void {
            if (!ref.current?.contains(event.target as Node)) onClose();
        }
        document.addEventListener("pointerdown", onPointer, true);
        return () => document.removeEventListener("pointerdown", onPointer, true);
    }, [onClose]);

    function onKeyDown(event: React.KeyboardEvent<HTMLUListElement>): void {
        const buttons = Array.from(ref.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
        const index = buttons.findIndex((button) => button === document.activeElement);
        if (event.key === "Escape") {
            event.preventDefault();
            onClose();
        } else if (event.key === "ArrowDown") {
            event.preventDefault();
            buttons[(index + 1) % buttons.length]?.focus();
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
        } else if (event.key === "Home") {
            event.preventDefault();
            buttons[0]?.focus();
        } else if (event.key === "End") {
            event.preventDefault();
            buttons[buttons.length - 1]?.focus();
        } else if (event.key === "Tab") {
            onClose();
        }
    }

    return (
        <ul
            ref={ref}
            role="menu"
            aria-label="Thao tác tại điểm đã chọn"
            onKeyDown={onKeyDown}
            onContextMenu={(event) => event.preventDefault()}
            style={{ left, top, width: MENU_WIDTH }}
            className="pointer-events-auto absolute z-30 m-0 list-none rounded-lg bg-white p-1.5 shadow-[0_8px_24px_rgba(16,17,17,0.16)] ring-1 ring-charcoal/10"
        >
            {ITEMS.map((item) => (
                <li key={item.id} role="none" className={item.primary ? "mb-1 border-b border-charcoal/10 pb-1" : undefined}>
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => onSelect(item.id)}
                        className={
                            item.primary
                                ? "flex min-h-10 w-full items-center gap-3 rounded-md border-0 bg-green/10 px-3 text-left text-sm font-semibold text-green hover:bg-green/15 focus-visible:bg-green/15 focus-visible:outline-2 focus-visible:outline-green"
                                : "flex min-h-10 w-full items-center gap-3 rounded-md border-0 bg-transparent px-3 text-left text-sm font-medium text-charcoal hover:bg-charcoal/5 focus-visible:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-green"
                        }
                    >
                        <item.icon size={16} aria-hidden className={item.primary ? "" : "text-charcoal/60"} />
                        {item.label}
                    </button>
                </li>
            ))}
        </ul>
    );
}
