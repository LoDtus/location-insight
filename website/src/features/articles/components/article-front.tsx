"use client";

import { ChevronLeft, ChevronRight, Eye, Hash, Heart, Images, MessageCircle, Play, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent, type JSX, type MouseEvent, type ReactNode, type RefObject } from "react";

import { listRecommendedForMe } from "@/features/articles/articles.api";
import type { ArticleCard, ArticleHome } from "@/features/articles/articles";
import { FRONT_SECTIONS, isFresh, relativeTime, type FrontSectionId } from "@/features/articles/front-sections";
import { useAuth } from "@/features/auth/use-auth";
import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";
import SectionPager from "./front/section-pager";
import { usePagedSection, type PagedSection } from "./front/use-paged-section";
import { useSectionSpy } from "./front/use-section-spy";

/**
 * Trang /bai-viet kiểu trang nhất báo lớn. Mỗi mục là MỘT hàng riêng, có neo #id (URL đổi theo mục đang đọc, thanh
 * mục dính đánh dấu mục hiện tại) và một bố cục riêng để người đọc nhận ra mình đang ở đâu khi lướt:
 * - #tieu-diem: bài dẫn lớn + cột bài phụ có ảnh nhỏ.
 * - #moi-nhat: dòng tin theo giờ (cột giờ đăng | tít + sapo), hai cột, không ảnh, phân trang.
 * - #noi-bat: bảng xếp hạng đánh số lớn, số hạng nối tiếp qua các trang.
 * - #de-xuat: băng trượt ngang thẻ ảnh (cuộn chạm, nút trước/tiếp).
 * - #video-anh: dải nền tối, một bài lớn + danh sách ảnh nhỏ, phân trang.
 * - #duoc-quan-tam: lưới bento, bài dẫn phủ ảnh + các ô lấy số bình luận làm điểm nhấn, phân trang.
 * - #chu-de: bốn cột theo chủ đề, lối "Xem thêm" sang trang lọc.
 */

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";
const LINK = `text-inherit no-underline hover:underline decoration-1 underline-offset-[3px] ${FOCUS}`;
/** Lề ngang của trang; dải tràn viền (thanh mục, Video / Ảnh) dùng lề âm tương ứng. */
const GUTTER = "px-4 sm:px-8 xl:px-50";
const BLEED = "-mx-4 px-4 sm:-mx-8 sm:px-8 xl:-mx-50 xl:px-50";

type Text = (path: string[]) => string;

function useText(): Text {
    const landing = useLocaleMessages("landing");
    return useCallback((path: string[]) => getLocaleValue(landing, path), [landing]);
}

function fill(template: string, count: number, locale: string): string {
    return template.replace("{count}", new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", { notation: count >= 10_000 ? "compact" : "standard" }).format(count));
}

type Dates = { tag: string; long: (iso: string) => string; time: (iso: string) => string; today: string; now: number };

function useDates(): Dates {
    const { locale } = useLocale();
    const tag = locale === "en" ? "en-GB" : "vi-VN";
    const zone = "Asia/Ho_Chi_Minh";
    const long = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric", timeZone: zone });
    const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: zone });
    const today = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: zone });
    const [now] = useState(() => Date.now());
    return { tag, long: (iso) => long.format(new Date(iso)), time: (iso) => time.format(new Date(iso)), today: today.format(new Date(now)), now };
}

function href(card: ArticleCard): string {
    return `/bai-viet/${card.slug}`;
}

/* ---------------- Mảnh dùng chung ---------------- */

function FormatBadge({ card, text }: { card: ArticleCard; text: Text }): JSX.Element | null {
    if (card.format === "video") {
        return (
            <span className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-black/60 text-white ring-2 ring-white/80">
                    <Play size={20} className="translate-x-px fill-current" aria-hidden />
                    <span className="sr-only">{text(["articles", "front", "video"])}</span>
                </span>
            </span>
        );
    }
    if (card.format === "photo") {
        return (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 font-sans text-[11px] font-semibold text-white">
                <Images size={12} aria-hidden /> {text(["articles", "front", "photo"])}
            </span>
        );
    }
    return null;
}

