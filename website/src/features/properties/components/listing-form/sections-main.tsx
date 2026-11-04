"use client";

import type { JSX } from "react";

import { Field, SectionCard } from "@/features/properties/components/listing-form/form-primitives";
import PhotoUploader from "@/features/properties/components/listing-form/photo-uploader";
import type { SectionProps } from "@/features/properties/components/listing-form/section-types";
import { DESCRIPTION_MAX, DESCRIPTION_MIN } from "@/features/properties/listing-form";
import RichTextEditor from "@/shared/components/editor/rich-text-editor";
import type { RichTextChange, RichTextDoc } from "@/shared/components/editor/rich-text.types";

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
        <SectionCard id="hinh-anh" step={1} title={vi ? "Hình ảnh" : "Photos"} hint={vi ? "Ảnh đầu tiên là ảnh bìa. Tin có từ 5 ảnh trở lên được chú ý hơn." : "The first photo is the cover. Listings with 5 or more photos get more attention."}>
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
