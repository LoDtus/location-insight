"use client";

import { ChevronLeft, ChevronRight, Eye, Heart, Images, MessageCircle, Play, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type JSX, type ReactNode } from "react";

import { listRecommendedForMe } from "@/features/articles/articles.api";
import { ARTICLE_TOPICS, type ArticleCard, type ArticleHome } from "@/features/articles/articles";
import { useAuth } from "@/features/auth/use-auth";
import { useLocale, useLocaleMessages } from "@/shared/hooks/useLocale";
import { getLocaleValue } from "@/shared/utils/locale.utils";

/**
 * Trang /bai-viet kiểu trang nhất báo lớn (tham khảo bố cục NYT, Washington Post, Reuters):
 * - Khối đầu: bài dẫn lớn (ảnh + tít serif), cột bài phụ, dải "Mới nhất" theo giờ: mắt đi từ trái sang phải theo mức quan trọng.
 * - "Nổi bật": danh sách đánh số (đọc nhiều nhất) — số thứ tự là thông tin, nên dùng list chứ không phải lưới thẻ.
 * - "Đề xuất": băng trượt ngang (nhiều mục ngang hàng, người đọc lướt) có nút trước/tiếp và cuộn chạm.
 * - "Được quan tâm": lưới thẻ có số bình luận/lượt thích làm điểm nhấn.
 * - "Video / Ảnh": dải nền tối tách hẳn nhịp đọc, một bài lớn + băng nhỏ.
 * - Khối theo chủ đề: một bài có ảnh + các tít ngắn, lối "Xem thêm" sang trang lọc.
 */

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green";
const LINK = `text-inherit no-underline hover:underline decoration-1 underline-offset-[3px] ${FOCUS}`;

type Text = (path: string[]) => string;

function useText(): Text {
    const landing = useLocaleMessages("landing");
    return (path) => getLocaleValue(landing, path);
}

function count(template: string, value: number, locale: string): string {
    return template.replace("{count}", new Intl.NumberFormat(locale === "en" ? "en-US" : "vi-VN", { notation: value >= 10_000 ? "compact" : "standard" }).format(value));
}

function useDates(): { short: (iso: string) => string; long: (iso: string) => string; time: (iso: string) => string; today: string } {
    const { locale } = useLocale();
    const tag = locale === "en" ? "en-GB" : "vi-VN";
    const zone = "Asia/Ho_Chi_Minh";
    const short = new Intl.DateTimeFormat(tag, { day: "numeric", month: "short", timeZone: zone });
    const long = new Intl.DateTimeFormat(tag, { day: "numeric", month: "long", year: "numeric", timeZone: zone });
    const time = new Intl.DateTimeFormat(tag, { hour: "2-digit", minute: "2-digit", timeZone: zone });
    const today = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: zone });
    return {
        short: (iso) => short.format(new Date(iso)),
        long: (iso) => long.format(new Date(iso)),
        time: (iso) => time.format(new Date(iso)),
        today: today.format(new Date()),
    };
}

function href(card: ArticleCard): string {
    return `/bai-viet/${card.slug}`;
}

/** Ảnh bìa: ảnh nội bộ qua next/image; không có ảnh thì khối màu theo chủ đề (giữ nhịp lưới). */
function Cover({ card, sizes, priority = false, className = "" }: { card: ArticleCard; sizes: string; priority?: boolean; className?: string }): JSX.Element {
    const text = useText();
    const badge =
        card.format === "video" ? (
            <span className="absolute inset-0 flex items-center justify-center">
                <span className="inline-flex size-12 items-center justify-center rounded-full bg-black/60 text-white ring-2 ring-white/80 backdrop-blur-sm">
                    <Play size={20} className="translate-x-px fill-current" aria-hidden />
                </span>
            </span>
        ) : card.format === "photo" ? (
            <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white">
                <Images size={12} aria-hidden /> {text(["articles", "front", "photo"])}
            </span>
        ) : null;
    return (
        <div className={`relative overflow-hidden bg-charcoal/[0.06] ${className}`}>
            {card.coverImage?.startsWith("/") ? (
                <Image src={card.coverImage} alt="" fill sizes={sizes} priority={priority} className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none" />
            ) : (
                <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-green/25 via-green/10 to-gold/20" />
            )}
            {badge}
        </div>
    );
}

