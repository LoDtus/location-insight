const LOCALES = {
    VI: "vi",
    EN: "en",
} as const;

const LOCALE = {
    LOCALES,
    DEFAULT: LOCALES.VI,
    COOKIE_NAME: "locale",
    SUPPORTED: Object.values(LOCALES),
} as const;

export default LOCALE;
