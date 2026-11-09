import { Suspense } from "react";

import ListingBrowser from "@/features/landing-page/components/listing-browser";

export default function Page() {
    return (
        <main className="box-border h-full overflow-auto bg-white">
            <Suspense fallback={<div className="min-h-full" />}>
                <ListingBrowser app={{ root: "/admin" }} />
            </Suspense>
        </main>
    );
}
