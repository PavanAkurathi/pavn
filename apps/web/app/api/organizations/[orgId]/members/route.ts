import { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/server/api-route-proxy";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> },
) {
    const { orgId } = await params;

    if (!orgId) {
        return new Response("Organization ID missing", { status: 400 });
    }

    return proxyApiRequest(request, "/organizations/members", {
        organizationId: orgId,
    });
}
