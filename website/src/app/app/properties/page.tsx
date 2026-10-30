import Image from "next/image";
import Link from "next/link";

import {
    LISTINGS,
    formatArea,
    formatListingPrice,
} from "@/features/landing-page/data/listings";
import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocale } from "@/shared/services/locale.service";
import { getLocaleValue } from "@/shared/utils/locale.utils";
import type { ShellRoot } from "@/features/app/shell";

export async function SaleList({ root }: { root: ShellRoot }) {
    const [locale, messages] = await Promise.all([getLocale(), getLandingMessages()]);
    const sales = LISTINGS.filter((listing) => listing.purpose === "ban").sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
    );
    const vi = locale === "vi";

    return (
        <main className="box-border h-full overflow-auto px-4 py-8 sm:px-8">
            <header className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h1 className="m-0 text-2xl font-semibold">
                        {vi ? "Tin rao bán" : "For sale"}
                    </h1>
                    <p className="mt-1 mb-0 text-sm text-charcoal/75">
                        {vi
                            ? `${sales.length} tin đang rao bán.`
                            : `${sales.length} listings for sale.`}
                    </p>
                </div>
                <Link
                    href={`${root}/map`}
                    className="inline-flex min-h-11 items-center underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                >
                    {vi ? "Mở bản đồ" : "Open the map"}
                </Link>
            </header>
            <ul className="m-0 mt-6 flex list-none flex-col gap-4 p-0">
                {sales.map((listing) => (
                    <li key={listing.id}>
                        <article className="grid overflow-hidden rounded-2xl border border-charcoal/15 bg-white sm:grid-cols-[12rem_minmax(0,1fr)]">
                            <Image
                                src={listing.images[0]}
                                alt=""
                                width={480}
                                height={360}
                                className="aspect-[4/3] h-full w-full object-cover"
                            />
                            <div className="flex flex-col gap-1 p-4">
                                <p className="m-0 text-sm text-charcoal/75">
                                    {getLocaleValue(messages, ["catalog", "kinds", listing.kind])}
                                    {" · "}
                                    {listing.district}
                                </p>
                                <h2 className="m-0 text-lg font-semibold">
                                    <Link
                                        href={`${root}/properties/${listing.slug}`}
                                        className="text-inherit no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                                    >
                                        {listing.title}
                                    </Link>
                                </h2>
                                <p className="m-0 text-sm">{listing.location}</p>
                                <p className="m-0 text-sm font-semibold">
                                    {formatListingPrice(listing, locale)}
                                    {" · "}
                                    {formatArea(listing.areaM2, locale)}
                                </p>
                            </div>
                        </article>
                    </li>
                ))}
            </ul>
        </main>
    );
}

export default function Page() {
    return <SaleList root="/app" />;
}
