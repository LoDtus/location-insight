import type { Metadata } from "next";
import { ReactNode } from "react";

import { PRIVATE_ROBOTS } from "@/shared/constants/seo.constant";

export const metadata: Metadata = {
    robots: PRIVATE_ROBOTS,
};

export default function Layout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="box-border flex h-full min-h-0 items-center justify-center overflow-auto px-4 py-8">
            {children}
        </div>
    );
}
