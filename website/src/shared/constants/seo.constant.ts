import type { Metadata } from "next";

export const INDEXABLE_ROBOTS: Metadata["robots"] = {
    index: true,
    follow: true,
};

export const PRIVATE_ROBOTS: Metadata["robots"] = {
    index: false,
    follow: false,
};