/** Ảnh bìa (chỉ khi bài có ảnh). Ảnh nằm trong liên kết ẩn khỏi bàn phím: tít bên cạnh đã là liên kết chính. */
function Cover({ card, sizes, priority = false, className = "", text }: { card: ArticleCard; sizes: string; priority?: boolean; className?: string; text: Text }): JSX.Element | null {
    if (!card.coverImage?.startsWith("/")) return null;
    return (
        <Link href={href(card)} tabIndex={-1} aria-hidden className={`relative block overflow-hidden bg-charcoal/[0.06] ${className}`}>
            <Image src={card.coverImage} alt="" fill sizes={sizes} priority={priority} className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
            <FormatBadge card={card} text={text} />
        </Link>
    );
}

/** Dòng phụ: chủ đề · thời điểm · phút đọc. */
function Meta({ card, text, dates, dark = false, extra }: { card: ArticleCard; text: Text; dates: Dates; dark?: boolean; extra?: ReactNode }): JSX.Element {
    const { locale } = useLocale();
    const relative = relativeTime(card.publishedAt, dates.now, dates.tag);
    return (
        <p className={`m-0 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-sans text-xs ${dark ? "text-cream/70" : "text-charcoal/60"}`}>
            <span className={`font-semibold whitespace-nowrap ${dark ? "text-gold" : "text-green"}`}>{text(["articles", "topics", card.topic])}</span>
            <time dateTime={card.publishedAt} title={dates.long(card.publishedAt)} className="whitespace-nowrap" suppressHydrationWarning>
                {relative ?? dates.long(card.publishedAt)}
            </time>
            {card.readingMinutes ? <span className="whitespace-nowrap">{fill(text(["articles", "front", "readMinutes"]), card.readingMinutes, locale)}</span> : null}
            {extra}
        </p>
    );
}

function Headline({ card, as: Tag = "h3", className, dark = false }: { card: ArticleCard; as?: "h2" | "h3" | "h4"; className: string; dark?: boolean }): JSX.Element {
    return (
        <Tag className={`m-0 font-serif font-bold text-balance ${className}`}>
            <Link href={href(card)} className={`${LINK} ${dark ? "text-cream" : ""}`}>
                {card.title}
            </Link>
        </Tag>
    );
}

