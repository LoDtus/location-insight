"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import CompletenessPanel from "@/features/properties/components/listing-form/completeness-panel";
import { PhotosSection, BasicSection, DescriptionSection } from "@/features/properties/components/listing-form/sections-main";
import {
    ContactSection,
    DetailsSection,
    LegalSection,
    LocationSection,
    PublishSection,
} from "@/features/properties/components/listing-form/sections-detail";
import type { SetField } from "@/features/properties/components/listing-form/section-types";
import {
    buildListing,
    completenessItems,
    INITIAL_FORM,
    validateForm,
    type FormErrors,
    type FormField,
    type ListingForm,
} from "@/features/properties/listing-form";
import { saveDraft, todayInHanoi, uniqueListingSlug } from "@/features/properties/property-drafts";
import type { RichTextChange, RichTextDoc } from "@/shared/components/editor/rich-text.types";
import { EMPTY_RICH_TEXT } from "@/shared/components/editor/rich-text.utils";
import { useLocale } from "@/shared/hooks/useLocale";

const SECTIONS = [
    { id: "co-ban", vi: "Thông tin cơ bản", en: "Basics" },
    { id: "hinh-anh", vi: "Hình ảnh", en: "Photos" },
    { id: "mo-ta", vi: "Mô tả chi tiết", en: "Description" },
    { id: "chi-tiet", vi: "Thông tin chi tiết", en: "Details" },
    { id: "vi-tri", vi: "Địa chỉ và vị trí", en: "Location" },
    { id: "phap-ly", vi: "Pháp lý", en: "Legal" },
    { id: "lien-he", vi: "Liên hệ", en: "Contact" },
    { id: "dang-tin", vi: "Đăng tin", en: "Publish" },
] as const;

/** Thứ tự trường theo vị trí trên trang, để nhảy tới lỗi đầu tiên. */
const FIELD_ORDER: FormField[] = [
    "title", "photos", "description", "price", "area", "depositMonths", "beds", "living", "baths", "floors",
    "frontage", "roadWidth", "district", "ward", "street", "lat", "legalKind", "contactName", "phone", "zalo", "agreed",
];

function focusFirstError(errors: FormErrors): void {
    const key = FIELD_ORDER.find((field) => errors[field]);
    if (!key) return;
    const target =
        key === "photos"
            ? document.getElementById("hinh-anh")
            : key === "description"
              ? document.querySelector<HTMLElement>("#mo-ta [role='textbox']")
              : document.getElementById(`lf-${key}`);
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
    target?.focus({ preventScroll: true });
}

