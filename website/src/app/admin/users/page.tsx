import { Suspense } from "react";

import UserDirectory from "@/features/admin-users/components/user-directory";

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <UserDirectory />
        </Suspense>
    );
}