/** Khung một mục: hàng riêng, neo #id, tiêu đề có liên kết "#" để chép đường dẫn tới mục. */
function Section({
    id,
    title,
    hint,
    action,
    dark = false,
    go,
    text,
    className = "",
    children,
}: {
    id: FrontSectionId;
    title: string;
    hint?: string;
    action?: ReactNode;
    dark?: boolean;
    go: (id: FrontSectionId) => void;
    text: Text;
    className?: string;
    children: ReactNode;
}): JSX.Element {
    const headingId = `${id}-tieu-de`;
    function jump(event: MouseEvent<HTMLAnchorElement>): void {
        event.preventDefault();
        go(id);
    }
    return (
        <section id={id} aria-labelledby={headingId} className={className}>
            <div className={`mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-t-2 pt-2 ${dark ? "border-cream/80" : "border-charcoal"}`}>
                <div className="min-w-0">
                    <h2 id={headingId} className="group/anchor m-0 flex items-center gap-2 font-serif text-2xl font-bold tracking-tight sm:text-[1.75rem]">
                        {title}
                        <a
                            href={`#${id}`}
                            onClick={jump}
                            aria-label={text(["articles", "front", "anchor"]).replace("{name}", title)}
                            className={`inline-flex size-7 items-center justify-center rounded opacity-0 transition-opacity group-hover/anchor:opacity-100 focus-visible:opacity-100 motion-reduce:transition-none ${dark ? "text-cream/70 hover:text-cream" : "text-charcoal/45 hover:text-green"} ${FOCUS}`}
                        >
                            <Hash size={17} aria-hidden />
                        </a>
                    </h2>
                    {hint ? <p className={`m-0 mt-0.5 font-sans text-sm ${dark ? "text-cream/70" : "text-charcoal/60"}`}>{hint}</p> : null}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function MoreLink({ to, label, dark = false }: { to: string; label: string; dark?: boolean }): JSX.Element {
    return (
        <Link href={to} className={`inline-flex min-h-10 items-center gap-0.5 font-sans text-sm font-semibold no-underline hover:underline ${dark ? "text-cream" : "text-green"} ${FOCUS}`}>
            {label} <ChevronRight size={15} aria-hidden />
        </Link>
    );
}

/** Danh sách đang đổi trang: giữ trang cũ (mờ) để bố cục không nhảy, báo bận cho trình đọc màn hình. */
function PageBody({ paged, children }: { paged: PagedSection; children: ReactNode }): JSX.Element {
    return (
        <div aria-busy={paged.loading !== null} className={`transition-opacity duration-200 motion-reduce:transition-none ${paged.loading !== null ? "opacity-50" : "opacity-100"}`}>
            {children}
        </div>
    );
}

/* ---------------- #tieu-diem: bài dẫn + cột bài phụ ---------------- */

function Spotlight({ lead, secondary, text, dates }: { lead: ArticleCard; secondary: ArticleCard[]; text: Text; dates: Dates }): JSX.Element {
    return (
        <div className="grid gap-8 lg:grid-cols-12 lg:gap-0">
            <article className="group flex flex-col gap-3 lg:col-span-8 lg:pr-8">
                <Cover card={lead} text={text} sizes="(min-width: 1024px) 60vw, 100vw" priority className="aspect-[16/9]" />
                <Headline card={lead} as="h3" className="text-[1.85rem] leading-[1.12] tracking-tight sm:text-[2.6rem]" />
                <p className="m-0 max-w-[65ch] font-serif text-[1.08rem] leading-relaxed text-charcoal/80">{lead.lede}</p>
                <Meta card={lead} text={text} dates={dates} />
            </article>
            {secondary.length > 0 ? (
                <ul className="m-0 flex list-none flex-col divide-y divide-charcoal/15 p-0 lg:col-span-4 lg:border-l lg:border-charcoal/15 lg:pl-8">
                    {secondary.map((card) => (
                        <li key={card.slug} className="py-5 first:pt-0 last:pb-0">
                            <article className="group flex gap-4">
                                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                    <Headline card={card} className="text-lg leading-snug" />
                                    <p className="m-0 line-clamp-2 text-sm leading-relaxed text-charcoal/75">{card.lede}</p>
                                    <Meta card={card} text={text} dates={dates} />
                                </div>
                                <Cover card={card} text={text} sizes="96px" className="aspect-square w-24 shrink-0 rounded-sm" />
                            </article>
                        </li>
                    ))}
                </ul>
            ) : null}
        </div>
    );
}

/* ---------------- #moi-nhat: dòng tin theo giờ ---------------- */

function LatestWire({ paged, text, dates }: { paged: PagedSection; text: Text; dates: Dates }): JSX.Element {
    return (
        <PageBody paged={paged}>
            <ol className="m-0 grid list-none gap-x-10 p-0 lg:grid-cols-2">
                {paged.items.map((card) => {
                    const relative = relativeTime(card.publishedAt, dates.now, dates.tag);
                    return (
                        <li key={card.slug} className="grid grid-cols-[4.75rem_1fr] gap-4 border-b border-charcoal/12 py-4">
                            <p className="m-0 flex flex-col font-sans text-xs leading-tight text-charcoal/60">
                                <time dateTime={card.publishedAt} className="text-base font-bold text-charcoal tabular-nums" suppressHydrationWarning>
                                    {dates.time(card.publishedAt)}
                                </time>
                                <span suppressHydrationWarning>{relative ?? dates.long(card.publishedAt)}</span>
                                {isFresh(card.publishedAt, dates.now) ? (
                                    <span className="mt-1 inline-flex w-fit items-center gap-1 font-semibold text-red-700" suppressHydrationWarning>
                                        <span aria-hidden className="size-1.5 rounded-full bg-red-600" />
                                        {text(["articles", "front", "fresh"])}
                                    </span>
                                ) : null}
                            </p>
                            <article className="flex min-w-0 flex-col gap-1">
                                <Headline card={card} className="text-[1.05rem] leading-snug" />
                                <p className="m-0 line-clamp-2 text-sm leading-relaxed text-charcoal/70">{card.lede}</p>
                                <p className="m-0 font-sans text-xs text-charcoal/55">
                                    <span className="font-semibold text-green">{text(["articles", "topics", card.topic])}</span>
                                    {card.readingMinutes ? ` · ${text(["articles", "front", "readMinutes"]).replace("{count}", String(card.readingMinutes))}` : ""}
                                </p>
                            </article>
                        </li>
                    );
                })}
            </ol>
        </PageBody>
    );
}

/* ---------------- #noi-bat: bảng xếp hạng ---------------- */

function PopularRanks({ paged, text, dates }: { paged: PagedSection; text: Text; dates: Dates }): JSX.Element {
    const { locale } = useLocale();
    const start = (paged.page - 1) * paged.pageSize;
    return (
        <PageBody paged={paged}>
            <ol start={start + 1} className="m-0 grid list-none gap-x-8 p-0 sm:grid-cols-2 lg:grid-cols-5">
                {paged.items.map((card, index) => (
                    <li
                        key={card.slug}
                        className="relative flex min-w-0 gap-4 border-b border-charcoal/12 py-4 lg:flex-col lg:gap-2 lg:border-b-0 lg:py-0 lg:before:absolute lg:before:inset-y-0 lg:before:-left-4 lg:before:w-px lg:before:bg-charcoal/12 lg:first:before:hidden"
                    >
                        <span className="w-12 shrink-0 font-serif text-5xl leading-[0.9] font-bold text-green tabular-nums lg:w-auto">
                            <span className="sr-only">{fill(text(["articles", "front", "rank"]), start + index + 1, locale)}: </span>
                            <span aria-hidden>{start + index + 1}</span>
                        </span>
                        <article className="flex min-w-0 flex-col gap-1.5">
                            <Headline card={card} className="text-base leading-snug" />
                            <Meta
                                card={card}
                                text={text}
                                dates={dates}
                                extra={
                                    card.views > 0 ? (
                                        <span className="inline-flex basis-full items-center gap-1 whitespace-nowrap">
                                            <Eye size={13} aria-hidden /> {fill(text(["articles", "front", "views"]), card.views, locale)}
                                        </span>
                                    ) : null
                                }
                            />
                        </article>
                    </li>
                ))}
            </ol>
        </PageBody>
    );
}

/* ---------------- #de-xuat: băng trượt ngang ---------------- */

function Rail({ label, text, children }: { label: string; text: Text; children: ReactNode }): JSX.Element {
    const ref = useRef<HTMLUListElement>(null);
    const [edges, setEdges] = useState({ start: true, end: false });

    useEffect(() => {
        const node = ref.current;
        if (!node) return;
        const update = (): void => setEdges({ start: node.scrollLeft <= 4, end: node.scrollLeft + node.clientWidth >= node.scrollWidth - 4 });
        update();
        node.addEventListener("scroll", update, { passive: true });
        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => {
            node.removeEventListener("scroll", update);
            observer.disconnect();
        };
    }, []);

    function page(direction: -1 | 1): void {
        const node = ref.current;
        if (!node) return;
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        node.scrollBy({ left: direction * node.clientWidth * 0.9, behavior: reduced ? "instant" : "smooth" });
    }

    const button = `inline-flex size-10 items-center justify-center rounded-full border border-charcoal/20 hover:bg-charcoal/5 disabled:opacity-30 ${FOCUS}`;
    return (
        <div className="flex flex-col gap-3">
            <ul
                ref={ref}
                aria-label={label}
                className="-mx-4 m-0 flex snap-x snap-mandatory list-none gap-5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
            >
                {children}
            </ul>
            <div className="hidden justify-end gap-2 sm:flex">
                <button type="button" className={button} onClick={() => page(-1)} disabled={edges.start} aria-label={`${label}: ${text(["articles", "front", "previous"])}`}>
                    <ChevronLeft size={18} aria-hidden />
                </button>
                <button type="button" className={button} onClick={() => page(1)} disabled={edges.end} aria-label={`${label}: ${text(["articles", "front", "next"])}`}>
                    <ChevronRight size={18} aria-hidden />
                </button>
            </div>
        </div>
    );
}

function RecommendedRail({ items, text, dates }: { items: ArticleCard[]; text: Text; dates: Dates }): JSX.Element {
    return (
        <Rail label={text(["articles", "front", "recommended"])} text={text}>
            {items.map((card) => (
                <li key={card.slug} className="w-[74%] shrink-0 snap-start sm:w-[44%] lg:w-[calc((100%-3.75rem)/4)]">
                    <article className="group flex h-full flex-col gap-2">
                        {card.coverImage?.startsWith("/") ? (
                            <Cover card={card} text={text} sizes="(min-width: 1024px) 25vw, 74vw" className="aspect-[4/3] rounded-sm" />
                        ) : (
                            // Bài chỉ có chữ: sapo lên khung trích dẫn cùng tỉ lệ để băng trượt giữ nhịp, không dùng khối màu thay ảnh.
                            <Link href={href(card)} tabIndex={-1} aria-hidden className="flex aspect-[4/3] items-end rounded-sm border border-charcoal/12 bg-cream/45 p-4 no-underline">
                                <span className="line-clamp-4 font-serif text-[1.05rem] leading-snug text-charcoal/80 italic">“{card.lede}”</span>
                            </Link>
                        )}
                        <Headline card={card} className="text-base leading-snug" />
                        <Meta card={card} text={text} dates={dates} />
                    </article>
                </li>
            ))}
        </Rail>
    );
}

/* ---------------- #video-anh: dải nền tối ---------------- */

function MediaBand({ paged, text, dates }: { paged: PagedSection; text: Text; dates: Dates }): JSX.Element {
    const [first, ...rest] = paged.items;
    return (
        <PageBody paged={paged}>
            <div className="grid gap-8 lg:grid-cols-12">
                {first ? (
                    <article className="group flex flex-col gap-3 lg:col-span-7">
                        <Cover card={first} text={text} sizes="(min-width: 1024px) 58vw, 100vw" className="aspect-video rounded-sm" />
                        <Headline card={first} dark className="text-2xl leading-tight sm:text-[1.9rem]" />
                        <p className="m-0 max-w-[65ch] text-sm leading-relaxed text-cream/80">{first.lede}</p>
                        <Meta card={first} text={text} dates={dates} dark />
                    </article>
                ) : null}
                {rest.length > 0 ? (
                    <ul className="m-0 flex list-none flex-col divide-y divide-cream/15 p-0 lg:col-span-5">
                        {rest.map((card) => (
                            <li key={card.slug} className="py-4 first:pt-0">
                                <article className="group flex gap-4">
                                    <Cover card={card} text={text} sizes="160px" className="aspect-video w-36 shrink-0 rounded-sm sm:w-40" />
                                    <div className="flex min-w-0 flex-col gap-1.5">
                                        <Headline card={card} dark className="text-base leading-snug" />
                                        <Meta card={card} text={text} dates={dates} dark />
                                    </div>
                                </article>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </PageBody>
    );
}

/* ---------------- #duoc-quan-tam: lưới bento ---------------- */

function EngagedBento({ paged, text, dates }: { paged: PagedSection; text: Text; dates: Dates }): JSX.Element {
    const { locale } = useLocale();
    const [first, ...rest] = paged.items;
    const counts = (card: ArticleCard, dark: boolean): JSX.Element => (
        <p className={`m-0 flex flex-wrap items-center gap-x-3 font-sans text-xs font-semibold ${dark ? "text-white/85" : "text-charcoal/65"}`}>
            <span className="inline-flex items-center gap-1">
                <MessageCircle size={13} aria-hidden /> {fill(text(["articles", "front", "comments"]), card.comments, locale)}
            </span>
            {card.upvotes > 0 ? (
                <span className={`inline-flex items-center gap-1 ${dark ? "" : "text-red-700"}`}>
                    <Heart size={13} className="fill-current" aria-hidden /> {fill(text(["articles", "front", "likes"]), card.upvotes, locale)}
                </span>
            ) : null}
        </p>
    );
    if (!first) return <PageBody paged={paged}>{null}</PageBody>;
    const hasCover = Boolean(first.coverImage?.startsWith("/"));
    return (
        <PageBody paged={paged}>
            <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2">
                <li className="sm:col-span-2 lg:row-span-2">
                    <article className={`group relative flex h-full min-h-[22rem] flex-col justify-end overflow-hidden rounded-sm p-6 ${hasCover ? "text-white" : "bg-charcoal text-cream"}`}>
                        {hasCover && first.coverImage ? (
                            <>
                                <Image src={first.coverImage} alt="" fill sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03] motion-reduce:transition-none" />
                                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/45 to-black/5" />
                            </>
                        ) : null}
                        <div className="relative flex flex-col gap-2">
                            <p className="m-0 font-sans text-xs font-semibold text-gold">{text(["articles", "topics", first.topic])}</p>
                            <h3 className="m-0 font-serif text-2xl leading-tight font-bold text-balance sm:text-3xl">
                                {/* Liên kết phủ cả ô: bấm đâu trong ô cũng mở bài. */}
                                <Link href={href(first)} className={`text-inherit no-underline after:absolute after:inset-0 hover:underline ${FOCUS}`}>
                                    {first.title}
                                </Link>
                            </h3>
                            <p className="m-0 line-clamp-2 max-w-[60ch] text-sm leading-relaxed text-white/85">{first.lede}</p>
                            {counts(first, true)}
                        </div>
                    </article>
                </li>
                {rest.map((card) => (
                    <li key={card.slug}>
                        <article className="group flex h-full flex-col gap-2 rounded-sm border border-charcoal/12 p-5">
                            <p className="m-0 flex items-baseline gap-1.5 font-serif text-charcoal">
                                <span className="text-4xl leading-none font-bold tabular-nums">{new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN").format(card.comments)}</span>
                                <span className="font-sans text-xs font-semibold text-charcoal/60">{text(["articles", "front", "comments"]).replace("{count}", "").trim()}</span>
                            </p>
                            <Headline card={card} className="text-base leading-snug" />
                            <div className="mt-auto flex flex-col gap-1 pt-1">
                                {card.upvotes > 0 ? (
                                    <p className="m-0 inline-flex items-center gap-1 font-sans text-xs font-semibold text-red-700">
                                        <Heart size={13} className="fill-current" aria-hidden /> {fill(text(["articles", "front", "likes"]), card.upvotes, locale)}
                                    </p>
                                ) : null}
                                <Meta card={card} text={text} dates={dates} />
                            </div>
                        </article>
                    </li>
                ))}
            </ul>
        </PageBody>
    );
}

/* ---------------- #chu-de: bốn cột theo chủ đề ---------------- */

function TopicColumns({ topics, text, dates }: { topics: ArticleHome["topics"]; text: Text; dates: Dates }): JSX.Element {
    return (
        <div className="grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {topics.map((block) => {
                const [first, ...rest] = block.items;
                const name = text(["articles", "topics", block.topic]);
                return (
                    <div key={block.topic} className="relative flex min-w-0 flex-col gap-3 lg:before:absolute lg:before:inset-y-0 lg:before:-left-4 lg:before:w-px lg:before:bg-charcoal/12 lg:first:before:hidden">
                        <div className="flex items-center justify-between gap-2 border-b border-charcoal/20 pb-1.5">
                            <h3 className="m-0 font-sans text-sm font-bold">
                                <Link href={`/bai-viet?chu-de=${block.topic}`} className={LINK}>
                                    {name}
                                </Link>
                            </h3>
                            <MoreLink to={`/bai-viet?chu-de=${block.topic}`} label={text(["articles", "front", "seeMore"])} />
                        </div>
                        {first ? (
                            <article className="group flex flex-col gap-2">
                                <Cover card={first} text={text} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 45vw, 100vw" className="aspect-[3/2] rounded-sm" />
                                <Headline card={first} as="h4" className="text-lg leading-snug" />
                                <Meta card={first} text={text} dates={dates} />
                            </article>
                        ) : null}
                        {rest.length > 0 ? (
                            <ul className="m-0 flex list-none flex-col divide-y divide-charcoal/10 p-0">
                                {rest.map((card) => (
                                    <li key={card.slug} className="py-2.5">
                                        <Headline card={card} as="h4" className="text-[0.95rem] leading-snug font-semibold" />
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}

/* ---------------- Đầu trang và thanh mục dính ---------------- */

function Masthead({ text, dates }: { text: Text; dates: Dates }): JSX.Element {
    const router = useRouter();
    const [query, setQuery] = useState("");

    function submit(event: FormEvent): void {
        event.preventDefault();
        const value = query.trim();
        router.push(value ? `/bai-viet?q=${encodeURIComponent(value)}` : "/bai-viet?xem=tat-ca");
    }

    return (
        <header className="flex flex-col gap-3 pt-6 pb-4 sm:flex-row sm:items-end sm:justify-between sm:pt-8">
            <div className="min-w-0">
                <p className="m-0 font-sans text-xs font-semibold text-charcoal/60 first-letter:uppercase" suppressHydrationWarning>
                    {dates.today}
                </p>
                <h1 className="m-0 mt-1 font-display text-4xl leading-none font-bold tracking-tight sm:text-5xl">{text(["articles", "title"])}</h1>
                <p className="m-0 mt-2 max-w-xl text-sm leading-relaxed text-charcoal/70">{text(["articles", "lede"])}</p>
            </div>
            <form role="search" onSubmit={submit} className="flex w-full items-center sm:w-72">
                <label htmlFor="tim-bai-trang-nhat" className="sr-only">
                    {text(["articles", "front", "search"])}
                </label>
                <div className="relative w-full">
                    <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-charcoal/50" />
                    <input
                        id="tim-bai-trang-nhat"
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={text(["articles", "searchPlaceholder"])}
                        autoComplete="off"
                        className={`box-border min-h-11 w-full rounded-full border border-charcoal/20 bg-white pr-3 pl-9 text-sm ${FOCUS}`}
                    />
                </div>
                <button type="submit" className="sr-only">
                    {text(["articles", "front", "searchSubmit"])}
                </button>
            </form>
        </header>
    );
}

function SectionNav({
    sections,
    active,
    go,
    text,
    navRef,
}: {
    sections: ReadonlyArray<(typeof FRONT_SECTIONS)[number]>;
    active: FrontSectionId | null;
    go: (id: FrontSectionId) => void;
    text: Text;
    navRef: RefObject<HTMLElement | null>;
}): JSX.Element {
    const listRef = useRef<HTMLUListElement>(null);

    // Màn hẹp: thanh mục cuộn ngang, giữ mục đang đọc trong tầm nhìn.
    useEffect(() => {
        const list = listRef.current;
        const item = active ? list?.querySelector<HTMLElement>(`[data-section="${active}"]`) : null;
        if (!list || !item) return;
        const left = item.offsetLeft - list.offsetLeft;
        if (left < list.scrollLeft || left + item.offsetWidth > list.scrollLeft + list.clientWidth) {
            list.scrollTo({ left: Math.max(0, left - 16), behavior: "instant" });
        }
    }, [active]);

    return (
        <nav ref={navRef} aria-label={text(["articles", "front", "onThisPage"])} className={`sticky top-0 z-20 border-y border-charcoal/80 bg-white/95 backdrop-blur-sm ${BLEED}`}>
            <ul ref={listRef} className="m-0 flex list-none items-center gap-x-1 overflow-x-auto p-0 [scrollbar-width:none]">
                {sections.map((section) => (
                    <li key={section.id} data-section={section.id}>
                        <a
                            href={`#${section.id}`}
                            onClick={(event) => {
                                event.preventDefault();
                                go(section.id);
                            }}
                            aria-current={active === section.id ? "location" : undefined}
                            className={`relative inline-flex min-h-11 items-center px-3 font-sans text-sm font-semibold whitespace-nowrap text-charcoal/70 no-underline hover:text-charcoal aria-[current=location]:text-charcoal after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:bg-green after:opacity-0 aria-[current=location]:after:opacity-100 ${FOCUS}`}
                        >
                            {text(["articles", "front", section.label])}
                        </a>
                    </li>
                ))}
                <li className="ml-auto pl-2">
                    <Link href="/bai-viet?xem=tat-ca" className={`inline-flex min-h-11 items-center gap-0.5 px-3 font-sans text-sm font-semibold whitespace-nowrap text-green no-underline hover:underline ${FOCUS}`}>
                        {text(["articles", "front", "allArticles"])} <ChevronRight size={15} aria-hidden />
                    </Link>
                </li>
            </ul>
        </nav>
    );
}

/* ---------------- Trang ---------------- */

const EMPTY: ArticleCard[] = [];

export default function ArticleFront({ home }: { home: ArticleHome | null }): JSX.Element {
    const text = useText();
    const dates = useDates();
    const auth = useAuth();
    const signedIn = auth.status === "authenticated";
    const navRef = useRef<HTMLElement>(null);
    const [mine, setMine] = useState<ArticleCard[] | null>(null);

    useEffect(() => {
        if (!signedIn) return;
        let alive = true;
        listRecommendedForMe()
            .then((items) => {
                if (alive && items.length > 0) setMine(items);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [signedIn]);

    const recommended = (signedIn ? mine : null) ?? home?.recommended ?? EMPTY;
    // Chỉ những mục có bài mới có mặt trên trang và trên thanh mục.
    const present = FRONT_SECTIONS.filter((section) => {
        if (!home?.lead) return false;
        if (section.id === "tieu-diem") return true;
        if (section.id === "moi-nhat") return home.latest.length > 0;
        if (section.id === "noi-bat") return home.popular.length > 0;
        if (section.id === "de-xuat") return recommended.length > 0;
        if (section.id === "video-anh") return home.media.length > 0;
        if (section.id === "duoc-quan-tam") return home.engaged.length > 0;
        return home.topics.length > 0;
    });
    const ids = present.map((section) => section.id);
    const spy = useSectionSpy<FrontSectionId>(ids.join(","), navRef);

    // Đổi trang một mục khi đã cuộn qua đầu mục: đưa đầu mục trở lại tầm nhìn để đọc trang mới từ trên xuống.
    const reveal = useCallback(
        (id: FrontSectionId) => () => {
            const node = document.getElementById(id);
            const navBottom = navRef.current?.getBoundingClientRect().bottom ?? 0;
            if (node && node.getBoundingClientRect().top < navBottom) spy.go(id);
        },
        [spy],
    );

    const latest = usePagedSection("latest", home?.latest ?? EMPTY, home?.paging?.latest, reveal("moi-nhat"));
    const popular = usePagedSection("popular", home?.popular ?? EMPTY, home?.paging?.popular, reveal("noi-bat"));
    const media = usePagedSection("media", home?.media ?? EMPTY, home?.paging?.media, reveal("video-anh"));
    const engaged = usePagedSection("engaged", home?.engaged ?? EMPTY, home?.paging?.engaged, reveal("duoc-quan-tam"));

    if (!home || !home.lead) {
        return (
            <div className={`box-border pb-10 ${GUTTER}`}>
                <Masthead text={text} dates={dates} />
                <p className="mt-6 text-base" role={home ? "status" : "alert"}>
                    {text(["articles", "front", home ? "empty" : "error"])}
                </p>
            </div>
        );
    }

    const t = (key: string): string => text(["articles", "front", key]);
    const shown = new Set(ids);

    return (
        <div className={`box-border flex flex-col pb-12 ${GUTTER}`}>
            <Masthead text={text} dates={dates} />
            <SectionNav sections={present} active={spy.active} go={spy.go} text={text} navRef={navRef} />

            <div className="flex flex-col gap-16 pt-8">
                <Section id="tieu-diem" title={t("spotlight")} hint={t("spotlightHint")} go={spy.go} text={text}>
                    <Spotlight lead={home.lead} secondary={home.secondary} text={text} dates={dates} />
                </Section>

                {shown.has("moi-nhat") ? (
                    <Section id="moi-nhat" title={t("latest")} hint={t("latestHint")} go={spy.go} text={text} action={<MoreLink to="/bai-viet?xem=tat-ca" label={t("seeAll")} />}>
                        <LatestWire paged={latest} text={text} dates={dates} />
                        <SectionPager name={t("latest")} paged={latest} text={text} />
                    </Section>
                ) : null}

                {shown.has("noi-bat") ? (
                    <Section id="noi-bat" title={t("popular")} hint={text(["articles", "front", "popularHint", home.popularWindow])} go={spy.go} text={text}>
                        <PopularRanks paged={popular} text={text} dates={dates} />
                        <SectionPager name={t("popular")} paged={popular} text={text} />
                    </Section>
                ) : null}

                {shown.has("de-xuat") ? (
                    <Section id="de-xuat" title={t("recommended")} hint={t(signedIn && mine ? "recommendedMine" : "recommendedGuest")} go={spy.go} text={text}>
                        <RecommendedRail items={recommended} text={text} dates={dates} />
                    </Section>
                ) : null}

                {shown.has("video-anh") ? (
                    <Section id="video-anh" title={t("media")} hint={t("mediaHint")} dark go={spy.go} text={text} className={`bg-charcoal py-10 text-cream ${BLEED}`}>
                        <MediaBand paged={media} text={text} dates={dates} />
                        <SectionPager name={t("media")} paged={media} text={text} dark />
                    </Section>
                ) : null}

                {shown.has("duoc-quan-tam") ? (
                    <Section id="duoc-quan-tam" title={t("engaged")} hint={t("engagedHint")} go={spy.go} text={text}>
                        <EngagedBento paged={engaged} text={text} dates={dates} />
                        <SectionPager name={t("engaged")} paged={engaged} text={text} />
                    </Section>
                ) : null}

                {shown.has("chu-de") ? (
                    <Section id="chu-de" title={t("topicsTitle")} hint={t("topicsHint")} go={spy.go} text={text}>
                        <TopicColumns topics={home.topics} text={text} dates={dates} />
                    </Section>
                ) : null}

                <div className="flex justify-center border-t border-charcoal/15 pt-8">
                    <Link
                        href="/bai-viet?xem=tat-ca"
                        className={`inline-flex min-h-11 items-center gap-1 rounded-full border border-charcoal/25 px-5 font-sans text-sm font-semibold text-charcoal no-underline hover:bg-charcoal/5 ${FOCUS}`}
                    >
                        {t("allArticles")} <ChevronRight size={16} aria-hidden />
                    </Link>
                </div>
            </div>
        </div>
    );
}