function Kicker({ topic, text }: { topic: string; text: Text }): JSX.Element {
    return <p className="m-0 font-sans text-[11px] font-bold tracking-[0.12em] text-green uppercase">{text(["articles", "topics", topic])}</p>;
}

function SectionHead({ id, title, hint, action }: { id: string; title: string; hint?: string; action?: ReactNode }): JSX.Element {
    return (
        <div className="mb-4 flex flex-wrap items-end justify-between gap-x-4 gap-y-1 border-t-2 border-charcoal pt-2">
            <div className="min-w-0">
                <h2 id={id} className="m-0 font-serif text-xl font-bold tracking-tight sm:text-2xl">
                    {title}
                </h2>
                {hint ? <p className="m-0 mt-0.5 text-sm text-charcoal/60">{hint}</p> : null}
            </div>
            {action}
        </div>
    );
}

function MoreLink({ to, label }: { to: string; label: string }): JSX.Element {
    return (
        <Link href={to} className={`inline-flex items-center gap-0.5 text-sm font-semibold text-green no-underline hover:underline ${FOCUS}`}>
            {label} <ChevronRight size={15} aria-hidden />
        </Link>
    );
}

function Meta({ card, children }: { card: ArticleCard; children?: ReactNode }): JSX.Element {
    const dates = useDates();
    return (
        <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-sans text-xs text-charcoal/60">
            <time dateTime={card.publishedAt}>{dates.long(card.publishedAt)}</time>
            {children}
        </p>
    );
}

/* ---------------- Khối đầu: bài dẫn, bài phụ, Mới nhất ---------------- */

function LeadStory({ card, text }: { card: ArticleCard; text: Text }): JSX.Element {
    return (
        <article className="group">
            <Link href={href(card)} className={`block ${FOCUS}`} tabIndex={-1} aria-hidden>
                <Cover card={card} sizes="(min-width: 1024px) 50vw, 100vw" priority className="aspect-[16/10]" />
            </Link>
            <div className="mt-3 flex flex-col gap-2">
                <Kicker topic={card.topic} text={text} />
                <h2 className="m-0 font-serif text-[1.75rem] leading-[1.15] font-bold tracking-tight text-balance sm:text-4xl">
                    <Link href={href(card)} className={LINK}>
                        {card.title}
                    </Link>
                </h2>
                <p className="m-0 max-w-2xl font-serif text-[1.05rem] leading-relaxed text-charcoal/80">{card.lede}</p>
                <Meta card={card} />
            </div>
        </article>
    );
}

function SecondaryStories({ items, text }: { items: ArticleCard[]; text: Text }): JSX.Element {
    return (
        <ul className="m-0 flex list-none flex-col divide-y divide-charcoal/15 p-0">
            {items.map((card, index) => (
                <li key={card.slug} className="py-4 first:pt-0">
                    <article className="group flex flex-col gap-2">
                        {index === 0 ? (
                            <Link href={href(card)} className={`block ${FOCUS}`} tabIndex={-1} aria-hidden>
                                <Cover card={card} sizes="(min-width: 1024px) 25vw, 100vw" className="aspect-[3/2]" />
                            </Link>
                        ) : null}
                        <Kicker topic={card.topic} text={text} />
                        <h3 className="m-0 font-serif text-lg leading-snug font-bold text-balance">
                            <Link href={href(card)} className={LINK}>
                                {card.title}
                            </Link>
                        </h3>
                        <p className="m-0 line-clamp-3 text-sm leading-relaxed text-charcoal/75">{card.lede}</p>
                    </article>
                </li>
            ))}
        </ul>
    );
}

