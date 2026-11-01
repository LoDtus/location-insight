import { notFound } from "next/navigation";

import ProfileScreen from "@/features/profile/components/profile-screen";

export default async function Page({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const { username } = await params;
    const handle = decodeURIComponent(username).replace(/^@/, "");
    if (!handle) notFound();
    return <ProfileScreen root="/admin" username={handle} />;
}
