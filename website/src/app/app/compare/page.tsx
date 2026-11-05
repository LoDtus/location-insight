import type { Metadata } from "next";

import CompareScreen from "@/features/map/compare/compare-screen";

export const metadata: Metadata = { title: "So sánh địa điểm" };

export default function Page() {
    return <CompareScreen />;
}
