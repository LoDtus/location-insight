import { notFound } from "next/navigation";

import ProfileScreen from "@/features/profile/components/profile-screen";
import { readProfileSegment } from "@/features/profile/profile-path";

export default async function Page({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const { username } = await params;
    const target = readProfileSegment(username);
    if (!target) notFound();
    if (target.kind === "id") {
        return <ProfileScreen root="/admin" userId={target.userId} />;
    }
    return <ProfileScreen root="/admin" username={target.username} />;
}
