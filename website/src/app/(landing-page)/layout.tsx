import type { Metadata } from "next";
import { ReactNode } from "react";

import { INDEXABLE_ROBOTS } from "@/shared/constants/seo.constant";

export const metadata: Metadata = {
    robots: INDEXABLE_ROBOTS,
};

export default function Layout({
    children,
}: {
    children: ReactNode;
}) {
    return <div>{children}</div>;
}
