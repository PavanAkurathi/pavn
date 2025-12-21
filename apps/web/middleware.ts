import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default async function authMiddleware(request: NextRequest) {
    try {
        const response = await fetch(
            new URL("/api/auth/get-session", request.url).toString(),
            {
                headers: {
                    cookie: request.headers.get("cookie") || "",
                },
            }
        );

        const session = await response.json();

        if (!session) {
            return NextResponse.redirect(new URL("/auth/login", request.url));
        }
        return NextResponse.next();
    } catch (error) {
        // Fallback protection: if fetch fails, assume unauthenticated
        return NextResponse.redirect(new URL("/auth/login", request.url));
    }
}

export const config = {
    matcher: ["/dashboard/:path*"],
};
