"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type JSX, type ReactNode } from "react";

import { useNotificationUnread } from "@/features/notification/notification-badge";
import { InstallGuide } from "@/features/pwa/components/install-guide";
import { InstallPrompt } from "@/features/pwa/components/install-prompt";
import { OfflineBar } from "@/features/pwa/components/offline-bar";
import { UpdateBanner } from "@/features/pwa/components/update-banner";
import { recordPwaMetric, registerServiceWorker, serviceWorkerDisabled, skipWaitingAndReload, syncBadge } from "@/features/pwa/pwa-client";
import {
    installEligible,
    installLater,
    needsInstallGuide,
    noteNotificationVisit,
    noteSession,
    shouldRegisterHere,
    standaloneDisplay,
} from "@/features/pwa/pwa-state";
import { isAppPath, notificationTarget } from "@/features/pwa/sw-policy";

type InstallEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

type PwaValue = {
    canInstall: boolean;
    showGuide: boolean;
    requestInstall: () => void;
};

const PwaContext = createContext<PwaValue>({
    canInstall: false,
    showGuide: false,
    requestInstall: () => undefined,
});

export function usePwaInstall(): PwaValue {
    return useContext(PwaContext);
}

export function PwaProvider({ children }: { children: ReactNode }): JSX.Element {
    const pathname = usePathname();
    const search = useSearchParams();
    const router = useRouter();
    const notices = useNotificationUnread();
    const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
    const [offer, setOffer] = useState(false);
    const [guide, setGuide] = useState(false);
    const [updateReady, setUpdateReady] = useState(false);
    const guideNeeded = useSyncExternalStore(emptySubscribe, needsInstallGuide, () => false);

    useEffect(() => {
        noteSession();
        noteNotificationVisit(pathname);
        if (serviceWorkerDisabled()) {
            workerStarted = false;
            void registerServiceWorker();
            return;
        }
        if (!shouldRegisterHere(pathname)) return;
        queueWorker(setUpdateReady);
    }, [pathname, search]);

    useEffect(() => {
        if (!standaloneDisplay()) return;
        void syncBadge(notices.count).catch(() => undefined);
    }, [notices.count]);

    useEffect(() => {
        function onInstallable(event: Event): void {
            event.preventDefault();
            setInstallEvent(event as InstallEvent);
            setOffer(!standaloneDisplay() && installEligible());
        }
        function onInstalled(): void {
            setInstallEvent(null);
            setOffer(false);
            recordPwaMetric("installed");
        }
        window.addEventListener("beforeinstallprompt", onInstallable);
        window.addEventListener("appinstalled", onInstalled);
        return () => {
            window.removeEventListener("beforeinstallprompt", onInstallable);
            window.removeEventListener("appinstalled", onInstalled);
        };
    }, []);

    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        const onMessage = (event: MessageEvent) => {
            if (!(event.source instanceof ServiceWorker)) return;
            const data = event.data as { type?: string; url?: string; id?: string } | null;
            if (!data) return;
            if (data.type === "navigate" && typeof data.url === "string") {
                const target = notificationTarget(data.url, window.location.origin);
                if (isAppPath(new URL(target, window.location.origin).pathname)) {
                    window.dispatchEvent(new CustomEvent("notification:open", { detail: data.id }));
                    router.push(target);
                }
            }
            if (data.type === "resubscribe") {
                window.dispatchEvent(new Event("pwa:resubscribe"));
            }
        };
        navigator.serviceWorker.addEventListener("message", onMessage);
        return () => navigator.serviceWorker.removeEventListener("message", onMessage);
    }, [router]);

    const value = useMemo<PwaValue>(
        () => ({
            canInstall: Boolean(installEvent) && !standaloneDisplay(),
            showGuide: guideNeeded && !standaloneDisplay(),
            requestInstall: () => {
                if (guideNeeded) {
                    setGuide(true);
                    return;
                }
                void installEvent?.prompt();
            },
        }),
        [guideNeeded, installEvent],
    );

    return (
        <PwaContext.Provider value={value}>
            {children}
            {updateReady ? <UpdateBanner onReload={() => void skipWaitingAndReload()} /> : null}
            {offer && installEvent ? (
                <InstallPrompt
                    onInstall={() => {
                        void installEvent.prompt().then(() => setOffer(false));
                    }}
                    onLater={() => {
                        installLater();
                        setOffer(false);
                    }}
                />
            ) : null}
            {guide ? <InstallGuide mac={!/iPhone|iPad|iPod/.test(navigator.userAgent)} onClose={() => setGuide(false)} /> : null}
            <OfflineBar />
        </PwaContext.Provider>
    );
}

function emptySubscribe(): () => void {
    return () => undefined;
}

let workerStarted = false;
let workerQueued = false;

function queueWorker(setUpdateReady: (ready: boolean) => void): void {
    if (workerStarted || workerQueued) return;
    workerQueued = true;
    const run = () => {
        workerQueued = false;
        if (serviceWorkerDisabled()) {
            void registerServiceWorker();
            return;
        }
        if (workerStarted) return;
        workerStarted = true;
        void bootWorker(setUpdateReady).catch(() => {
            workerStarted = false;
        });
    };
    if (document.readyState === "complete") {
        if (window.requestIdleCallback) window.requestIdleCallback(run);
        else window.setTimeout(run, 1);
        return;
    }
    window.addEventListener("load", run, { once: true });
}

async function bootWorker(setUpdateReady: (ready: boolean) => void): Promise<void> {
    const registration = await registerServiceWorker();
    if (!registration) return;
    recordPwaMetric("push-support");
    const watch = () => setUpdateReady(Boolean(registration.waiting));
    watch();
    registration.addEventListener("updatefound", () => {
        registration.installing?.addEventListener("statechange", watch);
    });
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") void registration.update();
    });
    window.setInterval(() => void registration.update(), 6 * 60 * 60 * 1000);
    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (sessionStorage.getItem("pwa-reload") !== "1" || reloading) return;
        reloading = true;
        recordPwaMetric("sw-updated");
        window.location.reload();
    });
}
