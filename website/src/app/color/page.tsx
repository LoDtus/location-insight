import type { Metadata } from "next";

import COLOR from "@/shared/constants/color.constant";
import { PRIVATE_ROBOTS } from "@/shared/constants/seo.constant";

export const metadata: Metadata = {
    title: "Color",
    robots: PRIVATE_ROBOTS,
};

const SWATCHES = [
    {
        name: "Green",
        value: COLOR.GREEN,
        className: "bg-green text-cream",
    },
    {
        name: "White",
        value: COLOR.WHITE,
        className: "bg-white text-charcoal",
    },
    {
        name: "Gold",
        value: COLOR.GOLD,
        className: "bg-gold text-charcoal",
    },
    {
        name: "Soft cream",
        value: COLOR.CREAM,
        className: "bg-cream text-charcoal",
    },
    {
        name: "Charcoal black",
        value: COLOR.CHARCOAL,
        className: "bg-charcoal text-cream",
    },
] as const;

export default function Page() {
    return (
        <div className="box-border flex h-full min-h-0 flex-col gap-4 overflow-auto bg-bg-main p-6 text-text-main">
            {SWATCHES.map((swatch) => (
                <div
                    key={swatch.name}
                    className={`flex h-24 items-center border border-charcoal px-6 ${swatch.className}`}
                >
                    {swatch.name} {swatch.value}
                </div>
            ))}
        </div>
    );
}
