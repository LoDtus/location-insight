import ProfileScreen from "@/features/profile/components/profile-screen";

export default async function Page({
    params,
}: {
    params: Promise<{ username: string }>;
}) {
    const { username } = await params;
    return <ProfileScreen root="/app" username={username} />;
}
