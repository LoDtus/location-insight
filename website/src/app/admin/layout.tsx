import type { Metadata } from "next";
import { ReactNode } from "react";

import { RequireAdmin } from "@/features/auth/route-gate";
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
        <RequireAdmin>
            <div>{children}</div>
        </RequireAdmin>
    );
}
