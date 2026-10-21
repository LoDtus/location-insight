const ERROR = {
    SLUGS: [
        "unauthenticated",
        "forbidden",
        "not-found",
        "internal-error",
    ],
} as const;

export type ErrorSlug = (typeof ERROR.SLUGS)[number];

export function isErrorSlug(value: string): value is ErrorSlug {
    return (ERROR.SLUGS as readonly string[]).includes(value);
}

export default ERROR;
