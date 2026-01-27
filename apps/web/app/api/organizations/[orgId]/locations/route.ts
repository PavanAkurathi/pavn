
import { NextRequest, NextResponse } from "next/server";
import { db } from "@repo/database";
import { location } from "@repo/database/schema";
import { eq } from "@repo/database";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orgId: string }> } // params is a Promise in Next 15/latest
) {
    try {
        const { orgId } = await params;

        if (!orgId) {
            return new NextResponse("Organization ID missing", { status: 400 });
        }

        const locations = await db.query.location.findMany({
            where: eq(location.organizationId, orgId)
        });

        // Map to expected format if needed, or just return
        // Frontend expects: { id, name, address }
        // DB has: id, name, address, etc.
        return NextResponse.json(locations);

    } catch (error) {
        console.error("Error fetching locations:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
