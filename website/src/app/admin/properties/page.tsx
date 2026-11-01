import { Suspense } from "react";

import PropertyCatalog from "@/features/properties/components/property-catalog";

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <PropertyCatalog root="/admin" />
        </Suspense>
    );
}
