import { NextResponse, type NextRequest } from "next/server";

import { isIndexablePath } from "@/shared/utils/seo.utils";

export function proxy(request: NextRequest): NextResponse {
    // Công cụ reset dữ liệu dev: ngoài development luôn 404, kể cả khi mã còn sót trong bản build.
    const { pathname } = request.nextUrl;
    if ((pathname === "/reset" || pathname.startsWith("/reset/")) && process.env.NODE_ENV !== "development") {
        return new NextResponse(null, { status: 404 });
    }

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", request.nextUrl.pathname);

    const response = NextResponse.next({
        request: { headers: requestHeaders },
    });

    if (!isIndexablePath(request.nextUrl.pathname)) {
        response.headers.set("X-Robots-Tag", "noindex, nofollow");
    }

    return response;
}

export const config = {
    matcher: [
        "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml)$).*)",
    ],
};
