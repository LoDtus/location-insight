import type { MetadataRoute } from "next";

import COLOR from "@/shared/constants/color.constant";

export default function manifest(): MetadataRoute.Manifest {
    return {
        id: "/",
        name: "Địa Thế",
        short_name: "Địa Thế",
        description: "Phân tích địa điểm và thị trường bất động sản.",
        lang: "vi",
        dir: "ltr",
        start_url: "/app?source=pwa",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        orientation: "any",
        background_color: COLOR.CREAM,
        theme_color: COLOR.GREEN,
        categories: ["business", "navigation", "productivity"],
        icons: [
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
            {
                name: "Bản đồ",
                url: "/app/map?source=shortcut",
                icons: [{ src: "/icons/shortcut-map-96.png", sizes: "96x96" }],
            },
            {
                name: "Tin nhắn",
                url: "/app/messages?source=shortcut",
                icons: [{ src: "/icons/shortcut-messages-96.png", sizes: "96x96" }],
            },
            {
                name: "Thông báo",
                url: "/app/notification?source=shortcut",
                icons: [{ src: "/icons/shortcut-notification-96.png", sizes: "96x96" }],
            },
        ],
    };
}
