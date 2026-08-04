import { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/server/api-route-proxy";

export async function GET(request: NextRequest) {
    return proxyApiRequest(request, `/timesheets/export${request.nextUrl.search}`, {
        organizationScoped: true,
    });
}
