import { NextRequest } from "next/server";
import { proxyApiRequest } from "@/lib/server/api-route-proxy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    return proxyApiRequest(request, "/billing/webhooks/stripe");
}
