"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import {
    DISTRICTS,
    LISTING_IMAGES,
    LISTING_KINDS,
    type District,
    type ListingKind,
    type ListingPurpose,
} from "@/features/landing-page/data/listings";
import { saveDraft, todayInHanoi, uniqueListingSlug } from "@/features/properties/property-drafts";
import { useLocale } from "@/shared/hooks/useLocale";

const FIELD_CLASS =
    "box-border min-h-11 w-full rounded-full border border-charcoal/20 bg-white px-4 text-sm text-charcoal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";

const KIND_LABEL: Record<ListingKind, { vi: string; en: string }> = {
    "can-ho": { vi: "Căn hộ", en: "Apartment" },
    "nha-pho": { vi: "Nhà phố", en: "Townhouse" },
    "biet-thu": { vi: "Biệt thự", en: "Villa" },
    dat: { vi: "Đất", en: "Land" },
};

export default function NewListingScreen({ root }: { root: ShellRoot }): JSX.Element {
    const router = useRouter();
    const { locale } = useLocale();
    const vi = locale === "vi";
    const [title, setTitle] = useState("");
    const [location, setLocation] = useState("");
    const [district, setDistrict] = useState<District | "">("");
    const [purpose, setPurpose] = useState<ListingPurpose>("ban");
    const [kind, setKind] = useState<ListingKind>("can-ho");
    const [price, setPrice] = useState("");
    const [area, setArea] = useState("");
    const [beds, setBeds] = useState("0");
    const [living, setLiving] = useState("0");
    const [baths, setBaths] = useState("0");
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);

    function text(viText: string, enText: string): string {
        return vi ? viText : enText;
    }

    function publish(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        const nextTitle = title.trim();
        const nextLocation = location.trim();
        const priceVnd = Number(price);
        const areaM2 = Number(area);
        if (nextTitle.length < 3 || nextLocation.length < 3 || !district) {
            setMessage(text("Hãy nhập tiêu đề, địa điểm và khu vực.", "Enter a title, place and area."));
            return;
        }
        if (!Number.isFinite(priceVnd) || priceVnd <= 0 || !Number.isFinite(areaM2) || areaM2 <= 0) {
            setMessage(text("Giá và diện tích cần là số lớn hơn 0.", "Price and area must be numbers above 0."));
            return;
        }
        setPending(true);
        setMessage("");
        const listing = {
            id: crypto.randomUUID(),
            slug: uniqueListingSlug(nextTitle),
            title: nextTitle,
            location: nextLocation,
            district,
            purpose,
            kind,
            priceVnd: Math.round(priceVnd),
            areaM2: Math.round(areaM2),
            beds: Math.max(0, Math.round(Number(beds) || 0)),
            living: Math.max(0, Math.round(Number(living) || 0)),
            baths: Math.max(0, Math.round(Number(baths) || 0)),
            updatedAt: todayInHanoi(),
            images: [...LISTING_IMAGES],
            watchers: 0,
        };
        saveDraft(listing);
        router.push(`${root}/properties/${listing.slug}`);
    }

    return (
        <main className={`box-border h-full overflow-auto px-4 py-8 sm:px-8 ${root === "/admin" ? "bg-white" : "bg-cream"}`}>
            <div className="mx-auto w-full max-w-xl">
                <p className="m-0 text-sm">
                    <Link href={`${root}/properties`} className="font-semibold text-green no-underline">
                        {text("Tin rao bán", "For sale")}
                    </Link>
                </p>
                <h1 className="mt-3 mb-0 text-2xl font-semibold">{text("Đăng tin mới", "New listing")}</h1>
                <p className="mt-2 mb-0 text-sm text-charcoal/75">
                    {text(
                        "Tin hiện trên danh sách của trình duyệt này.",
                        "The listing appears in this browser's list.",
                    )}
                </p>
                <form className="mt-6 grid gap-4" onSubmit={publish}>
                    <label className="grid gap-1 text-sm font-semibold">
                        {text("Tiêu đề", "Title")}
                        <input className={FIELD_CLASS} value={title} maxLength={120} required onChange={(event) => setTitle(event.target.value)} />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                        {text("Địa điểm", "Place")}
                        <input className={FIELD_CLASS} value={location} maxLength={160} required onChange={(event) => setLocation(event.target.value)} />
                    </label>
                    <label className="grid gap-1 text-sm font-semibold">
                        {text("Khu vực", "Area")}
                        <select className={FIELD_CLASS} value={district} required onChange={(event) => setDistrict(event.target.value as District)}>
                            <option value="">{text("Chọn khu vực", "Choose an area")}</option>
                            {DISTRICTS.map((item) => (
                                <option key={item} value={item}>
                                    {item}
                                </option>
                            ))}
                        </select>
                    </label>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold">
                            {text("Hình thức", "Offer")}
                            <select className={FIELD_CLASS} value={purpose} onChange={(event) => setPurpose(event.target.value as ListingPurpose)}>
                                <option value="ban">{text("Bán", "For sale")}</option>
                                <option value="thue">{text("Cho thuê", "For rent")}</option>
                            </select>
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                            {text("Phân loại", "Type")}
                            <select className={FIELD_CLASS} value={kind} onChange={(event) => setKind(event.target.value as ListingKind)}>
                                {LISTING_KINDS.map((item) => (
                                    <option key={item} value={item}>
                                        {text(KIND_LABEL[item].vi, KIND_LABEL[item].en)}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="grid gap-1 text-sm font-semibold">
                            {text("Giá (đồng)", "Price (VND)")}
                            <input className={FIELD_CLASS} inputMode="numeric" value={price} required onChange={(event) => setPrice(event.target.value)} />
                        </label>
                        <label className="grid gap-1 text-sm font-semibold">
                            {text("Diện tích (m²)", "Area (m²)")}
                            <input className={FIELD_CLASS} inputMode="numeric" value={area} required onChange={(event) => setArea(event.target.value)} />
                        </label>
                    </div>
                    <fieldset className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-3">
                        <legend className="mb-1 text-sm font-semibold">{text("Bố trí", "Layout")}</legend>
                        <label className="grid gap-1 text-sm">
                            {text("Phòng ngủ", "Bedrooms")}
                            <input className={FIELD_CLASS} inputMode="numeric" value={beds} onChange={(event) => setBeds(event.target.value)} />
                        </label>
                        <label className="grid gap-1 text-sm">
                            {text("Phòng khách", "Living rooms")}
                            <input className={FIELD_CLASS} inputMode="numeric" value={living} onChange={(event) => setLiving(event.target.value)} />
                        </label>
                        <label className="grid gap-1 text-sm">
                            {text("Phòng tắm", "Bathrooms")}
                            <input className={FIELD_CLASS} inputMode="numeric" value={baths} onChange={(event) => setBaths(event.target.value)} />
                        </label>
                    </fieldset>
                    {message ? (
                        <p role="alert" className="m-0 text-sm">
                            {message}
                        </p>
                    ) : null}
                    <button
                        type="submit"
                        className="inline-flex min-h-11 w-fit items-center rounded-full bg-green px-5 font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        disabled={pending}
                    >
                        {pending ? text("Đang đăng…", "Posting…") : text("Đăng tin", "Post listing")}
                    </button>
                </form>
            </div>
        </main>
    );
}
