"use client";

import type { JSX } from "react";

import { LISTING_KINDS, type ListingKind, type ListingPurpose } from "@/features/landing-page/data/listings";
import { Field, Segmented, SectionCard } from "@/features/properties/components/listing-form/form-primitives";
import { KIND_LABEL } from "@/features/properties/components/listing-form/option-labels";
import PhotoUploader from "@/features/properties/components/listing-form/photo-uploader";
import type { SectionProps } from "@/features/properties/components/listing-form/section-types";
import TextField from "@/features/properties/components/listing-form/text-field";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, TITLE_MAX, TITLE_MIN } from "@/features/properties/listing-form";
import RichTextEditor from "@/shared/components/editor/rich-text-editor";
import type { RichTextChange, RichTextDoc } from "@/shared/components/editor/rich-text.types";

export function BasicSection(props: SectionProps): JSX.Element {
    const { form, set, vi } = props;
    const t = (viText: string, enText: string): string => (vi ? viText : enText);
    return (
        <SectionCard id="co-ban" step={1} title={t("Thông tin cơ bản", "Basic information")} hint={t("Chọn hình thức, loại hình và đặt tiêu đề thu hút.", "Choose the offer, the type and write a clear title.")}>
            <Field id="lf-purpose" label={t("Hình thức", "Offer")} required vi={vi}>
                <Segmented<ListingPurpose>
                    label={t("Hình thức", "Offer")}
                    value={form.purpose}
                    options={[
                        { id: "ban", label: t("Bán", "For sale") },
                        { id: "thue", label: t("Cho thuê", "For rent") },
                    ]}
                    onChange={(value) => set("purpose", value)}
                />
            </Field>
            <Field id="lf-kind" label={t("Loại hình", "Type")} required vi={vi}>
                <Segmented<ListingKind>
                    label={t("Loại hình", "Type")}
                    value={form.kind}
                    options={LISTING_KINDS.map((item) => ({ id: item, label: vi ? KIND_LABEL[item].vi : KIND_LABEL[item].en }))}
                    onChange={(value) => set("kind", value)}
                />
            </Field>
            <TextField
                name="title"
                label={t("Tiêu đề tin", "Listing title")}
                props={props}
                required
                maxLength={TITLE_MAX}
                counter
                hint={t(`Từ ${TITLE_MIN} ký tự. Nêu loại nhà, vị trí và điểm nổi bật.`, `At least ${TITLE_MIN} characters. Mention the type, place and a highlight.`)}
                placeholder={t("Ví dụ: Bán nhà mặt phố Hàng Bạc, 60 m², 3 tầng", "e.g. Townhouse for sale on Hang Bac, 60 m²")}
            />
        </SectionCard>
    );
}

export function PhotosSection({
    props,
    photos,
    onPhotos,
}: {
    props: SectionProps;
    photos: string[];
    onPhotos: (next: string[]) => void;
}): JSX.Element {
    const { errors, vi } = props;
    const error = errors.photos;
    return (
        <SectionCard id="hinh-anh" step={2} title={vi ? "Hình ảnh" : "Photos"} hint={vi ? "Ảnh đầu tiên là ảnh bìa. Tin có từ 5 ảnh trở lên được chú ý hơn." : "The first photo is the cover. Listings with 5 or more photos get more attention."}>
            <PhotoUploader photos={photos} onChange={onPhotos} vi={vi} invalid={Boolean(error)} />
            {error ? (
                <p role="alert" className="m-0 text-xs text-red-700">
                    {vi ? error.vi : error.en}
                </p>
            ) : null}
        </SectionCard>
    );
}

export function DescriptionSection({
    props,
    initial,
    characters,
    onChange,
}: {
    props: SectionProps;
    initial: RichTextDoc;
    characters: number;
    onChange: (change: RichTextChange) => void;
}): JSX.Element {
    const { errors, vi } = props;
    const error = errors.description;
    return (
        <SectionCard id="mo-ta" step={3} title={vi ? "Mô tả chi tiết" : "Description"} hint={vi ? "Viết như trong Word: có thể chia đoạn, in đậm, tạo danh sách." : "Write as you would in Word: paragraphs, bold text and lists."}>
            <Field
                id="lf-description"
                label={vi ? "Nội dung mô tả" : "Description text"}
                required
                vi={vi}
                error={error}
                counter={`${characters}/${DESCRIPTION_MAX}`}
                hint={vi ? `Từ ${DESCRIPTION_MIN} ký tự. Nêu tình trạng nhà, tiện ích xung quanh, lý do bán.` : `At least ${DESCRIPTION_MIN} characters. Cover the condition, nearby amenities and why you are selling.`}
            >
                <RichTextEditor
                    initialValue={initial}
                    onChange={onChange}
                    ariaLabel={vi ? "Nội dung mô tả" : "Description text"}
                    placeholder={vi ? "Giới thiệu tin của bạn…" : "Describe your listing…"}
                    maxLength={DESCRIPTION_MAX}
                    invalid={Boolean(error)}
                    describedBy={error ? "lf-description-error" : "lf-description-hint"}
                    minHeightClass="min-h-64"
                />
            </Field>
        </SectionCard>
    );
}