function LatestRail({ items, text }: { items: ArticleCard[]; text: Text }): JSX.Element {
    const dates = useDates();
    return (
        <section aria-labelledby="bai-moi-nhat">
            <div className="mb-3 flex items-center justify-between border-b border-charcoal/15 pb-2">
                <h2 id="bai-moi-nhat" className="m-0 flex items-center gap-2 font-sans text-sm font-bold tracking-[0.08em] uppercase">
                    <span aria-hidden className="relative flex size-2">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-red-500 opacity-60 motion-reduce:animate-none" />
                        <span className="relative inline-flex size-2 rounded-full bg-red-600" />
                    </span>
                    {text(["articles", "front", "latest"])}
                </h2>
                <MoreLink to="/bai-viet?xem=tat-ca" label={text(["articles", "front", "seeAll"])} />
            </div>
            <ol className="m-0 flex list-none flex-col p-0">
                {items.map((card) => (
                    <li key={card.slug} className="relative border-l border-charcoal/15 pb-4 pl-4 last:pb-0">
                        <span aria-hidden className="absolute top-1.5 -left-[4.5px] size-2 rounded-full border-2 border-white bg-charcoal/40" />
                        <p className="m-0 font-sans text-xs text-charcoal/55">
                            <time dateTime={card.publishedAt}>
                                {dates.short(card.publishedAt)} · {dates.time(card.publishedAt)}
                            </time>
                        </p>
                        <h3 className="m-0 mt-0.5 font-serif text-[0.97rem] leading-snug font-semibold">
                            <Link href={href(card)} className={LINK}>
                                {card.title}
                            </Link>
                        </h3>
                    </li>
                ))}
            </ol>
        </section>
    );
}

/* ---------------- Nổi bật: danh sách đánh số ---------------- */

