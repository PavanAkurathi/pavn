import { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/server/api-route-proxy";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string; tempId: string }> },
) {
    const { orgId, tempId } = await params;

    if (!orgId || !tempId) {
        return new Response("Missing identifiers", { status: 400 });
    }

    return proxyApiRequest(request, `/organizations/temp-workers/${tempId}`, {
        organizationId: orgId,
    });
}
