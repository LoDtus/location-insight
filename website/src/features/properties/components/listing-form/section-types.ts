import type { FormErrors, ListingForm } from "@/features/properties/listing-form";

export type SetField = <K extends keyof ListingForm>(key: K, value: ListingForm[K]) => void;

export type SectionProps = {
    form: ListingForm;
    errors: FormErrors;
    set: SetField;
    vi: boolean;
};
