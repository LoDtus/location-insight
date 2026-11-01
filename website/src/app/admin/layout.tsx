import type { Metadata } from "next";
import { ReactNode } from "react";

import AppSidebar from "@/features/app/components/app-sidebar";
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
            <div className="flex h-full min-h-0 w-full bg-white text-charcoal">
                <AppSidebar surface="admin" />
                <div id="noi-dung" className="h-full min-h-0 min-w-0 flex-1 overflow-auto">
                    {children}
                </div>
            </div>
        </RequireAdmin>
    );
}
