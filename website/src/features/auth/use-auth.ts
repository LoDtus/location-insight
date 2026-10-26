"use client";

import { useEffect } from "react";

import { refreshSession } from "@/features/auth/auth.api";
import { sessionCleared } from "@/features/auth/auth.slice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";

export function useAuth() {
    const auth = useAppSelector((state) => state.auth);
    const dispatch = useAppDispatch();

    useEffect(() => {
        if (auth.status !== "unknown") return;

        void refreshSession().catch(() => {
            dispatch(sessionCleared());
        });
    }, [auth.status, dispatch]);

    return auth;
}
