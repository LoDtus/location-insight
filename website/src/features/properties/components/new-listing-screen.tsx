"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type JSX } from "react";

import type { ShellRoot } from "@/features/app/shell";
import CompletenessPanel from "@/features/properties/components/listing-form/completeness-panel";
import { MainInfoSection } from "@/features/properties/components/listing-form/sections-main-info";
import { PhotosSection, DescriptionSection } from "@/features/properties/components/listing-form/sections-main";
import {
    ContactSection,
    FactsSection,
    LegalSection,
    MapSection,
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

/** Thứ tự trường theo vị trí trên trang, để nhảy tới lỗi đầu tiên. */
const FIELD_ORDER: FormField[] = [
    "photos", "title", "district", "ward", "street", "price", "area", "depositMonths", "beds", "living", "baths", "floors",
    "description", "frontage", "roadWidth", "legalKind", "lat", "contactName", "phone", "zalo", "agreed",
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

    const props = { form, errors, set, vi };

    return (
        <form noValidate onSubmit={publish} className="flex min-h-full w-full flex-col bg-white">
            <div className="flex-1 px-4 pt-6 sm:px-6">
                <p className="m-0 text-sm">
                    <Link href={`${root}/properties`} className="font-semibold text-green no-underline">
                        {t("Tin rao bán", "For sale")}
                    </Link>
                </p>
                <h1 className="mt-2 mb-1 text-2xl font-semibold">{t("Đăng tin mới", "New listing")}</h1>
                <p className="m-0 text-sm text-charcoal/75">
                    {t("Các mục xếp theo đúng thứ tự trang chi tiết tin. Dấu * là bắt buộc.", "Sections follow the same order as the listing page. * means required.")}
                </p>
                <div className="mt-5 flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
                    <div className="grid min-w-0 gap-5">
                        <PhotosSection props={props} photos={photos} onPhotos={setPhotos} />
                        <MainInfoSection {...props} />
                        <DescriptionSection props={props} initial={EMPTY_RICH_TEXT} characters={characters} onChange={onDescription} />
                        <FactsSection {...props} />
                        <LegalSection {...props} />
                        <MapSection {...props} />
                    </div>
                    <aside className="grid gap-5 lg:sticky lg:top-4">
                        <ContactSection {...props} />
                        <PublishSection {...props} />
                        <CompletenessPanel items={items} vi={vi} />
                    </aside>
                </div>
            </div>
            <div className="sticky bottom-0 z-10 mt-6 border-t border-charcoal/15 bg-white px-4 py-3 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
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
    );
}
