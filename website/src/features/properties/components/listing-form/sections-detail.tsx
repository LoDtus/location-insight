"use client";

import Link from "next/link";
import type { JSX } from "react";

import { DISTRICTS } from "@/features/landing-page/data/listings";
import { Field, INPUT_CLASS, Segmented, SectionCard, Toggle } from "@/features/properties/components/listing-form/form-primitives";
import {
    DIRECTION_LABEL,
    FURNISHING_LABEL,
    LEGAL_LABEL,
    ROLE_LABEL,
} from "@/features/properties/components/listing-form/option-labels";
import SelectField from "@/features/properties/components/listing-form/select-field";
import type { SectionProps } from "@/features/properties/components/listing-form/section-types";
import TextField from "@/features/properties/components/listing-form/text-field";
import {
    DIRECTIONS,
    EXPIRY_DAYS,
    FURNISHINGS,
    LEGAL_KINDS,
    POSTER_ROLES,
    type PosterRole,
} from "@/features/properties/listing-extra";
import { describePrice, digitsOnly } from "@/features/properties/listing-form";

function formatThousands(value: string): string {
    return value ? Number(value).toLocaleString("vi-VN") : "";
}

export function DetailsSection(props: SectionProps): JSX.Element {
    const { form, set, vi } = props;
    const t = (viText: string, enText: string): string => (vi ? viText : enText);
    const directions = DIRECTIONS.map((item) => ({ value: item, label: vi ? DIRECTION_LABEL[item].vi : DIRECTION_LABEL[item].en }));
    const furnishings = FURNISHINGS.map((item) => ({ value: item, label: vi ? FURNISHING_LABEL[item].vi : FURNISHING_LABEL[item].en }));
    const rent = form.purpose === "thue";
    const words = describePrice(Number(form.price), vi);
    return (
        <SectionCard id="chi-tiet" step={4} title={t("Thông tin chi tiết", "Details")} hint={t("Giá, diện tích và đặc điểm giúp người xem lọc đúng tin.", "Price, area and features help buyers filter correctly.")}>
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
            <div className="grid gap-5 sm:grid-cols-2">
                <SelectField name="direction" label={t("Hướng nhà", "House direction")} props={props} options={directions} placeholder={t("Chưa rõ", "Unknown")} />
                <SelectField name="balconyDirection" label={t("Hướng ban công", "Balcony direction")} props={props} options={directions} placeholder={t("Chưa rõ", "Unknown")} />
                <TextField name="frontage" label={t("Mặt tiền (m)", "Frontage (m)")} props={props} inputMode="decimal" maxLength={6} />
                <TextField name="roadWidth" label={t("Đường vào rộng (m)", "Access road width (m)")} props={props} inputMode="decimal" maxLength={6} />
                <SelectField name="furnishing" label={t("Nội thất", "Furnishing")} props={props} options={furnishings} placeholder={t("Chưa rõ", "Unknown")} />
            </div>
        </SectionCard>
    );
}

export function LocationSection(props: SectionProps): JSX.Element {
    const { form, set, vi } = props;
    const t = (viText: string, enText: string): string => (vi ? viText : enText);
    return (
        <SectionCard id="vi-tri" step={5} title={t("Địa chỉ và vị trí", "Address and location")} hint={t("Địa chỉ đúng giúp tin hiện đúng trên bản đồ và bộ lọc khu vực.", "An accurate address puts the listing in the right place on the map and filters.")}>
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
            <div className="rounded-xl bg-cream/60 p-4">
                <p className="m-0 text-sm font-semibold">{t("Tọa độ trên bản đồ", "Map coordinates")}</p>
                <p className="mt-1 mb-3 text-xs text-charcoal/70">
                    {t(
                        "Không bắt buộc. Có tọa độ thì tin dùng được tính năng bản đồ và phân tích vị trí. Chọn điểm trực tiếp trên bản đồ sẽ có sau; hiện nhập vĩ độ và kinh độ (ví dụ 21.0340 và 105.8540).",
                        "Optional. With coordinates the listing works with the map and location analysis. Picking a point on the map comes later; for now enter latitude and longitude (e.g. 21.0340 and 105.8540).",
                    )}
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                    <TextField name="lat" label={t("Vĩ độ", "Latitude")} props={props} inputMode="decimal" maxLength={12} placeholder="21.0340" />
                    <TextField name="lng" label={t("Kinh độ", "Longitude")} props={props} inputMode="decimal" maxLength={12} placeholder="105.8540" />
                </div>
            </div>
        </SectionCard>
    );
}

