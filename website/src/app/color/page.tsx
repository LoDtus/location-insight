import type { Metadata } from "next";

import COLOR from "@/shared/constants/color.constant";
import { PRIVATE_ROBOTS } from "@/shared/constants/seo.constant";

export const metadata: Metadata = {
    title: "Color",
    robots: PRIVATE_ROBOTS,
};

const SWATCHES = [
    { name: "primary", value: COLOR.PRIMARY },
    { name: "accent", value: COLOR.ACCENT },
] as const;

export default function Page() {
    return (
        <div>
            {SWATCHES.map((swatch) => (
                <div
                    key={swatch.name}
                    style={{
                        backgroundColor: swatch.value,
                        color: COLOR.ON_PRIMARY,
                        height: 40,
                    }}
                >
                    {swatch.name} {swatch.value}
                </div>
            ))}
        </div>
    );
}
