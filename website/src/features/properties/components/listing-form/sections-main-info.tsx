"use client";

import type { JSX } from "react";

import { DISTRICTS, LISTING_KINDS, type ListingKind, type ListingPurpose } from "@/features/landing-page/data/listings";
import { Field, INPUT_CLASS, Segmented, SectionCard, Toggle } from "@/shared/components/form/form-primitives";
import { KIND_LABEL } from "@/features/properties/components/listing-form/option-labels";
import SelectField from "@/features/properties/components/listing-form/select-field";
import type { SectionProps } from "@/features/properties/components/listing-form/section-types";
import TextField from "@/features/properties/components/listing-form/text-field";
import { TITLE_MAX, TITLE_MIN, describePrice, digitsOnly } from "@/features/properties/listing-form";

function formatThousands(value: string): string {
    return value ? Number(value).toLocaleString("vi-VN") : "";
}

/** Khối đầu bài chi tiết: nhãn, tiêu đề, địa chỉ, giá, thông số. */
export function MainInfoSection(props: SectionProps): JSX.Element {
    const { form, set, vi } = props;
    const t = (viText: string, enText: string): string => (vi ? viText : enText);
    const rent = form.purpose === "thue";
    const words = describePrice(Number(form.price), vi);
    return (
        <SectionCard id="co-ban" step={2} title={t("Thông tin chính", "Main information")} hint={t("Phần hiện ngay dưới ảnh: hình thức, tiêu đề, địa chỉ, giá và thông số.", "Shown right below the photos: offer, title, address, price and specs.")}>
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
            <div className="grid gap-5 sm:grid-cols-2">
                <Field id="lf-city" label={t("Tỉnh / thành phố", "City")} vi={vi}>
                    <select id="lf-city" className={INPUT_CLASS} value="Hà Nội" disabled>
                        <option>Hà Nội</option>
                    </select>
                </Field>
                <SelectField
                    name="district"
                    label={t("Quận / huyện", "District")}
                    props={props}
                    required
                    options={DISTRICTS.map((item) => ({ value: item, label: item }))}
                    placeholder={t("Chọn quận / huyện", "Choose a district")}
                />
                <TextField name="ward" label={t("Phường / xã", "Ward / commune")} props={props} required maxLength={60} placeholder={t("Ví dụ: phường Hoàn Kiếm", "e.g. Hoan Kiem ward")} />
                <TextField name="street" label={t("Đường / phố", "Street")} props={props} required maxLength={80} placeholder={t("Ví dụ: Hàng Bạc", "e.g. Hang Bac")} />
                <TextField name="houseNumber" label={t("Số nhà", "House number")} props={props} maxLength={20} />
                <div className="flex items-end">
                    <Toggle id="lf-hideHouseNumber" checked={form.hideHouseNumber} label={t("Ẩn số nhà trên tin", "Hide the house number")} onChange={(value) => set("hideHouseNumber", value)} />
                </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                    name="price"
                    label={rent ? t("Giá thuê mỗi tháng (đồng)", "Monthly rent (VND)") : t("Giá bán (đồng)", "Sale price (VND)")}
                    props={props}
                    required
                    inputMode="numeric"
                    maxLength={16}
                    transform={digitsOnly}
                    display={formatThousands}
                    hint={words ? `≈ ${words}` : t("Chỉ nhập số, ví dụ 4600000000", "Digits only, e.g. 4600000000")}
                />
                <TextField name="area" label={t("Diện tích (m²)", "Area (m²)")} props={props} required inputMode="decimal" maxLength={10} placeholder="60" />
            </div>
            <div className="flex flex-wrap items-center gap-x-6">
                <Toggle id="lf-negotiable" checked={form.negotiable} label={t("Giá có thể thương lượng", "Price is negotiable")} onChange={(value) => set("negotiable", value)} />
                {rent ? (
                    <div className="w-48">
                        <TextField name="depositMonths" label={t("Đặt cọc (tháng)", "Deposit (months)")} props={props} inputMode="numeric" maxLength={2} transform={digitsOnly} />
                    </div>
                ) : null}
            </div>
            <fieldset className="m-0 grid gap-4 border-0 p-0 sm:grid-cols-4">
                <legend className="mb-2 text-sm font-semibold">{t("Bố trí", "Layout")}</legend>
                <TextField name="beds" label={t("Phòng ngủ", "Bedrooms")} props={props} inputMode="numeric" maxLength={2} transform={digitsOnly} />
                <TextField name="living" label={t("Phòng khách", "Living rooms")} props={props} inputMode="numeric" maxLength={2} transform={digitsOnly} />
                <TextField name="baths" label={t("Phòng tắm", "Bathrooms")} props={props} inputMode="numeric" maxLength={2} transform={digitsOnly} />
                <TextField name="floors" label={t("Số tầng", "Floors")} props={props} inputMode="numeric" maxLength={2} transform={digitsOnly} />
            </fieldset>
        </SectionCard>
    );
}
