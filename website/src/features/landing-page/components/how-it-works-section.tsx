import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const STEPS: { key: "0" | "1" | "2" | "3" }[] = [{ key: "0" }, { key: "1" }, { key: "2" }, { key: "3" }];

export default async function CachHoatDongSection() {
    const messages = await getLandingMessages();
    const t = (...path: string[]): string => getLocaleValue(messages, ["how", ...path]);

    return (
        <section
            id="cach-hoat-dong"
            aria-labelledby="tieu-de-cach-hoat-dong"
            className="box-border scroll-mt-4 bg-white px-5 py-14 sm:px-10 lg:px-24 lg:py-16 xl:px-40"
        >
            <div className="grid items-end gap-4 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
                <h2
                    id="tieu-de-cach-hoat-dong"
                    className="m-0 max-w-[16ch] font-display text-[clamp(2.25rem,1.4rem+2.8vw,4rem)] leading-[0.98] font-semibold tracking-[-0.02em] text-balance"
                >
                    {t("title")}
                </h2>
                <p className="m-0 max-w-md text-base leading-relaxed text-charcoal/80">{t("lede")}</p>
            </div>

            {/* Bước nối bằng mũi tên: ngang từ trái sang phải trên màn rộng, dọc trên điện thoại. */}
            <ol className="m-0 mt-8 grid list-none gap-2 p-0 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] lg:items-stretch">
                {STEPS.map((step, index) => (
                    <Fragment key={step.key}>
                        <li className="flex flex-col rounded-lg border border-charcoal/15 bg-white p-5 shadow-[0_1px_2px_rgba(16,17,17,0.06),0_8px_24px_rgba(16,17,17,0.06)]">
                            <div className="flex items-start gap-3">
                                <span
                                    aria-hidden="true"
                                    className={`inline-flex size-10 shrink-0 items-center justify-center rounded-md font-sans text-lg font-bold tabular-nums [font-variant-numeric:lining-nums_tabular-nums] ${index === STEPS.length - 1 ? "bg-gold/30 text-charcoal" : "bg-green text-cream"}`}
                                >
                                    {index + 1}
                                </span>
                                <h3 className="m-0 font-display text-2xl leading-tight font-semibold">
                                    <span className="sr-only">{t("stepLabel").replace("{n}", String(index + 1))}: </span>
                                    {t("steps", step.key, "title")}
                                </h3>
                            </div>
                            <p className="m-0 mt-2 text-sm font-semibold text-green">{t("steps", step.key, "hint")}</p>
                            <p className="m-0 mt-3 text-sm leading-relaxed">{t("steps", step.key, "0")}</p>
                            <p className="m-0 mt-2 text-sm leading-relaxed text-charcoal/70">{t("steps", step.key, "1")}</p>
                        </li>
                        {index < STEPS.length - 1 ? (
                            <li aria-hidden="true" className="flex items-center justify-center text-gold">
                                <ChevronRight size={28} strokeWidth={2.5} className="rotate-90 lg:rotate-0" />
                            </li>
                        ) : null}
                    </Fragment>
                ))}
            </ol>
        </section>
    );
}
