"use client";

import {
    ArrowRight,
    Bath,
    Bed,
    Building2,
    Copy,
    ExternalLink,
    Heart,
    Info,
    MapPin,
    Phone,
    Ruler,
    Share2,
    Shield,
    Sofa,
    type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type JSX, type ReactNode } from "react";

import {
    LISTINGS,
    formatArea,
    formatListingDate,
    formatListingPrice,
    formatPricePerArea,
    getListingByParam,
    listingPath,
    type Listing,
} from "@/features/landing-page/data/listings";
import type { PublicArticle } from "@/features/articles/articles";
import LoginDialog from "@/features/auth/components/login-dialog";
import { useAuth } from "@/features/auth/use-auth";
import ListingPhotoSlider from "@/features/landing-page/components/listing-photo-slider";
import { DISTRICT_CENTERS } from "@/features/landing-page/data/district-centers";
import VietmapView from "@/features/map/components/vietmap-view";
import { formatPhone, telHref } from "@/features/properties/listing-contact";
import {
    DIRECTION_LABEL,
    FURNISHING_LABEL,
    LEGAL_LABEL,
    ROLE_LABEL,
} from "@/features/properties/components/listing-form/option-labels";
import RichTextContent from "@/shared/components/editor/rich-text-content";
import ImageLightbox from "@/shared/components/lightbox/image-lightbox";
import CardSlider from "@/shared/components/slider/card-slider";
import { isRichTextDoc, isRichTextEmpty } from "@/shared/components/editor/rich-text.utils";
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

const SIMILAR_LIMIT = 12;

/** Tin tương tự: cùng quận và cùng loại trước, rồi cùng quận, rồi cùng loại, rồi cùng mục đích. */
function similarListings(listing: Listing): Listing[] {
    const rank = (item: Listing): number =>
        (item.district === listing.district ? 2 : 0) + (item.kind === listing.kind ? 1 : 0) + (item.purpose === listing.purpose ? 0.5 : 0);
    return LISTINGS.filter((item) => item.id !== listing.id && rank(item) >= 1)
        .sort((a, b) => rank(b) - rank(a))
        .slice(0, SIMILAR_LIMIT);
}

/** Bài viết đã đăng mới nhất, lấy qua API công khai; lỗi mạng thì chỉ còn các bài hướng dẫn tĩnh. */
function usePublishedArticles(): PublicArticle[] {
    const [items, setItems] = useState<PublicArticle[]>([]);
    useEffect(() => {
        const controller = new AbortController();
        void fetch("/api/v1/articles", { signal: controller.signal, headers: { accept: "application/json" } })
            .then((response) => (response.ok ? (response.json() as Promise<{ data?: { items?: PublicArticle[] } }>) : null))
            .then((body) => setItems(body?.data?.items ?? []))
            .catch(() => undefined);
        return () => controller.abort();
    }, []);
    return items;
}

