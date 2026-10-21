"use client";

import ReduxProvider from "@/shared/providers/redux.provider";
import { ReactNode } from "react";

export default function AppProvider({
    children,
}: {
    children: ReactNode;
}) {
    return <ReduxProvider>{children}</ReduxProvider>;
}
