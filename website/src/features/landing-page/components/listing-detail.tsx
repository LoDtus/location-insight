"use client";

import {
    Bath,
    Bed,
    Copy,
    ExternalLink,
    Flag,
    Heart,
    Info,
    MapPin,
    Minus,
    Phone,
    Plus,
    Ruler,
    Share2,
    Shield,
    Sofa,
    X,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";

import {
    LISTINGS,
    formatArea,
    formatListingDate,
    formatListingPrice,
    formatPricePerArea,
    getListingById,
    type Listing,
} from "@/features/landing-page/data/listings";
import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const PHONE_HIDDEN = "0912 345 ***";
const PHONE_SHOWN = "0912 345 678";

function fill(template: string, values: Record<string, string>): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}

function text(messages: Record<string, unknown>, key: string): string {
    return getLocaleValue(messages, ["catalog", "detail", key]);
}

export default function ListingDetail({ id }: { id: string }) {
    const { locale } = useLocale();
    const messages = useLocaleMessages("landing");
    const listing = getListingById(id);
    const [saved, setSaved] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [descriptionOpen, setDescriptionOpen] = useState(false);
    const [shareNote, setShareNote] = useState("");
    const [zoom, setZoom] = useState(1);
    const [analyzed, setAnalyzed] = useState(false);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [reportSent, setReportSent] = useState(false);
    const lightbox = useRef<HTMLDialogElement>(null);
    const report = useRef<HTMLDialogElement>(null);

    if (!listing) {
        return null;
    }

    const price = formatListingPrice(listing, locale);
    const perArea = formatPricePerArea(listing, locale);
    const phone = revealed ? PHONE_SHOWN : PHONE_HIDDEN;
    const code = `${listing.updatedAt.replaceAll("-", "")}-${listing.id.slice(-4)}`;
    const kind = getLocaleValue(messages, ["catalog", "kinds", listing.kind]);
    const purpose = getLocaleValue(messages, [
        "catalog",
        listing.purpose === "ban" ? "purposeBan" : "purposeThue",
    ]);
    const similar = LISTINGS.filter(
        (item) =>
            item.id !== listing.id &&
            item.district === listing.district &&
            item.kind === listing.kind,
    ).slice(0, 3);
    const facts: { label: string; value: string }[] = [
        { label: text(messages, "kind"), value: kind },
        { label: text(messages, "areaLabel"), value: formatArea(listing.areaM2, locale) },
    ];

    if (listing.beds > 0) {
        facts.push({ label: text(messages, "beds"), value: String(listing.beds) });
    }
    if (listing.living > 0) {
        facts.push({ label: text(messages, "living"), value: String(listing.living) });
    }
    if (listing.baths > 0) {
        facts.push({ label: text(messages, "baths"), value: String(listing.baths) });
    }
    facts.push({ label: text(messages, "district"), value: listing.district });

    const specs: { icon: LucideIcon; value: string; hint?: string }[] = [
        {
            icon: Ruler,
            value: formatArea(listing.areaM2, locale),
            hint: text(messages, "area"),
        },
    ];
    if (listing.beds > 0) {
        specs.push({
            icon: Bed,
            value: String(listing.beds),
            hint: getLocaleValue(messages, ["catalog", "specBeds"]),
        });
    }
    if (listing.living > 0) {
        specs.push({
            icon: Sofa,
            value: String(listing.living),
            hint: getLocaleValue(messages, ["catalog", "specLiving"]),
        });
    }
    if (listing.baths > 0) {
        specs.push({
            icon: Bath,
            value: String(listing.baths),
            hint: getLocaleValue(messages, ["catalog", "specBaths"]),
        });
    }

    async function copy(value: string, note: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(value);
            setShareNote(note);
        } catch {
            setShareNote("");
        }
    }

    function openPhoto(index: number): void {
        setPhotoIndex(index);
        lightbox.current?.showModal();
    }

    return (
        <div className="box-border w-full px-4 py-8 pb-28 sm:px-8 lg:pb-16 xl:px-50">
            <Link
                href="/nha-dat"
                className="inline-flex min-h-11 items-center text-sm font-semibold no-underline hover:underline"
            >
                {text(messages, "back")}
            </Link>
            <nav aria-label={text(messages, "breadcrumb")} className="py-2 text-sm text-charcoal/70">
                <ol className="m-0 flex list-none flex-wrap items-center gap-x-2 p-0">
                    <li>
                        <Link href="/" className="inline-flex min-h-8 items-center">
                            {text(messages, "home")}
                        </Link>
                    </li>
                    <li aria-hidden="true">›</li>
                    <li>
                        <Link href="/nha-dat" className="inline-flex min-h-8 items-center">
                            {text(messages, "catalog")}
                        </Link>
                    </li>
                    <li aria-hidden="true">›</li>
                    <li>
                        <Link
                            href={`/nha-dat?district=${encodeURIComponent(listing.district)}`}
                            className="inline-flex min-h-8 items-center"
                        >
                            {listing.district}
                        </Link>
                    </li>
                    <li aria-hidden="true">›</li>
                    <li aria-current="page" className="inline-flex min-h-8 items-center">
                        {listing.title}
                    </li>
                </ol>
            </nav>

            <div className="mt-2 flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
                <div className="contents lg:flex lg:flex-col lg:gap-6">
                    <section aria-label={text(messages, "photos")} className="relative order-1">
                        <div className="grid aspect-video grid-cols-[2fr_1fr] grid-rows-2 gap-2 overflow-hidden rounded-2xl max-md:flex max-md:aspect-auto max-md:snap-x max-md:snap-mandatory max-md:overflow-x-auto">
                            {listing.images.map((src, index) => (
                                <button
                                    key={src}
                                    type="button"
                                    onClick={() => openPhoto(index)}
                                    className={`relative min-h-0 overflow-hidden bg-charcoal p-0 max-md:aspect-[4/3] max-md:w-full max-md:shrink-0 max-md:snap-start ${
                                        index === 0
                                            ? "col-start-1 row-span-2 row-start-1"
                                            : index === 1
                                              ? "col-start-2 row-start-1"
                                              : "col-start-2 row-start-2"
                                    }`}
                                    aria-label={fill(text(messages, "openPhoto"), {
                                        index: String(index + 1),
                                        total: String(listing.images.length),
                                    })}
                                >
                                    <img
                                        src={src}
                                        alt={listing.title}
                                        className="h-full w-full object-cover"
                                    />
                                </button>
                            ))}
                        </div>
                        <button
                            type="button"
                            onClick={() => openPhoto(0)}
                            className="absolute right-4 bottom-4 inline-flex min-h-11 items-center rounded-full border border-charcoal/30 bg-white px-4 text-sm"
                        >
                            {fill(text(messages, "seePhotos"), {
                                count: String(listing.images.length),
                            })}
                        </button>
                    </section>

                    <section className="order-2 rounded-2xl border border-charcoal/15 bg-white p-6 max-sm:p-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-2">
                                <span className="inline-flex min-h-7 items-center rounded-full bg-green px-3 text-[13px] font-semibold text-cream">
                                    {purpose}
                                </span>
                                <span className="inline-flex min-h-7 items-center rounded-full border border-charcoal/30 px-3 text-[13px] font-semibold">
                                    {kind}
                                </span>
                                <span className="inline-flex min-h-7 items-center gap-1 rounded-full bg-green/15 px-3 text-[13px] font-semibold text-green">
                                    <Shield size={14} aria-hidden="true" />
                                    {text(messages, "legalChip")}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    aria-pressed={saved}
                                    onClick={() => setSaved((value) => !value)}
                                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/30 bg-white px-4 text-sm"
                                >
                                    <Heart size={16} aria-hidden="true" />
                                    {saved ? text(messages, "saved") : text(messages, "save")}
                                </button>
                                <button
                                    type="button"
                                    onClick={() =>
                                        void copy(
                                            window.location.href,
                                            text(messages, "copied"),
                                        )
                                    }
                                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-charcoal/30 bg-white px-4 text-sm"
                                >
                                    <Share2 size={16} aria-hidden="true" />
                                    {text(messages, "share")}
                                </button>
                            </div>
                        </div>
                        {shareNote ? (
                            <p className="m-0 mt-2 text-sm text-charcoal/70" role="status">
                                {shareNote}
                            </p>
                        ) : null}
                        <h1 className="m-0 mt-3 text-[28px] leading-tight font-semibold md:text-[32px]">
                            {listing.title}
                        </h1>
                        <a
                            href="#vi-tri"
                            className="mt-2 inline-flex min-h-11 items-start gap-2 py-1 text-charcoal/70 underline decoration-charcoal/30 underline-offset-[3px]"
                        >
                            <MapPin size={18} className="mt-1 shrink-0" aria-hidden="true" />
                            {listing.location}, Hà Nội
                        </a>
                        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                            <p className="m-0 text-[32px] leading-none font-semibold text-green tabular-nums">
                                {price}
                            </p>
                            <p className="m-0 text-[15px] text-charcoal/70">
                                {perArea} · {text(messages, "perAreaNote")}
                            </p>
                        </div>
                        <ul
                            aria-label={text(messages, "specs")}
                            className="m-0 mt-4 flex list-none flex-wrap gap-x-6 gap-y-2 border-t border-charcoal/15 p-0 pt-4"
                        >
                            {specs.map((spec) => (
                                <li key={spec.hint} className="inline-flex items-center gap-2">
                                    <spec.icon size={18} aria-hidden="true" />
                                    <b>{spec.value}</b>
                                    {spec.hint ? (
                                        <span className="text-sm text-charcoal/70">{spec.hint}</span>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section
                        aria-labelledby="mo-ta"
                        className="order-4 rounded-2xl border border-charcoal/15 bg-white p-6 max-sm:p-4"
                    >
                        <h2 id="mo-ta" className="m-0 text-[22px] font-semibold">
                            {text(messages, "description")}
                        </h2>
                        <p
                            className={`m-0 mt-4 max-w-[68ch] text-charcoal ${descriptionOpen ? "" : "line-clamp-6"}`}
                        >
                            {fill(text(messages, "descriptionBody"), {
                                location: listing.location,
                                area: formatArea(listing.areaM2, locale),
                            })}
                        </p>
                        <button
                            type="button"
                            aria-expanded={descriptionOpen}
                            onClick={() => setDescriptionOpen((value) => !value)}
                            className="mt-2 inline-flex min-h-11 items-center bg-transparent p-0 text-sm underline underline-offset-[3px]"
                        >
                            {descriptionOpen
                                ? text(messages, "readLess")
                                : text(messages, "readMore")}
                        </button>
                        <p className="m-0 mt-3 text-sm text-charcoal/60">
                            {fill(text(messages, "code"), { code })}
                            {" · "}
                            {fill(text(messages, "updated"), {
                                date: formatListingDate(listing.updatedAt, locale),
                            })}
                        </p>
                    </section>

                    <section
                        aria-labelledby="dac-diem"
                        className="order-5 rounded-2xl border border-charcoal/15 bg-white p-6 max-sm:p-4"
                    >
                        <h2 id="dac-diem" className="m-0 text-[22px] font-semibold">
                            {text(messages, "facts")}
                        </h2>
                        <h3 className="m-0 mt-4 text-base font-semibold">
                            {text(messages, "structure")}
                        </h3>
                        <dl className="m-0 grid sm:grid-cols-2 sm:gap-x-8">
                            {facts.map((fact) => (
                                <div
                                    key={fact.label}
                                    className="flex justify-between gap-4 border-b border-charcoal/15 py-2.5"
                                >
                                    <dt className="text-charcoal/70">{fact.label}</dt>
                                    <dd className="m-0 text-right font-semibold">{fact.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>

                    <section
                        aria-labelledby="phap-ly-tin"
                        className="order-6 rounded-2xl border border-charcoal/15 bg-white p-6 max-sm:p-4"
                    >
                        <h2 id="phap-ly-tin" className="m-0 text-[22px] font-semibold">
                            {text(messages, "legal")}
                        </h2>
                        <p className="m-0 mt-4 inline-flex min-h-7 items-center gap-1 rounded-full bg-green/15 px-3 text-[13px] font-semibold text-green">
                            <Shield size={14} aria-hidden="true" />
                            {text(messages, "legalChip")}
                        </p>
                        <div className="mt-4 flex gap-3 rounded-xl bg-cream p-4 text-sm">
                            <Info size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <p className="m-0">{text(messages, "legalNote")}</p>
                        </div>
                    </section>

                    <section
                        id="vi-tri"
                        aria-labelledby="vi-tri"
                        className="order-7 scroll-mt-24 rounded-2xl border border-charcoal/15 bg-white p-6 max-sm:p-4"
                    >
                        <h2 id="vi-tri" className="m-0 text-[22px] font-semibold">
                            {text(messages, "location")}
                        </h2>
                        <p className="m-0 mt-2 text-[15px] text-charcoal/70">
                            {listing.location}, Hà Nội
                        </p>
                        <div className="relative mt-4 h-60 overflow-hidden rounded-xl border border-charcoal/15 md:h-[380px]">
                            <img
                                src="/images/temp-001.png"
                                alt=""
                                style={{ transform: `scale(${zoom})` }}
                                className="h-full w-full origin-center object-cover"
                            />
                            <span className="absolute top-[37%] left-[52%] -translate-x-1/2 -translate-y-full drop-shadow">
                                <MapPin size={36} className="fill-green text-cream" aria-hidden="true" />
                            </span>
                            <span className="absolute top-3 left-3 rounded-full border border-charcoal/30 bg-white px-3 py-1 text-[13px] font-semibold">
                                {text(messages, "mapSample")}
                            </span>
                            <div className="absolute top-3 right-3 grid gap-2">
                                <button
                                    type="button"
                                    aria-label={text(messages, "zoomIn")}
                                    onClick={() => setZoom((value) => Math.min(2.2, value + 0.2))}
                                    className="inline-flex size-11 items-center justify-center rounded-full border border-charcoal/30 bg-white"
                                >
                                    <Plus size={18} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    aria-label={text(messages, "zoomOut")}
                                    onClick={() => setZoom((value) => Math.max(1, value - 0.2))}
                                    className="inline-flex size-11 items-center justify-center rounded-full border border-charcoal/30 bg-white"
                                >
                                    <Minus size={18} aria-hidden="true" />
                                </button>
                            </div>
                            <span className="absolute bottom-0 left-0 bg-white/85 px-2 text-[11px]">
                                {text(messages, "mapCredit")}
                            </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4">
                            <Link
                                href="/app/map"
                                className="inline-flex min-h-11 items-center text-sm font-semibold underline underline-offset-[3px]"
                            >
                                {text(messages, "openMap")}
                            </Link>
                            <button
                                type="button"
                                onClick={() =>
                                    void copy(
                                        `${listing.location}, Hà Nội`,
                                        text(messages, "addressCopied"),
                                    )
                                }
                                className="inline-flex min-h-11 items-center gap-1 bg-transparent p-0 text-sm underline underline-offset-[3px]"
                            >
                                <Copy size={16} aria-hidden="true" />
                                {text(messages, "copyAddress")}
                            </button>
                        </div>
                    </section>

                    <section
                        aria-labelledby="phan-tich"
                        className="order-8 rounded-2xl border border-charcoal/15 bg-white p-6 max-sm:p-4"
                    >
                        <h2 id="phan-tich" className="m-0 text-[22px] font-semibold">
                            {text(messages, "analysis")}
                        </h2>
                        <p className="m-0 mt-1 text-sm text-charcoal/60">
                            {text(messages, "analysisSubject")}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="inline-flex min-h-7 items-center rounded-full border border-charcoal/30 px-3 text-[13px]">
                                500 m
                            </span>
                            <span className="inline-flex min-h-7 items-center rounded-full bg-gold/25 px-3 text-[13px] font-semibold">
                                {text(messages, "analysisSample")}
                            </span>
                        </div>
                        {analyzed ? (
                            <p className="m-0 mt-4 max-w-[68ch]" role="status">
                                {text(messages, "analysisDone")}
                            </p>
                        ) : (
                            <>
                                <p className="m-0 mt-4 max-w-[68ch] text-[15px] text-charcoal/70">
                                    {text(messages, "analysisLede")}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => setAnalyzed(true)}
                                    className="mt-4 inline-flex min-h-12 items-center rounded-full bg-green px-6 text-cream"
                                >
                                    {text(messages, "analysisRun")}
                                </button>
                                <p className="m-0 mt-2 text-sm text-charcoal/60">
                                    {text(messages, "analysisHint")}
                                </p>
                            </>
                        )}
                    </section>

                    <section
                        aria-labelledby="bai-viet"
                        className="order-9 rounded-2xl border border-charcoal/15 bg-white p-6 max-sm:p-4"
                    >
                        <h2 id="bai-viet" className="m-0 text-[22px] font-semibold">
                            {text(messages, "posts")}
                        </h2>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <Link
                                href="/phap-ly/tuyen-bo-du-lieu"
                                className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 no-underline"
                            >
                                <img
                                    src="/images/temp-003.jpg"
                                    alt=""
                                    className="h-24 w-full rounded-xl object-cover"
                                />
                                <span>
                                    <span className="block font-semibold">
                                        {text(messages, "postGuide")}
                                    </span>
                                    <span className="mt-1 block text-sm text-charcoal/70">
                                        {text(messages, "postGuideBody")}
                                    </span>
                                </span>
                            </Link>
                            <Link
                                href="/phap-ly/chinh-sach-dang-tin"
                                className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3 no-underline"
                            >
                                <img
                                    src="/images/temp-004.jpg"
                                    alt=""
                                    className="h-24 w-full rounded-xl object-cover"
                                />
                                <span>
                                    <span className="block font-semibold">
                                        {text(messages, "postLegal")}
                                    </span>
                                    <span className="mt-1 block text-sm text-charcoal/70">
                                        {text(messages, "postLegalBody")}
                                    </span>
                                </span>
                            </Link>
                        </div>
                    </section>

                    <section
                        aria-labelledby="lien-ket"
                        className="order-10 rounded-2xl border border-charcoal/15 bg-white p-6 max-sm:p-4"
                    >
                        <h2 id="lien-ket" className="m-0 text-[22px] font-semibold">
                            {text(messages, "links")}
                        </h2>
                        <ul className="m-0 mt-4 list-none p-0">
                            <li className="border-b border-charcoal/15">
                                <Link
                                    href="/app/map"
                                    className="flex min-h-11 items-center justify-between gap-3 py-2 no-underline"
                                >
                                    <span>{text(messages, "linkMap")}</span>
                                    <span className="text-sm text-charcoal/60">
                                        {text(messages, "linkMapNote")}
                                    </span>
                                </Link>
                            </li>
                            <li className="border-b border-charcoal/15">
                                <Link
                                    href={`/nha-dat?district=${encodeURIComponent(listing.district)}`}
                                    className="flex min-h-11 items-center justify-between gap-3 py-2 no-underline"
                                >
                                    <span>
                                        {fill(text(messages, "linkDistrict"), {
                                            district: listing.district,
                                        })}
                                    </span>
                                    <span className="text-sm text-charcoal/60">
                                        {text(messages, "linkDistrictNote")}
                                    </span>
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="https://quyhoach.hanoi.gov.vn/"
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="flex min-h-11 items-center justify-between gap-3 py-2 no-underline"
                                >
                                    <span className="inline-flex items-center gap-2">
                                        <ExternalLink size={16} aria-hidden="true" />
                                        {text(messages, "linkPlan")}
                                    </span>
                                    <span className="text-sm text-charcoal/60">
                                        {text(messages, "linkPlanNote")}
                                    </span>
                                </a>
                            </li>
                        </ul>
                    </section>

                    {similar.length > 0 ? (
                        <SimilarListings
                            listings={similar}
                            locale={locale}
                            title={text(messages, "similar")}
                            note={text(messages, "similarNote")}
                        />
                    ) : null}
                </div>

                <aside
                    aria-label={text(messages, "contact")}
                    className="order-3 lg:sticky lg:top-20"
                >
                    <div id="lien-he" className="rounded-2xl border border-charcoal/15 bg-white p-6">
                        <p className="m-0 text-[28px] font-semibold text-green tabular-nums">
                            {price}
                        </p>
                        <p className="m-0 text-sm text-charcoal/60">
                            {perArea} · {text(messages, "priceNote")}
                        </p>
                        <div className="mt-4 grid gap-2">
                            <a
                                href={revealed ? "tel:0912345678" : "#lien-he"}
                                aria-label={fill(text(messages, "call"), { phone })}
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-green px-6 text-cream no-underline"
                            >
                                <Phone size={18} aria-hidden="true" />
                                {fill(text(messages, "call"), { phone })}
                            </a>
                            <button
                                type="button"
                                onClick={() => setRevealed(true)}
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-charcoal/30 bg-white px-6"
                            >
                                <Phone size={18} aria-hidden="true" />
                                {text(messages, "reveal")}
                            </button>
                            <button
                                type="button"
                                aria-pressed={saved}
                                onClick={() => setSaved((value) => !value)}
                                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-charcoal/30 bg-white px-6"
                            >
                                <Heart size={18} aria-hidden="true" />
                                {saved ? text(messages, "saved") : text(messages, "save")}
                            </button>
                        </div>
                        <div className="mt-4 flex items-center gap-3">
                            <span
                                aria-hidden="true"
                                className="inline-flex size-11 items-center justify-center rounded-full bg-green/15 font-semibold text-green"
                            >
                                ĐT
                            </span>
                            <div>
                                <b>{text(messages, "poster")}</b>
                                <span className="block text-sm text-charcoal/70">
                                    {text(messages, "posterRole")}
                                </span>
                            </div>
                        </div>
                        <p className="m-0 mt-3 text-sm text-charcoal/60">
                            {fill(text(messages, "updated"), {
                                date: formatListingDate(listing.updatedAt, locale),
                            })}
                            {" · "}
                            {fill(text(messages, "code"), { code })}
                        </p>
                        <button
                            type="button"
                            onClick={() => report.current?.showModal()}
                            className="mt-2 inline-flex min-h-11 items-center gap-1 bg-transparent p-0 text-sm underline underline-offset-[3px]"
                        >
                            <Flag size={16} aria-hidden="true" />
                            {text(messages, "report")}
                        </button>
                    </div>
                    <p className="m-0 mt-3 text-sm text-charcoal/60">
                        {text(messages, "disclaimer")}
                    </p>
                </aside>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-charcoal/15 bg-white p-3 lg:hidden">
                <a
                    href={revealed ? "tel:0912345678" : "#lien-he"}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-green px-6 text-cream no-underline"
                >
                    <Phone size={18} aria-hidden="true" />
                    {text(messages, "callBar")}
                </a>
                <button
                    type="button"
                    aria-pressed={saved}
                    aria-label={text(messages, "save")}
                    onClick={() => setSaved((value) => !value)}
                    className="inline-flex size-12 items-center justify-center rounded-full border border-charcoal/30 bg-white"
                >
                    <Heart size={18} aria-hidden="true" />
                </button>
            </div>

            <dialog
                ref={lightbox}
                aria-label={text(messages, "photos")}
                className="m-auto w-[min(960px,calc(100%-2rem))] rounded-2xl border border-charcoal/15 bg-white p-4 backdrop:bg-charcoal/60"
            >
                <div className="flex items-center justify-between">
                    <span>
                        {fill(text(messages, "photoCount"), {
                            current: String(photoIndex + 1),
                            total: String(listing.images.length),
                        })}
                    </span>
                    <button
                        type="button"
                        aria-label={text(messages, "close")}
                        onClick={() => lightbox.current?.close()}
                        className="inline-flex size-11 items-center justify-center rounded-full border border-charcoal/30 bg-white"
                    >
                        <X size={18} aria-hidden="true" />
                    </button>
                </div>
                <img
                    src={listing.images[photoIndex]}
                    alt={listing.title}
                    className="mt-3 max-h-[70vh] w-full rounded-xl object-contain"
                />
                <div className="mt-3 flex justify-between">
                    <button
                        type="button"
                        aria-label={text(messages, "previousPhoto")}
                        onClick={() =>
                            setPhotoIndex(
                                (index) =>
                                    (index - 1 + listing.images.length) % listing.images.length,
                            )
                        }
                        className="inline-flex min-h-11 items-center rounded-full border border-charcoal/30 bg-white px-4"
                    >
                        {text(messages, "previousPhoto")}
                    </button>
                    <button
                        type="button"
                        aria-label={text(messages, "nextPhoto")}
                        onClick={() =>
                            setPhotoIndex((index) => (index + 1) % listing.images.length)
                        }
                        className="inline-flex min-h-11 items-center rounded-full border border-charcoal/30 bg-white px-4"
                    >
                        {text(messages, "nextPhoto")}
                    </button>
                </div>
            </dialog>

            <dialog
                ref={report}
                aria-labelledby="bao-cao"
                className="m-auto w-[min(480px,calc(100%-2rem))] rounded-2xl border border-charcoal/15 bg-white p-6 backdrop:bg-charcoal/60"
            >
                <form
                    method="dialog"
                    className="grid gap-3"
                    onSubmit={() => setReportSent(true)}
                >
                    <div className="flex items-center justify-between">
                        <h2 id="bao-cao" className="m-0 text-[22px] font-semibold">
                            {text(messages, "reportTitle")}
                        </h2>
                        <button
                            type="button"
                            aria-label={text(messages, "close")}
                            onClick={() => report.current?.close()}
                            className="inline-flex size-11 items-center justify-center rounded-full border border-charcoal/30 bg-white"
                        >
                            <X size={18} aria-hidden="true" />
                        </button>
                    </div>
                    <fieldset className="m-0 grid gap-2 border-0 p-0">
                        <legend className="p-0 text-sm text-charcoal/60">
                            {text(messages, "reportReason")}
                        </legend>
                        {(
                            [
                                "reportPrice",
                                "reportSold",
                                "reportPhoto",
                                "reportFraud",
                                "reportOther",
                            ] as const
                        ).map((key, index) => (
                            <label key={key} className="inline-flex min-h-11 items-center gap-2">
                                <input
                                    type="radio"
                                    name="reason"
                                    defaultChecked={index === 0}
                                />
                                {text(messages, key)}
                            </label>
                        ))}
                    </fieldset>
                    <label className="grid gap-1 text-sm text-charcoal/60">
                        {text(messages, "reportNote")}
                        <textarea className="min-h-20 rounded-xl border border-charcoal/30 p-3 text-base text-charcoal" />
                    </label>
                    {reportSent ? (
                        <p className="m-0 text-sm" role="status">
                            {text(messages, "reportSent")}
                        </p>
                    ) : null}
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => report.current?.close()}
                            className="inline-flex min-h-11 items-center rounded-full border border-charcoal/30 bg-white px-4"
                        >
                            {text(messages, "reportCancel")}
                        </button>
                        <button
                            type="submit"
                            className="inline-flex min-h-11 items-center rounded-full bg-green px-4 text-cream"
                        >
                            {text(messages, "reportSend")}
                        </button>
                    </div>
                </form>
            </dialog>
        </div>
    );
}

function SimilarListings({
    listings,
    locale,
    title,
    note,
}: {
    listings: Listing[];
    locale: string;
    title: string;
    note: string;
}) {
    return (
        <section
            aria-labelledby="tuong-tu"
            className="order-11 rounded-2xl border border-charcoal/15 bg-white p-6 max-sm:p-4"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="tuong-tu" className="m-0 text-[22px] font-semibold">
                    {title}
                </h2>
                <span className="text-sm text-charcoal/60">{note}</span>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {listings.map((item) => (
                    <Link
                        key={item.id}
                        href={`/nha-dat/${item.id}`}
                        className="grid gap-2 no-underline"
                    >
                        <img
                            src={item.images[0]}
                            alt=""
                            className="aspect-[4/3] w-full rounded-xl object-cover"
                        />
                        <span className="font-semibold text-green">
                            {formatListingPrice(item, locale)}
                        </span>
                        <span className="font-semibold">{item.title}</span>
                        <span className="text-sm text-charcoal/70">
                            {formatArea(item.areaM2, locale)} · {item.district}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
