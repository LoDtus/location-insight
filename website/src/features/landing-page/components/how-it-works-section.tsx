import { getLandingMessages } from "@/features/landing-page/server/get-landing-messages";
import { getLocaleValue } from "@/shared/utils/locale.utils";

const STEPS = ["0", "1", "2", "3"] as const;

const CHEVRON =
    "relative flex min-h-[5.25rem] flex-col justify-center gap-1 rounded-2xl border border-charcoal/15 px-4 py-3.5 xl:rounded-none xl:border-0 xl:py-3.5 xl:pr-8";

const NOTCH =
    "xl:[clip-path:polygon(0_0,calc(100%_-_16px)_0,100%_50%,calc(100%_-_16px)_100%,0_100%,16px_50%)]";

function chevronClass(index: number): string {
    if (index === 0) {
        return `${CHEVRON} bg-green text-cream xl:z-40 xl:-mr-4 xl:pl-4 xl:[clip-path:polygon(0_0,calc(100%_-_16px)_0,100%_50%,calc(100%_-_16px)_100%,0_100%)]`;
    }

    if (index === 1) {
        return `${CHEVRON} ${NOTCH} bg-green/15 text-green xl:z-30 xl:-mr-4 xl:pl-7`;
    }

    const edge = "bg-white text-charcoal xl:[filter:drop-shadow(0_0_0.6px_rgba(16,17,17,0.55))]";

    if (index === 2) {
        return `${CHEVRON} ${NOTCH} ${edge} xl:z-20 xl:-mr-4 xl:pl-7`;
    }

    return `${CHEVRON} ${NOTCH} ${edge} xl:z-10 xl:pl-7`;
}

export default async function CachHoatDongSection() {
    const messages = await getLandingMessages();

    return (
        <section
            id="cach-hoat-dong"
            aria-labelledby="tieu-de-cach-hoat-dong"
            className="box-border min-h-[100cqh] border border-current px-50 py-16"
        >
            <h2
                id="tieu-de-cach-hoat-dong"
                className="m-0 max-w-[18ch] text-4xl leading-tight font-semibold tracking-tight"
            >
                {getLocaleValue(messages, ["how", "title"])}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-charcoal/75">
                {getLocaleValue(messages, ["how", "lede"])}
            </p>
            <ol className="m-0 mt-10 grid list-none gap-5 p-0 xl:grid-cols-4 xl:grid-rows-[auto_auto] xl:gap-0">
                {STEPS.map((key, index) => (
                    <li
                        key={key}
                        className="min-w-0 xl:row-span-2 xl:grid xl:grid-rows-subgrid"
                    >
                        <div className={chevronClass(index)}>
                            <strong className="text-base leading-snug font-semibold">
                                {getLocaleValue(messages, ["how", "steps", key, "title"])}
                            </strong>
                            <span
                                className={`text-sm leading-snug ${index === 0 ? "text-cream/80" : index === 1 ? "text-green/80" : "text-charcoal/70"}`}
                            >
                                {getLocaleValue(messages, ["how", "steps", key, "hint"])}
                            </span>
                        </div>
                        <div className="mt-3 flex flex-col gap-2 xl:mt-0 xl:px-3 xl:pt-4">
                            <p className="m-0 text-base leading-relaxed">
                                {getLocaleValue(messages, ["how", "steps", key, "0"])}
                            </p>
                            <p className="m-0 text-base leading-relaxed text-charcoal/75">
                                {getLocaleValue(messages, ["how", "steps", key, "1"])}
                            </p>
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}
