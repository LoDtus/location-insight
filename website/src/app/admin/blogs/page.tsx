import { Suspense } from "react";

import ArticleAdminList from "@/features/articles/components/article-admin-list";

export default function Page() {
    return (
        <Suspense fallback={<div className="min-h-full" />}>
            <ArticleAdminList />
        </Suspense>
    );
}
