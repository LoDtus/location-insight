import { redirect } from "next/navigation";

type PageProps = {
    params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps): Promise<never> {
    const { id } = await params;
    redirect(`/app/feed/${id}`);
}
