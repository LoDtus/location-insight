import MapScreen from "@/features/map/components/map-screen";

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    return <MapScreen placeId={id} root="/admin" />;
}
