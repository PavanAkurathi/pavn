import { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/server/api-route-proxy";

export async function GET(request: NextRequest) {
    return proxyApiRequest(request, "/manager-preferences", {
        organizationScoped: true,
    });
}

export async function PATCH(request: NextRequest) {
    return proxyApiRequest(request, "/manager-preferences", {
        organizationScoped: true,
    });
}
