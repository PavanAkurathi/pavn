import { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/server/api-route-proxy";

export async function GET(request: NextRequest) {
    return proxyApiRequest(request, `/worker/availability${request.nextUrl.search}`, {
        organizationScoped: true,
    });
}

export async function POST(request: NextRequest) {
    return proxyApiRequest(request, "/worker/availability", {
        organizationScoped: true,
    });
}
