import type { Metadata } from "next";

import { FeedbackWorkspace } from "@/features/feedback/components/feedback-workspace";

export const metadata: Metadata = { title: "Góp ý" };

export default function Page() {
    return <FeedbackWorkspace mode="admin" />;
}