function PopularList({ items, window: range, text }: { items: ArticleCard[]; window: ArticleHome["popularWindow"]; text: Text }): JSX.Element {
    const { locale } = useLocale();
    return (
        <section aria-labelledby="bai-noi-bat">
            <SectionHead id="bai-noi-bat" title={text(["articles", "front", "popular"])} hint={text(["articles", "front", "popularHint", range])} />
            <ol className="m-0 grid list-none gap-x-6 p-0 sm:grid-cols-2 lg:grid-cols-5">
                {items.map((card, index) => (
                    <li key={card.slug} className="flex gap-3 border-b border-charcoal/10 py-3 lg:border-b-0 lg:border-l lg:py-0 lg:pl-4 lg:first:border-l-0 lg:first:pl-0">
                        <span aria-hidden className="w-8 shrink-0 font-serif text-4xl leading-none font-bold text-green/80 tabular-nums">
                            {index + 1}
                        </span>
                        <div className="flex min-w-0 flex-col gap-1">
                            <h3 className="m-0 font-serif text-base leading-snug font-bold">
                                <Link href={href(card)} className={LINK}>
                                    {card.title}
                                </Link>
                            </h3>
                            {card.views > 0 ? (
                                <p className="m-0 inline-flex items-center gap-1 font-sans text-xs text-charcoal/55">
                                    <Eye size={13} aria-hidden /> {count(text(["articles", "front", "views"]), card.views, locale)}
                                </p>
                            ) : null}
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}

/* ---------------- Băng trượt ngang dùng chung (Đề xuất, Video / Ảnh) ---------------- */

function Rail({ label, dark = false, children }: { label: string; dark?: boolean; children: ReactNode }): JSX.Element {
    const ref = useRef<HTMLUListElement>(null);
    const [edges, setEdges] = useState({ start: true, end: false });
    const text = useText();

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
        node.scrollBy({ left: direction * node.clientWidth * 0.85, behavior: reduced ? "auto" : "smooth" });
    }

    const button = `inline-flex size-9 items-center justify-center rounded-full border disabled:opacity-30 ${dark ? "border-cream/30 text-cream hover:bg-cream/10" : "border-charcoal/20 hover:bg-charcoal/5"} ${FOCUS}`;
    return (
        <div className="relative">
            <div className="absolute -top-12 right-0 hidden gap-1.5 sm:flex">
                <button type="button" className={button} onClick={() => page(-1)} disabled={edges.start} aria-label={`${label}: ${text(["articles", "front", "previous"])}`}>
                    <ChevronLeft size={18} aria-hidden />
                </button>
                <button type="button" className={button} onClick={() => page(1)} disabled={edges.end} aria-label={`${label}: ${text(["articles", "front", "next"])}`}>
                    <ChevronRight size={18} aria-hidden />
                </button>
            </div>
            <ul
                ref={ref}
                aria-label={label}
                className="-mx-4 m-0 flex snap-x snap-mandatory list-none gap-4 overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] motion-reduce:scroll-auto sm:mx-0 sm:px-0"
            >
                {children}
            </ul>
        </div>
    );
}

function RecommendedRail({ initial, text }: { initial: ArticleCard[]; text: Text }): JSX.Element | null {
    const auth = useAuth();
    const signedIn = auth.status === "authenticated";
    const [mine, setMine] = useState<ArticleCard[] | null>(null);

    useEffect(() => {
        if (!signedIn) return;
        let active = true;
        listRecommendedForMe()
            .then((items) => {
                if (active && items.length > 0) setMine(items);
            })
            .catch(() => undefined);
        return () => {
            active = false;
        };
    }, [signedIn]);

    const items = (signedIn ? mine : null) ?? initial;
    if (items.length === 0) return null;
    const label = text(["articles", "front", "recommended"]);
    return (
        <section aria-labelledby="bai-de-xuat">
            <SectionHead
                id="bai-de-xuat"
                title={label}
                hint={text(["articles", "front", signedIn && mine ? "recommendedMine" : "recommendedGuest"])}
            />
            <Rail label={label}>
                {items.map((card) => (
                    <li key={card.slug} className="w-[72%] shrink-0 snap-start sm:w-[44%] lg:w-[calc((100%-3rem)/4)]">
                        <article className="group flex h-full flex-col gap-2">
                            <Link href={href(card)} className={`block ${FOCUS}`} tabIndex={-1} aria-hidden>
                                <Cover card={card} sizes="(min-width: 1024px) 25vw, 70vw" className="aspect-[4/3] rounded-sm" />
                            </Link>
                            <Kicker topic={card.topic} text={text} />
                            <h3 className="m-0 font-serif text-base leading-snug font-bold">
                                <Link href={href(card)} className={LINK}>
                                    {card.title}
                                </Link>
                            </h3>
                            <p className="m-0 line-clamp-2 text-sm text-charcoal/70">{card.lede}</p>
                        </article>
                    </li>
                ))}
            </Rail>
        </section>
    );
}

/* ---------------- Được quan tâm: lưới thẻ có số tương tác ---------------- */

function EngagedGrid({ items, text }: { items: ArticleCard[]; text: Text }): JSX.Element {
    const { locale } = useLocale();
    return (
        <section aria-labelledby="bai-quan-tam">
            <SectionHead id="bai-quan-tam" title={text(["articles", "front", "engaged"])} hint={text(["articles", "front", "engagedHint"])} />
            <ul className="m-0 grid list-none gap-x-6 gap-y-8 p-0 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((card) => (
                    <li key={card.slug}>
                        <article className="group flex h-full gap-4">
                            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <Kicker topic={card.topic} text={text} />
                                <h3 className="m-0 font-serif text-lg leading-snug font-bold">
                                    <Link href={href(card)} className={LINK}>
                                        {card.title}
                                    </Link>
                                </h3>
                                <p className="m-0 mt-auto flex flex-wrap gap-x-3 pt-1 font-sans text-xs font-semibold text-charcoal/65">
                                    <span className="inline-flex items-center gap-1">
                                        <MessageCircle size={13} aria-hidden /> {count(text(["articles", "front", "comments"]), card.comments, locale)}
                                    </span>
                                    {card.upvotes > 0 ? (
                                        <span className="inline-flex items-center gap-1 text-red-600">
                                            <Heart size={13} className="fill-current" aria-hidden /> {count(text(["articles", "front", "likes"]), card.upvotes, locale)}
                                        </span>
                                    ) : null}
                                </p>
                            </div>
                            <Link href={href(card)} className={`block w-28 shrink-0 ${FOCUS}`} tabIndex={-1} aria-hidden>
                                <Cover card={card} sizes="112px" className="aspect-square rounded-sm" />
                            </Link>
                        </article>
                    </li>
                ))}
            </ul>
        </section>
    );
}

/* ---------------- Video / Ảnh: dải nền tối ---------------- */