export default function ListingDetail({
    id,
    surface = "public",
    listing: provided,
}: {
    id: string;
    surface?: "public" | "app" | "admin";
    listing?: Listing;
}) {
    const { locale } = useLocale();
    const messages = useLocaleMessages("landing");
    const listing = provided ?? getListingByParam(id);
    const [saved, setSaved] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [descriptionOpen, setDescriptionOpen] = useState(false);
    const [shareNote, setShareNote] = useState("");
    const [analyzed, setAnalyzed] = useState(false);
    const [photoIndex, setPhotoIndex] = useState(0);
    const [loginOpen, setLoginOpen] = useState(false);
    const [postsOpen, setPostsOpen] = useState(false);
    const [viewer, setViewer] = useState<number | null>(null);
    const auth = useAuth();
    const articles = usePublishedArticles();

    if (!listing) {
        return null;
    }

    const shell = surface === "admin" ? "/admin" : "/app";
    const signedIn = surface !== "public";
    const catalogHref = signedIn ? `${shell}/properties` : "/nha-dat";
    const homeHref = signedIn ? `${shell}/properties` : "/";
    const districtHref = signedIn
        ? `${shell}/properties`
        : `/nha-dat?district=${encodeURIComponent(listing.district)}`;
    const mapHref = signedIn ? `${shell}/map` : "/app/map";
    const legalDataHref = signedIn ? null : "/phap-ly/tuyen-bo-du-lieu";
    const legalPostHref = signedIn ? null : "/phap-ly/chinh-sach-dang-tin";
    const hrefFor = (item: Pick<Listing, "slug">): string =>
        signedIn ? `${shell}/properties/${item.slug}` : listingPath(item);
    const price = formatListingPrice(listing, locale);
    const perArea = formatPricePerArea(listing, locale);
    const extra = listing.extra;
    const contact = extra?.contact;
    const phone = contact
        ? formatPhone(contact.phone, contact.hidePhone && !revealed)
        : revealed
          ? PHONE_SHOWN
          : PHONE_HIDDEN;
    const callHref = revealed || !contact?.hidePhone ? (contact ? telHref(contact.phone) : "tel:0912345678") : "#lien-he";
    const posterName = contact?.name ?? text(messages, "poster");
    const posterRole = contact
        ? `${locale === "vi" ? ROLE_LABEL[contact.role].vi : ROLE_LABEL[contact.role].en} · ${text(messages, "legalChip").toLowerCase()}`
        : text(messages, "posterRole");
    const posterInitials = contact
        ? contact.name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]?.toUpperCase() ?? "").join("")
        : "ĐT";
    const customDescription = isRichTextDoc(extra?.description) && !isRichTextEmpty(extra?.description) ? extra.description : null;
    const legalKind = extra?.legal ? (locale === "vi" ? LEGAL_LABEL[extra.legal.kind].vi : LEGAL_LABEL[extra.legal.kind].en) : null;
    const code = `${listing.updatedAt.replaceAll("-", "")}-${listing.id.slice(-4)}`;
    const kind = getLocaleValue(messages, ["catalog", "kinds", listing.kind]);
    const purpose = getLocaleValue(messages, [
        "catalog",
        listing.purpose === "ban" ? "purposeBan" : "purposeThue",
    ]);
    const similar = similarListings(listing);
    // Đầu mục cố định có icon; các mục người đăng tự bổ sung qua form (số tầng, hướng…) thì không.
    const facts: { label: string; value: string; icon?: LucideIcon }[] = [
        { label: text(messages, "kind"), value: kind, icon: Building2 },
        { label: text(messages, "areaLabel"), value: formatArea(listing.areaM2, locale), icon: Ruler },
    ];

    if (listing.beds > 0) {
        facts.push({ label: text(messages, "beds"), value: String(listing.beds), icon: Bed });
    }
    if (listing.living > 0) {
        facts.push({ label: text(messages, "living"), value: String(listing.living), icon: Sofa });
    }
    if (listing.baths > 0) {
        facts.push({ label: text(messages, "baths"), value: String(listing.baths), icon: Bath });
    }
    facts.push({ label: text(messages, "district"), value: listing.district, icon: MapPin });
    const vi = locale === "vi";
    const exactPoint = typeof extra?.lat === "number" && typeof extra?.lng === "number";
    const point = exactPoint ? { lat: extra.lat as number, lng: extra.lng as number } : DISTRICT_CENTERS[listing.district];
    if (extra?.floors) facts.push({ label: vi ? "Số tầng" : "Floors", value: String(extra.floors) });
    if (extra?.direction) {
        facts.push({ label: vi ? "Hướng nhà" : "Direction", value: vi ? DIRECTION_LABEL[extra.direction].vi : DIRECTION_LABEL[extra.direction].en });
    }
    if (extra?.balconyDirection) {
        facts.push({ label: vi ? "Hướng ban công" : "Balcony direction", value: vi ? DIRECTION_LABEL[extra.balconyDirection].vi : DIRECTION_LABEL[extra.balconyDirection].en });
    }
    if (extra?.frontageM) facts.push({ label: vi ? "Mặt tiền" : "Frontage", value: `${extra.frontageM} m` });
    if (extra?.roadWidthM) facts.push({ label: vi ? "Đường vào" : "Access road", value: `${extra.roadWidthM} m` });
    if (extra?.furnishing) {
        facts.push({ label: vi ? "Nội thất" : "Furnishing", value: vi ? FURNISHING_LABEL[extra.furnishing].vi : FURNISHING_LABEL[extra.furnishing].en });
    }
    if (extra?.negotiable) facts.push({ label: vi ? "Giá" : "Price", value: vi ? "Có thương lượng" : "Negotiable" });
    if (extra?.depositMonths) {
        facts.push({ label: vi ? "Đặt cọc" : "Deposit", value: vi ? `${extra.depositMonths} tháng` : `${extra.depositMonths} months` });
    }

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

    const posts: { key: string; href: string | null; image: string; title: string; body: string }[] = [
        ...articles.map((article) => ({
            key: article.slug,
            href: `/bai-viet/${article.slug}`,
            image: article.coverImage ?? "/images/temp-003.jpg",
            title: article.title,
            body: article.lede,
        })),
        { key: "guide", href: legalDataHref, image: "/images/temp-003.jpg", title: text(messages, "postGuide"), body: text(messages, "postGuideBody") },
        { key: "legal", href: legalPostHref, image: "/images/temp-004.jpg", title: text(messages, "postLegal"), body: text(messages, "postLegalBody") },
    ];

    async function copy(value: string, note: string): Promise<void> {
        try {
            await navigator.clipboard.writeText(value);
            setShareNote(note);
        } catch {
            setShareNote("");
        }
    }

    /** Khách chưa đăng nhập bấm "Lưu" thì mở hộp đăng nhập; đăng nhập xong thì lưu luôn. */
    function toggleSave(): void {
        if (auth.status !== "authenticated") {
            setLoginOpen(true);
            return;
        }
        setSaved((value) => !value);
    }

    function openPhoto(index: number): void {
        setPhotoIndex(index);
        setViewer(index);
    }

    const card = "rounded-lg border border-charcoal/15 bg-white";
    const heading = "m-0 text-lg font-semibold";
    const ghostButton =
        "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-charcoal/25 bg-white px-3 text-sm font-semibold text-charcoal hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";
    const chip = "inline-flex min-h-6 items-center gap-1 rounded-md px-2 text-xs font-semibold";
    const sellerCard = (
        <div className="flex items-center gap-3">
            <span
                aria-hidden="true"
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-green/15 text-sm font-semibold text-green"
            >
                {posterInitials}
            </span>
            <div className="min-w-0">
                <b className="block truncate">{posterName}</b>
                <span className="block text-xs text-charcoal/70">{posterRole}</span>
            </div>
        </div>
    );

    return (
        <div className="mx-auto box-border w-full max-w-7xl px-4 pt-3 pb-24 sm:px-6 lg:pb-10">
            <nav aria-label={text(messages, "breadcrumb")} className="text-sm text-charcoal/70">
                <ol className="m-0 flex list-none flex-wrap items-center gap-x-1.5 p-0">
                    <li>
                        <Link href={homeHref} className="inline-flex min-h-8 items-center hover:text-charcoal">
                            {text(messages, "home")}
                        </Link>
                    </li>
                    <li aria-hidden="true">›</li>
                    <li>
                        <Link href={catalogHref} className="inline-flex min-h-8 items-center hover:text-charcoal">
                            {text(messages, "catalog")}
                        </Link>
                    </li>
                    <li aria-hidden="true">›</li>
                    <li>
                        <Link href={districtHref} className="inline-flex min-h-8 items-center hover:text-charcoal">
                            {listing.district}
                        </Link>
                    </li>
                    <li aria-hidden="true">›</li>
                    <li aria-current="page" className="inline-flex min-h-8 max-w-[40ch] items-center truncate text-charcoal">
                        {listing.title}
                    </li>
                </ol>
            </nav>

            {/* Hàng sản phẩm: ảnh bên trái, khung mua hàng bên phải. */}
            <div className={`${card} mt-2 grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-6`}>
                <section aria-label={text(messages, "photos")} className="min-w-0">
                    <ListingPhotoSlider
                        images={listing.images}
                        title={listing.title}
                        index={photoIndex}
                        onIndexChange={setPhotoIndex}
                        onOpen={openPhoto}
                        openLabel={(index) =>
                            fill(text(messages, "openPhoto"), { index: String(index + 1), total: String(listing.images.length) })
                        }
                        previousLabel={text(messages, "previousPhoto")}
                        nextLabel={text(messages, "nextPhoto")}
                    />
                    <div className="mt-2 flex gap-2 overflow-x-auto">
                        {listing.images.map((src, index) => (
                            <button
                                key={src}
                                type="button"
                                onClick={() => setPhotoIndex(index)}
                                aria-label={fill(text(messages, "openPhoto"), {
                                    index: String(index + 1),
                                    total: String(listing.images.length),
                                })}
                                aria-pressed={index === photoIndex}
                                className={`size-16 shrink-0 overflow-hidden rounded-md border-2 bg-charcoal p-0 sm:size-20 ${index === photoIndex ? "border-green" : "border-transparent opacity-80 hover:opacity-100"}`}
                            >
                                <img src={src} alt="" className="h-full w-full object-cover" />
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() => openPhoto(0)}
                            className={`${ghostButton} h-16 shrink-0 sm:h-20`}
                        >
                            {fill(text(messages, "seePhotos"), { count: String(listing.images.length) })}
                        </button>
                    </div>
                </section>

                <section id="lien-he" aria-label={text(messages, "contact")} className="flex min-w-0 flex-col">
                    <div className="flex flex-wrap gap-1.5">
                        <span className={`${chip} bg-green text-cream`}>{purpose}</span>
                        <span className={`${chip} border border-charcoal/25`}>{kind}</span>
                        <span className={`${chip} bg-green/15 text-green`}>
                            <Shield size={12} aria-hidden="true" />
                            {text(messages, "legalChip")}
                        </span>
                    </div>
                    <h1 className="m-0 mt-2 text-xl leading-snug font-semibold text-balance md:text-2xl">{listing.title}</h1>
                    <a
                        href="#vi-tri"
                        className="mt-1 inline-flex items-start gap-1.5 text-sm text-charcoal/70 underline decoration-charcoal/30 underline-offset-[3px] hover:text-charcoal"
                    >
                        <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                        {listing.location}, Hà Nội
                    </a>
                    <p className="m-0 mt-1 text-xs text-charcoal/60">
                        {fill(text(messages, "code"), { code })}
                        {" · "}
                        {fill(text(messages, "updated"), { date: formatListingDate(listing.updatedAt, locale) })}
                    </p>

                    <div className="mt-3 rounded-md bg-white px-3 py-2.5">
                        <p className="m-0 text-3xl leading-none font-semibold text-green tabular-nums">{price}</p>
                        <p className="m-0 mt-1 text-sm text-charcoal/70">
                            {perArea} · {text(messages, "perAreaNote")}
                        </p>
                    </div>

                    <ul
                        aria-label={text(messages, "specs")}
                        className="m-0 mt-3 grid list-none grid-cols-2 gap-px overflow-hidden rounded-md border border-charcoal/15 bg-charcoal/15 p-0 sm:grid-cols-4"
                    >
                        {specs.map((spec) => (
                            <li key={spec.hint} className="flex items-center gap-2 bg-white px-3 py-2">
                                <spec.icon size={16} className="shrink-0 text-charcoal/60" aria-hidden="true" />
                                <span className="min-w-0">
                                    <b className="block text-sm tabular-nums">{spec.value}</b>
                                    {spec.hint ? <span className="block truncate text-xs text-charcoal/60">{spec.hint}</span> : null}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <a
                            href={callHref}
                            aria-label={fill(text(messages, "call"), { phone })}
                            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-green px-4 text-sm font-semibold text-cream no-underline hover:bg-green/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green sm:col-span-2"
                        >
                            <Phone size={16} aria-hidden="true" />
                            {fill(text(messages, "call"), { phone })}
                        </a>
                        <button type="button" onClick={() => setRevealed(true)} className={ghostButton}>
                            <Phone size={16} aria-hidden="true" />
                            {text(messages, "reveal")}
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <button type="button" aria-pressed={saved} onClick={toggleSave} className={ghostButton}>
                                <Heart size={16} aria-hidden="true" className={saved ? "fill-current text-green" : ""} />
                                {saved ? text(messages, "saved") : text(messages, "save")}
                            </button>
                            <button
                                type="button"
                                onClick={() => void copy(window.location.href, text(messages, "copied"))}
                                className={ghostButton}
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

                    <div className="mt-3 border-t border-charcoal/15 pt-3">{sellerCard}</div>
                </section>
            </div>

            <div className="mt-3 grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
                <div className="grid min-w-0 gap-3">
                    <section aria-labelledby="mo-ta" className={`${card} p-4 sm:p-5`}>
                        <h2 id="mo-ta" className={heading}>
                            {text(messages, "description")}
                        </h2>
                        {customDescription ? (
                            <div className={`mt-2 max-w-[72ch] ${descriptionOpen ? "" : "max-h-40 overflow-hidden"}`}>
                                <RichTextContent doc={customDescription} />
                            </div>
                        ) : (
                            <p className={`m-0 mt-2 max-w-[72ch] text-[15px] leading-relaxed ${descriptionOpen ? "" : "line-clamp-6"}`}>
                                {fill(text(messages, "descriptionBody"), {
                                    location: listing.location,
                                    area: formatArea(listing.areaM2, locale),
                                })}
                            </p>
                        )}
                        <button
                            type="button"
                            aria-expanded={descriptionOpen}
                            onClick={() => setDescriptionOpen((value) => !value)}
                            className="mt-1 inline-flex min-h-9 items-center bg-transparent p-0 text-sm font-semibold text-green"
                        >
                            {descriptionOpen ? text(messages, "readLess") : text(messages, "readMore")}
                        </button>
                    </section>

                    <section aria-labelledby="dac-diem" className={`${card} p-4 sm:p-5`}>
                        <h2 id="dac-diem" className={heading}>
                            {text(messages, "facts")}
                        </h2>
                        <dl className="m-0 mt-2 grid overflow-hidden rounded-md border border-charcoal/15 text-sm sm:grid-cols-2">
                            {facts.map((fact) => (
                                <div key={fact.label} className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] border-b border-charcoal/10 sm:odd:border-r">
                                    <dt className="flex items-center gap-2 bg-white px-3 py-2 text-charcoal/70">
                                        {fact.icon ? <fact.icon size={16} className="shrink-0 text-charcoal/55" aria-hidden="true" /> : null}
                                        {fact.label}
                                    </dt>
                                    <dd className="m-0 px-3 py-2 font-semibold">{fact.value}</dd>
                                </div>
                            ))}
                        </dl>
                    </section>

                    <section id="vi-tri" aria-labelledby="vi-tri-tieu-de" className={`${card} scroll-mt-24 p-4 sm:p-5`}>
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <h2 id="vi-tri-tieu-de" className={heading}>
                                {text(messages, "location")}
                            </h2>
                            <p className="m-0 text-sm text-charcoal/70">{listing.location}, Hà Nội</p>
                        </div>
                        <div className="relative mt-2">
                            <VietmapView
                                center={point}
                                zoom={exactPoint ? 17 : 14}
                                label={text(messages, "location")}
                                className="h-64 rounded-md border border-charcoal/15 md:h-96"
                            />
                            {exactPoint ? null : (
                                <span className="pointer-events-none absolute top-2 left-2 rounded-md border border-charcoal/20 bg-white px-2 py-0.5 text-xs font-semibold">
                                    {vi ? `Vị trí gần đúng: ${listing.district}` : `Approximate: ${listing.district}`}
                                </span>
                            )}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <Link href={mapHref} className={`${ghostButton} no-underline`}>
                                <MapPin size={16} aria-hidden="true" />
                                {text(messages, "openMap")}
                            </Link>
                            <button
                                type="button"
                                onClick={() => void copy(`${listing.location}, Hà Nội`, text(messages, "addressCopied"))}
                                className={ghostButton}
                            >
                                <Copy size={16} aria-hidden="true" />
                                {text(messages, "copyAddress")}
                            </button>
                        </div>
                    </section>

                    <section aria-labelledby="phan-tich" className={`${card} p-4 sm:p-5`}>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 id="phan-tich" className={heading}>
                                {text(messages, "analysis")}
                            </h2>
                            <span className={`${chip} border border-charcoal/25`}>500 m</span>
                            <span className={`${chip} bg-gold/25`}>{text(messages, "analysisSample")}</span>
                        </div>
                        <p className="m-0 mt-1 text-sm text-charcoal/60">{text(messages, "analysisSubject")}</p>
                        {analyzed ? (
                            <p className="m-0 mt-2 max-w-[72ch] text-sm" role="status">
                                {text(messages, "analysisDone")}
                            </p>
                        ) : (
                            <div className="mt-2 flex flex-wrap items-center gap-3">
                                <p className="m-0 max-w-[60ch] flex-1 text-sm text-charcoal/75">{text(messages, "analysisLede")}</p>
                                <button
                                    type="button"
                                    onClick={() => setAnalyzed(true)}
                                    className="inline-flex min-h-10 items-center rounded-md bg-green px-4 text-sm font-semibold text-cream hover:bg-green/90"
                                >
                                    {text(messages, "analysisRun")}
                                </button>
                                <p className="m-0 basis-full text-xs text-charcoal/60">{text(messages, "analysisHint")}</p>
                            </div>
                        )}
                    </section>

                    <section aria-labelledby="phap-ly-tin" className={`${card} p-4 sm:p-5`}>
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 id="phap-ly-tin" className={heading}>
                                {text(messages, "legal")}
                            </h2>
                            <span className={`${chip} bg-green/15 text-green`}>
                                <Shield size={12} aria-hidden="true" />
                                {text(messages, "legalChip")}
                            </span>
                        </div>
                        {legalKind ? (
                            <p className="m-0 mt-2 text-sm font-semibold">
                                {legalKind}
                                {extra?.legal?.note ? <span className="block font-normal text-charcoal/80">{extra.legal.note}</span> : null}
                            </p>
                        ) : null}
                        <div className="mt-2 flex gap-2 rounded-md bg-white p-3 text-sm">
                            <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                            <p className="m-0">{text(messages, "legalNote")}</p>
                        </div>
                    </section>

                    <section aria-labelledby="bai-viet" className={`${card} p-4 sm:p-5`}>
                        <h2 id="bai-viet" className={heading}>
                            {text(messages, "posts")}
                        </h2>
                        {/* Thu gọn: tối đa 2 dòng (2 bài trên điện thoại, 4 bài khi lưới 2 cột). */}
                        <ul className="m-0 mt-2 grid list-none gap-3 p-0 md:grid-cols-2">
                            {posts.map((post, index) => (
                                <li key={post.key} className={postsOpen ? "" : index >= 4 ? "hidden" : index >= 2 ? "max-md:hidden" : ""}>
                                    <StayLink
                                        href={post.href}
                                        className="grid h-full grid-cols-[6rem_minmax(0,1fr)] gap-3 rounded-md p-1 text-inherit no-underline hover:bg-charcoal/5"
                                    >
                                        <img src={post.image} alt="" loading="lazy" className="h-20 w-full rounded-md object-cover" />
                                        <span className="min-w-0">
                                            <span className="line-clamp-2 block text-sm font-semibold">{post.title}</span>
                                            <span className="mt-0.5 line-clamp-2 block text-xs text-charcoal/70">{post.body}</span>
                                        </span>
                                    </StayLink>
                                </li>
                            ))}
                        </ul>
                        {posts.length > 2 ? (
                            <button
                                type="button"
                                aria-expanded={postsOpen}
                                onClick={() => setPostsOpen((value) => !value)}
                                className={`mt-2 inline-flex min-h-9 items-center bg-transparent p-0 text-sm font-semibold text-green ${posts.length <= 4 ? "md:hidden" : ""}`}
                            >
                                {postsOpen ? (vi ? "Thu gọn" : "Show less") : vi ? "Xem thêm" : "Show more"}
                            </button>
                        ) : null}
                    </section>
                </div>

                <aside className="grid gap-3 lg:sticky lg:top-4">
                    <section aria-labelledby="nguoi-dang" className={`${card} p-4`}>
                        <h2 id="nguoi-dang" className="m-0 mb-2 text-sm font-semibold text-charcoal/70">
                            {text(messages, "contact")}
                        </h2>
                        {sellerCard}
                        <a
                            href={callHref}
                            className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md bg-green px-4 text-sm font-semibold text-cream no-underline hover:bg-green/90"
                        >
                            <Phone size={16} aria-hidden="true" />
                            {text(messages, "callBar")}
                        </a>
                    </section>
                    <section aria-labelledby="lien-ket" className={`${card} p-4`}>
                        <h2 id="lien-ket" className="m-0 mb-1 text-sm font-semibold text-charcoal/70">
                            {text(messages, "links")}
                        </h2>
                        <ul className="m-0 list-none p-0 text-sm">
                            <li className="border-b border-charcoal/10">
                                <Link href={mapHref} className="flex min-h-10 flex-col justify-center py-1.5 text-inherit no-underline hover:text-green">
                                    <span className="font-semibold">{text(messages, "linkMap")}</span>
                                    <span className="text-xs text-charcoal/60">{text(messages, "linkMapNote")}</span>
                                </Link>
                            </li>
                            <li className="border-b border-charcoal/10">
                                <Link href={districtHref} className="flex min-h-10 flex-col justify-center py-1.5 text-inherit no-underline hover:text-green">
                                    <span className="font-semibold">{fill(text(messages, "linkDistrict"), { district: listing.district })}</span>
                                    <span className="text-xs text-charcoal/60">{text(messages, "linkDistrictNote")}</span>
                                </Link>
                            </li>
                            <li>
                                <a
                                    href="https://quyhoach.hanoi.gov.vn/"
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="flex min-h-10 flex-col justify-center py-1.5 text-inherit no-underline hover:text-green"
                                >
                                    <span className="inline-flex items-center gap-1.5 font-semibold">
                                        <ExternalLink size={14} aria-hidden="true" />
                                        {text(messages, "linkPlan")}
                                    </span>
                                    <span className="text-xs text-charcoal/60">{text(messages, "linkPlanNote")}</span>
                                </a>
                            </li>
                        </ul>
                    </section>
                    <p className="m-0 px-1 text-xs text-charcoal/60">{text(messages, "disclaimer")}</p>
                </aside>
            </div>

            {similar.length > 0 ? (
                <SimilarListings
                    listings={similar}
                    locale={locale}
                    title={text(messages, "similar")}
                    note={text(messages, "similarNote")}
                    hrefFor={hrefFor}
                    vi={vi}
                />
            ) : null}

            <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-charcoal/15 bg-white p-2.5 lg:hidden">
                <a
                    href={callHref}
                    className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md bg-green px-4 text-sm font-semibold text-cream no-underline"
                >
                    <Phone size={16} aria-hidden="true" />
                    {text(messages, "callBar")}
                </a>
                <button
                    type="button"
                    aria-pressed={saved}
                    aria-label={text(messages, "save")}
                    onClick={toggleSave}
                    className="inline-flex size-11 items-center justify-center rounded-md border border-charcoal/25 bg-white"
                >
                    <Heart size={16} aria-hidden="true" className={saved ? "fill-current text-green" : ""} />
                </button>
            </div>

            <LoginDialog
                open={loginOpen}
                reason={vi ? "Đăng nhập để lưu tin này và xem lại trong tài khoản." : "Sign in to save this listing to your account."}
                onClose={() => setLoginOpen(false)}
                onSignedIn={() => setSaved(true)}
            />

            {viewer !== null ? (
                <ImageLightbox
                    images={listing.images.map((src, index) => ({ src, alt: `${listing.title} – ${index + 1}` }))}
                    start={viewer}
                    label={text(messages, "photos")}
                    onIndexChange={setPhotoIndex}
                    onClose={() => setViewer(null)}
                />
            ) : null}
        </div>
    );
}

function StayLink({
    href,
    className,
    children,
}: {
    href: string | null;
    className: string;
    children: ReactNode;
}): JSX.Element {
    if (href === null) {
        return <div className={className}>{children}</div>;
    }

    return (
        <Link href={href} className={className}>
            {children}
        </Link>
    );
}

function SimilarListings({
    listings,
    locale,
    title,
    note,
    hrefFor,
    vi,
}: {
    listings: Listing[];
    locale: string;
    title: string;
    note: string;
    hrefFor: (item: Pick<Listing, "slug">) => string;
    vi: boolean;
}) {
    return (
        <section aria-labelledby="tuong-tu" className="mt-3 rounded-lg border border-charcoal/15 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <h2 id="tuong-tu" className="m-0 text-lg font-semibold">
                        {title}
                    </h2>
                    <span className="text-sm text-charcoal/60">{note}</span>
                </div>
                <Link
                    href="/bai-viet"
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-charcoal/25 px-3 text-sm font-semibold text-charcoal no-underline hover:bg-charcoal/5"
                >
                    {vi ? "Xem thêm" : "See more"}
                    <ArrowRight size={16} aria-hidden="true" />
                </Link>
            </div>
            <div className="mt-3">
                <CardSlider
                    label={title}
                    previousLabel={vi ? "Tin trước" : "Previous listings"}
                    nextLabel={vi ? "Tin sau" : "Next listings"}
                    breakpoints={{
                        0: { slidesPerView: 1.6, spaceBetween: 12 },
                        640: { slidesPerView: 3, spaceBetween: 12 },
                        1024: { slidesPerView: 4, spaceBetween: 12 },
                        1280: { slidesPerView: 5, spaceBetween: 12 },
                    }}
                    slides={listings.map((item) => ({
                        key: item.id,
                        node: (
                            <Link
                                href={hrefFor(item)}
                                className="grid h-full content-start gap-1 overflow-hidden rounded-md border border-charcoal/15 pb-2 text-inherit no-underline hover:border-charcoal/30"
                            >
                                <img src={item.images[0]} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />
                                <span className="line-clamp-2 px-2 text-sm font-semibold">{item.title}</span>
                                <span className="px-2 font-semibold text-green tabular-nums">{formatListingPrice(item, locale)}</span>
                                <span className="px-2 text-xs text-charcoal/70">
                                    {formatArea(item.areaM2, locale)} · {item.district}
                                </span>
                            </Link>
                        ),
                    }))}
                />
            </div>
        </section>
    );
}
