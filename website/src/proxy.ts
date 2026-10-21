import { NextResponse, type NextRequest } from "next/server";

import { isIndexablePath } from "@/shared/utils/seo.utils";

export function proxy(request: NextRequest): NextResponse {
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