function MediaBand({ items, text }: { items: ArticleCard[]; text: Text }): JSX.Element {
    const [first, ...rest] = items;
    const label = text(["articles", "front", "media"]);
    const formatLabel = (card: ArticleCard): string => text(["articles", "front", card.format === "video" ? "video" : "photo"]);
    return (
        <section id="video-anh" aria-labelledby="bai-video-anh" className="-mx-4 bg-charcoal px-4 py-8 text-cream sm:-mx-8 sm:px-8 xl:-mx-50 xl:px-50">
            <div className="mb-5 flex items-end justify-between gap-4 border-t-2 border-cream/80 pt-2">
                <div>
                    <h2 id="bai-video-anh" className="m-0 font-serif text-xl font-bold tracking-tight sm:text-2xl">
                        {label}
                    </h2>
                    <p className="m-0 mt-0.5 text-sm text-cream/65">{text(["articles", "front", "mediaHint"])}</p>
                </div>
            </div>
            <div className="grid gap-6 lg:grid-cols-12">
                <article className="group lg:col-span-7">
                    <Link href={href(first)} className={`block ${FOCUS}`} tabIndex={-1} aria-hidden>
                        <Cover card={first} sizes="(min-width: 1024px) 58vw, 100vw" className="aspect-video rounded-sm" />
                    </Link>
                    <p className="m-0 mt-3 font-sans text-[11px] font-bold tracking-[0.12em] text-gold uppercase">{formatLabel(first)}</p>
                    <h3 className="m-0 mt-1 font-serif text-2xl leading-tight font-bold text-balance">
                        <Link href={href(first)} className={`${LINK} text-cream`}>
                            {first.title}
                        </Link>
                    </h3>
                    <p className="m-0 mt-2 max-w-2xl text-sm leading-relaxed text-cream/75">{first.lede}</p>
                </article>
                {rest.length > 0 ? (
                    <ul className="m-0 flex list-none flex-col gap-5 p-0 lg:col-span-5">
                        {rest.slice(0, 4).map((card) => (
                            <li key={card.slug}>
                                <article className="group flex gap-4">
                                    <Link href={href(card)} className={`block w-36 shrink-0 ${FOCUS}`} tabIndex={-1} aria-hidden>
                                        <Cover card={card} sizes="144px" className="aspect-video rounded-sm" />
                                    </Link>
                                    <div className="min-w-0">
                                        <p className="m-0 font-sans text-[11px] font-bold tracking-[0.12em] text-gold uppercase">{formatLabel(card)}</p>
                                        <h3 className="m-0 mt-1 font-serif text-base leading-snug font-bold">
                                            <Link href={href(card)} className={`${LINK} text-cream`}>
                                                {card.title}
                                            </Link>
                                        </h3>
                                    </div>
                                </article>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
        </section>
    );
}

/* ---------------- Khối theo chủ đề ---------------- */

function TopicBlock({ topic, items, text }: { topic: string; items: ArticleCard[]; text: Text }): JSX.Element {
    const [first, ...rest] = items;
    const id = `chu-de-${topic}`;
    return (
        <section aria-labelledby={id}>
            <SectionHead
                id={id}
                title={text(["articles", "topics", topic])}
                action={<MoreLink to={`/bai-viet?chu-de=${topic}`} label={text(["articles", "front", "seeMore"])} />}
            />
            <article className="group flex flex-col gap-2">
                <Link href={href(first)} className={`block ${FOCUS}`} tabIndex={-1} aria-hidden>
                    <Cover card={first} sizes="(min-width: 1024px) 25vw, 100vw" className="aspect-[3/2] rounded-sm" />
                </Link>
                <h3 className="m-0 font-serif text-lg leading-snug font-bold">
                    <Link href={href(first)} className={LINK}>
                        {first.title}
                    </Link>
                </h3>
            </article>
            {rest.length > 0 ? (
                <ul className="m-0 mt-3 flex list-none flex-col divide-y divide-charcoal/10 p-0">
                    {rest.map((card) => (
                        <li key={card.slug} className="py-2.5">
                            <h4 className="m-0 font-serif text-[0.95rem] leading-snug font-semibold">
                                <Link href={href(card)} className={LINK}>
                                    {card.title}
                                </Link>
                            </h4>
                        </li>
                    ))}
                </ul>
            ) : null}
        </section>
    );
}

/* ---------------- Đầu trang: tiêu đề, ngày, ô tìm, thanh mục ---------------- */

function Masthead({ text }: { text: Text }): JSX.Element {
    const router = useRouter();
    const dates = useDates();
    const [query, setQuery] = useState("");

    function submit(event: FormEvent): void {
        event.preventDefault();
        const value = query.trim();
        router.push(value ? `/bai-viet?q=${encodeURIComponent(value)}` : "/bai-viet?xem=tat-ca");
    }

    return (
        <header className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <p className="m-0 font-sans text-xs font-semibold tracking-wide text-charcoal/60 first-letter:uppercase" suppressHydrationWarning>
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
                            className="box-border min-h-10 w-full rounded-full border border-charcoal/20 bg-white pr-3 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green"
                        />
                    </div>
                    <button type="submit" className="sr-only">
                        {text(["articles", "front", "searchSubmit"])}
                    </button>
                </form>
            </div>
            <nav aria-label={text(["articles", "front", "sections"])} className="border-y border-charcoal/80 py-0.5">
                <ul className="m-0 flex list-none items-center gap-x-1 overflow-x-auto p-0 [scrollbar-width:none]">
                    {ARTICLE_TOPICS.map((topic) => (
                        <li key={topic}>
                            <Link href={`/bai-viet?chu-de=${topic}`} className={`inline-flex min-h-10 items-center px-3 text-sm font-semibold whitespace-nowrap text-charcoal no-underline hover:text-green ${FOCUS}`}>
                                {text(["articles", "topics", topic])}
                            </Link>
                        </li>
                    ))}
                    <li>
                        <a href="#video-anh" className={`inline-flex min-h-10 items-center px-3 text-sm font-semibold whitespace-nowrap text-charcoal no-underline hover:text-green ${FOCUS}`}>
                            {text(["articles", "front", "media"])}
                        </a>
                    </li>
                    <li className="ml-auto">
                        <Link href="/bai-viet?xem=tat-ca" className={`inline-flex min-h-10 items-center px-3 text-sm font-semibold whitespace-nowrap text-green no-underline hover:underline ${FOCUS}`}>
                            {text(["articles", "front", "allArticles"])}
                        </Link>
                    </li>
                </ul>
            </nav>
        </header>
    );
}

export default function ArticleFront({ home }: { home: ArticleHome | null }): JSX.Element {
    const text = useText();

    if (!home || !home.lead) {
        return (
            <div className="box-border px-4 py-8 sm:px-8 xl:px-50">
                <Masthead text={text} />
                <p className="mt-10 text-base" role={home ? "status" : "alert"}>
                    {text(["articles", "front", home ? "empty" : "error"])}
                </p>
            </div>
        );
    }

    return (
        <div className="box-border flex flex-col gap-12 px-4 py-6 sm:px-8 sm:py-8 xl:px-50">
            <Masthead text={text} />

            <div className="grid gap-8 lg:grid-cols-12 lg:gap-0">
                <div className="lg:col-span-6 lg:pr-6">
                    <LeadStory card={home.lead} text={text} />
                </div>
                {home.secondary.length > 0 ? (
                    <div className="lg:col-span-3 lg:border-l lg:border-charcoal/15 lg:px-6">
                        <SecondaryStories items={home.secondary} text={text} />
                    </div>
                ) : null}
                {home.latest.length > 0 ? (
                    <div className="lg:col-span-3 lg:border-l lg:border-charcoal/15 lg:pl-6">
                        <LatestRail items={home.latest.slice(0, 7)} text={text} />
                    </div>
                ) : null}
            </div>

            {home.popular.length > 0 ? <PopularList items={home.popular} window={home.popularWindow} text={text} /> : null}

            <RecommendedRail initial={home.recommended} text={text} />

            {home.media.length > 0 ? <MediaBand items={home.media} text={text} /> : null}

            {home.engaged.length > 0 ? <EngagedGrid items={home.engaged} text={text} /> : null}

            {home.topics.length > 0 ? (
                <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
                    {home.topics.map((block) => (
                        <TopicBlock key={block.topic} topic={block.topic} items={block.items} text={text} />
                    ))}
                </div>
            ) : null}

            <div className="flex justify-center border-t border-charcoal/15 pt-6">
                <Link
                    href="/bai-viet?xem=tat-ca"
                    className={`inline-flex min-h-11 items-center gap-1 rounded-full border border-charcoal/25 px-5 text-sm font-semibold text-charcoal no-underline hover:bg-charcoal/5 ${FOCUS}`}
                >
                    {text(["articles", "front", "allArticles"])} <ChevronRight size={16} aria-hidden />
                </Link>
            </div>
        </div>
    );
}
