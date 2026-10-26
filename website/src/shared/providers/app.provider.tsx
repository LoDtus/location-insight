"use client";

import { ReactNode } from "react";

import { useAuth } from "@/features/auth/use-auth";
import ReduxProvider from "@/shared/providers/redux.provider";

function AuthBootstrap({ children }: { children: ReactNode }) {
    useAuth();
    return children;
}

export default function AppProvider({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <ReduxProvider>
            <AuthBootstrap>{children}</AuthBootstrap>
        </ReduxProvider>
    );
}