export default function NewListingScreen({ root }: { root: ShellRoot }): JSX.Element {
    const router = useRouter();
    const { locale } = useLocale();
    const vi = locale === "vi";
    const t = (viText: string, enText: string): string => (vi ? viText : enText);
    const [form, setForm] = useState<ListingForm>(INITIAL_FORM);
    const [photos, setPhotos] = useState<string[]>([]);
    const [description, setDescription] = useState<RichTextDoc>(EMPTY_RICH_TEXT);
    const [characters, setCharacters] = useState(0);
    const [attempted, setAttempted] = useState(false);
    const [message, setMessage] = useState("");
    const [pending, setPending] = useState(false);
    const [active, setActive] = useState<string>(SECTIONS[0].id);
    const scroller = useRef<HTMLElement>(null);
    const submitted = useRef(false);

    const set: SetField = useCallback((key, value) => setForm((current) => ({ ...current, [key]: value })), []);
    const onDescription = useCallback((change: RichTextChange) => {
        setDescription(change.doc);
        setCharacters(change.characters);
    }, []);
    const errors = useMemo<FormErrors>(
        () => (attempted ? validateForm(form, photos.length, characters) : {}),
        [attempted, form, photos.length, characters],
    );
    const items = useMemo(() => completenessItems(form, photos.length, characters), [form, photos.length, characters]);
    const dirty = form !== INITIAL_FORM || photos.length > 0 || characters > 0;

    useEffect(() => {
        if (!dirty) return;
        const warn = (event: BeforeUnloadEvent): void => {
            if (submitted.current) return;
            event.preventDefault();
        };
        window.addEventListener("beforeunload", warn);
        return () => window.removeEventListener("beforeunload", warn);
    }, [dirty]);

    useEffect(() => {
        const root = scroller.current;
        if (!root) return;
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
                if (visible) setActive(visible.target.id);
            },
            { root, rootMargin: "-10% 0px -70% 0px" },
        );
        SECTIONS.forEach((section) => {
            const node = document.getElementById(section.id);
            if (node) observer.observe(node);
        });
        return () => observer.disconnect();
    }, []);

    function publish(event: FormEvent<HTMLFormElement>): void {
        event.preventDefault();
        const found = validateForm(form, photos.length, characters);
        setAttempted(true);
        if (Object.keys(found).length > 0) {
            setMessage(t("Còn mục chưa hợp lệ. Hãy kiểm tra các ô báo đỏ.", "Some fields are invalid. Check the fields marked red."));
            requestAnimationFrame(() => focusFirstError(found));
            return;
        }
        setPending(true);
        setMessage("");
        const listing = buildListing({
            form,
            photos,
            description,
            id: crypto.randomUUID(),
            slug: uniqueListingSlug(form.title),
            today: todayInHanoi(),
        });
        try {
            saveDraft(listing);
        } catch {
            setPending(false);
            setMessage(t("Bộ nhớ trình duyệt đã đầy. Hãy bớt ảnh rồi thử lại.", "Browser storage is full. Remove some photos and try again."));
            return;
        }
        submitted.current = true;
        router.push(`${root}/properties/${listing.slug}`);
    }

    function goTo(id: string): void {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const props = { form, errors, set, vi };

    return (
        <main ref={scroller} className="box-border h-full overflow-auto bg-cream/40">
            <form noValidate onSubmit={publish} className="mx-auto flex min-h-full w-full max-w-7xl flex-col">
                <div className="flex-1 px-4 pt-8 sm:px-8">
                    <p className="m-0 text-sm">
                        <Link href={`${root}/properties`} className="font-semibold text-green no-underline">
                            {t("Tin rao bán", "For sale")}
                        </Link>
                    </p>
                    <h1 className="mt-3 mb-1 text-2xl font-semibold">{t("Đăng tin mới", "New listing")}</h1>
                    <p className="m-0 text-sm text-charcoal/75">
                        {t("Điền các mục bên dưới. Dấu * là bắt buộc. Tin hiện trên danh sách của trình duyệt này.", "Fill in the sections below. * means required. The listing appears in this browser's list.")}
                    </p>
                    <div className="mt-6 grid items-start gap-6 lg:grid-cols-[11rem_minmax(0,1fr)_17rem]">
                        <nav aria-label={t("Các mục của tin", "Listing sections")} className="sticky top-4 hidden lg:block">
                            <ol className="m-0 grid list-none gap-1 border-l border-charcoal/15 p-0">
                                {SECTIONS.map((section) => (
                                    <li key={section.id}>
                                        <button
                                            type="button"
                                            onClick={() => goTo(section.id)}
                                            aria-current={active === section.id ? "true" : undefined}
                                            className={`-ml-px block min-h-9 w-full border-0 border-l-2 bg-transparent px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-green ${active === section.id ? "border-green font-semibold text-green" : "border-transparent text-charcoal/75 hover:text-charcoal"}`}
                                        >
                                            {vi ? section.vi : section.en}
                                        </button>
                                    </li>
                                ))}
                            </ol>
                        </nav>
                        <div className="grid gap-5">
                            <BasicSection {...props} />
                            <PhotosSection props={props} photos={photos} onPhotos={setPhotos} />
                            <DescriptionSection props={props} initial={EMPTY_RICH_TEXT} characters={characters} onChange={onDescription} />
                            <DetailsSection {...props} />
                            <LocationSection {...props} />
                            <LegalSection {...props} />
                            <ContactSection {...props} />
                            <PublishSection {...props} />
                        </div>
                        <div className="lg:sticky lg:top-4">
                            <CompletenessPanel items={items} vi={vi} />
                        </div>
                    </div>
                </div>
                <div className="sticky bottom-0 z-10 mt-8 border-t border-charcoal/15 bg-white/95 px-4 py-3 backdrop-blur sm:px-8">
                    <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
                        <p role={message ? "alert" : undefined} className="m-0 min-h-5 text-sm text-red-700">
                            {message}
                        </p>
                        <div className="flex items-center gap-3">
                            <Link href={`${root}/properties`} className="inline-flex min-h-11 items-center rounded-xl border border-charcoal/25 px-5 text-sm font-semibold text-charcoal no-underline hover:bg-charcoal/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green">
                                {t("Hủy", "Cancel")}
                            </Link>
                            <button
                                type="submit"
                                disabled={pending}
                                className="inline-flex min-h-11 items-center rounded-xl bg-green px-6 text-sm font-semibold text-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:opacity-60"
                            >
                                {pending ? t("Đang đăng…", "Posting…") : t("Đăng tin", "Post listing")}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </main>
    );
}
