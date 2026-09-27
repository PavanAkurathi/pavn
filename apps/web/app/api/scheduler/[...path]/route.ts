import { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/server/api-route-proxy";

type Context = { params: Promise<{ path: string[] }> };

/** Every Scheduler call goes through here, scoped to the active organization. */
async function forward(request: NextRequest, { params }: Context) {
    const { path } = await params;
    const target = path.map(encodeURIComponent).join("/");
    return proxyApiRequest(request, `/scheduler/${target}${request.nextUrl.search}`, {
        organizationScoped: true,
    });
}

export { forward as GET, forward as POST, forward as PATCH, forward as PUT, forward as DELETE };