export function LegalSection(props: SectionProps): JSX.Element {
    const { vi } = props;
    const t = (viText: string, enText: string): string => (vi ? viText : enText);
    return (
        <SectionCard id="phap-ly" step={6} title={t("Pháp lý", "Legal status")} hint={t("Do bạn tự khai. Địa Thế không kiểm tra giấy tờ.", "Declared by you. Dia The does not check documents.")}>
            <SelectField
                name="legalKind"
                label={t("Tình trạng pháp lý", "Legal status")}
                props={props}
                required
                options={LEGAL_KINDS.map((item) => ({ value: item, label: vi ? LEGAL_LABEL[item].vi : LEGAL_LABEL[item].en }))}
                placeholder={t("Chọn tình trạng", "Choose a status")}
            />
            <TextField name="legalNote" label={t("Ghi chú pháp lý", "Legal note")} props={props} maxLength={200} counter hint={t("Ví dụ: sổ đỏ chính chủ, không tranh chấp.", "e.g. owner's red book, no disputes.")} />
        </SectionCard>
    );
}

export function ContactSection(props: SectionProps): JSX.Element {
    const { form, set, vi } = props;
    const t = (viText: string, enText: string): string => (vi ? viText : enText);
    return (
        <SectionCard id="lien-he" step={7} title={t("Thông tin liên hệ", "Contact")} hint={t("Người mua sẽ gọi số này. Số được ẩn một phần cho đến khi người xem bấm hiện số.", "Buyers will call this number. It is partly hidden until a viewer reveals it.")}>
            <Field id="lf-role" label={t("Bạn là", "You are")} required vi={vi}>
                <Segmented<PosterRole>
                    label={t("Vai trò người đăng", "Poster role")}
                    value={form.role}
                    options={POSTER_ROLES.map((item) => ({ id: item, label: vi ? ROLE_LABEL[item].vi : ROLE_LABEL[item].en }))}
                    onChange={(value) => set("role", value)}
                />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
                <TextField name="contactName" label={t("Tên hiển thị", "Display name")} props={props} required maxLength={60} />
                <TextField name="phone" label={t("Số điện thoại", "Phone number")} props={props} required inputMode="tel" maxLength={16} placeholder="0912 345 678" />
                <TextField name="zalo" label="Zalo" props={props} inputMode="tel" maxLength={16} hint={t("Không bắt buộc.", "Optional.")} />
            </div>
            <Toggle id="lf-hidePhone" checked={form.hidePhone} label={t("Ẩn một phần số cho đến khi người xem bấm hiện số", "Partly hide the number until a viewer reveals it")} onChange={(value) => set("hidePhone", value)} />
        </SectionCard>
    );
}

export function PublishSection(props: SectionProps): JSX.Element {
    const { form, errors, set, vi } = props;
    const t = (viText: string, enText: string): string => (vi ? viText : enText);
    const error = errors.agreed;
    return (
        <SectionCard id="dang-tin" step={8} title={t("Đăng tin", "Publish")} hint={t("Chọn thời hạn hiển thị và xác nhận chính sách.", "Choose how long it stays up and confirm the policy.")}>
            <Field id="lf-expiryDays" label={t("Thời hạn hiển thị", "Display period")} vi={vi}>
                <Segmented<string>
                    label={t("Thời hạn hiển thị", "Display period")}
                    value={String(form.expiryDays)}
                    options={EXPIRY_DAYS.map((days) => ({ id: String(days), label: t(`${days} ngày`, `${days} days`) }))}
                    onChange={(value) => set("expiryDays", Number(value) as (typeof EXPIRY_DAYS)[number])}
                />
            </Field>
            <div className="grid gap-1.5">
                <Toggle
                    id="lf-agreed"
                    checked={form.agreed}
                    label={t("Tôi cam kết thông tin là của tôi và đã đọc chính sách đăng tin.", "I confirm the information is mine and I have read the posting policy.")}
                    onChange={(value) => set("agreed", value)}
                />
                <Link href="/phap-ly/chinh-sach-dang-tin" target="_blank" className="w-fit text-sm font-semibold text-green">
                    {t("Xem chính sách đăng tin", "Read the posting policy")}
                </Link>
                {error ? (
                    <p role="alert" className="m-0 text-xs text-red-700">
                        {vi ? error.vi : error.en}
                    </p>
                ) : null}
            </div>
        </SectionCard>
    );
}
